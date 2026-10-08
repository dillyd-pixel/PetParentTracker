/**
 * Emergency Pet Card pack — the bridge between the app's stores and the cards.
 *
 * The cards read the SAME contexts every other screen reads (the pets and their
 * photos, their medications, their vet records, their care instructions and the
 * owner's own name from Settings) so there is no second copy of the data, no
 * re-entry and nothing invented. This hook gathers them into an
 * `EmergencyCardSource`, hands back the deck/HTML builders for a configuration,
 * and resolves each selected pet's photo into something the print sheet can
 * carry (see ../artwork/photoData) — cached per URI, so the same file is read
 * once however many times the screen redraws.
 *
 * It also owns the ONE piece of new state this feature has: the card details the
 * owner types (see ../../storage/emergencyDetails). They are loaded once, kept
 * in memory while the screen is open, and written back to AsyncStorage a moment
 * after typing stops — so a typed phone number survives an app restart without a
 * write on every keystroke, and an empty form is never saved over stored values
 * before the load has finished.
 *
 * 100% offline: it only reads already-loaded local state and the device's own
 * files. Nothing is fetched, nothing is uploaded.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePets } from '../../context/PetContext';
import { useMedications } from '../../context/MedicationsContext';
import { useVetRecords } from '../../context/VetContext';
import { useCareInstructions } from '../../context/CareInstructionsContext';
import { useAccount } from '../../context/AccountContext';
import { emergencyDetailsRepository, extrasForPet } from '../../storage/emergencyDetails';
import { toPrintPhoto } from '../artwork/photoData';
import type { Pet } from '../../types';
import { buildEmergencyCardDeck } from './document';
import type {
  EmergencyCardConfig,
  EmergencyCardDeck,
  EmergencyCardExtras,
  EmergencyCardSource,
  EmergencyExtrasByPet,
} from './document';
import { buildEmergencyCardsHtml } from './html';

/** How long after the last keystroke the typed details are written to storage. */
const SAVE_DEBOUNCE_MS = 400;

/** The deck builders the emergency-card screens use. */
export interface EmergencyCardBuilders {
  /** Build the pack (the on-screen preview and the file actions read this). */
  document: (config: EmergencyCardConfig) => EmergencyCardDeck;
  /** Build the print HTML for the same configuration (PDF + browser print). */
  html: (config: EmergencyCardConfig) => string;
  /** The gathered stores themselves — the pickers list pets with these. */
  source: EmergencyCardSource;
  /**
   * Every selected pet's photo as the print sheet needs it (a `data:` URI on a
   * device), keyed by pet id. A pet with no photo, or one that cannot be read,
   * resolves to null — its card prints the illustrated initial instead.
   */
  resolvePhotos: (pets: readonly Pet[]) => Promise<Record<string, string | null>>;
}

/** Gather the stores and expose the deck/HTML builders for a config. */
export function useEmergencyCardBuilders(): EmergencyCardBuilders {
  const { pets } = usePets();
  const { medications } = useMedications();
  const { vetRecords } = useVetRecords();
  const { careInstructions } = useCareInstructions();
  const { username } = useAccount();

  const source = useMemo<EmergencyCardSource>(
    () => ({
      pets,
      medications,
      vetRecords,
      careInstructions,
      ownerName: username,
    }),
    [pets, medications, vetRecords, careInstructions, username],
  );

  /** One read per photo per visit — the promise itself is cached, so concurrent
   *  callers (the frame and a file action) share it. */
  const photoCache = useRef(new Map<string, Promise<string | null>>());

  const resolvePhoto = useCallback((uri: string | null | undefined) => {
    if (!uri) return Promise.resolve<string | null>(null);
    const cache = photoCache.current;
    const inFlight = cache.get(uri);
    if (inFlight) return inFlight;
    const promise = toPrintPhoto(uri);
    cache.set(uri, promise);
    return promise;
  }, []);

  const resolvePhotos = useCallback(
    async (targets: readonly Pet[]): Promise<Record<string, string | null>> => {
      const entries = await Promise.all(
        targets.map(
          async (pet) => [pet.id, await resolvePhoto(pet.photoUri)] as const,
        ),
      );
      return Object.fromEntries(entries);
    },
    [resolvePhoto],
  );

  const document = useCallback(
    (config: EmergencyCardConfig) => buildEmergencyCardDeck(source, config),
    [source],
  );
  const html = useCallback(
    (config: EmergencyCardConfig) => buildEmergencyCardsHtml(document(config)),
    [document],
  );

  return useMemo(
    () => ({ document, html, source, resolvePhotos }),
    [document, html, source, resolvePhotos],
  );
}

/** The typed card details the card screen edits, kept on this device. */
export interface EmergencyDetailsState {
  /** Every pet's typed details, keyed by pet id. */
  details: EmergencyExtrasByPet;
  /** One pet's details (an empty object when nothing has been typed yet). */
  forPet: (petId: string) => EmergencyCardExtras;
  /** Merge one pet's typed values in; the write to storage is debounced. */
  update: (petId: string, patch: EmergencyCardExtras) => void;
  /**
   * Whether the stored details have been read yet. The screen shows the form
   * either way, but nothing is written back before this is true, so an early
   * keystroke can never overwrite what is on the device.
   */
  ready: boolean;
}

/** Load, edit and persist the owner's typed card details. */
export function useEmergencyDetails(): EmergencyDetailsState {
  const [details, setDetails] = useState<EmergencyExtrasByPet>({});
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The latest map, so a debounced write always saves what is on screen. */
  const latest = useRef<EmergencyExtrasByPet>({});

  useEffect(() => {
    let alive = true;
    emergencyDetailsRepository
      .load()
      .then((stored) => {
        if (!alive) return;
        latest.current = stored;
        setDetails(stored);
        setReady(true);
      })
      .catch(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const update = useCallback(
    (petId: string, patch: EmergencyCardExtras) => {
      if (!petId) return;
      // The ref is the source of truth here, so a debounced write always saves
      // exactly what is on screen, and merging never depends on a stale render.
      const next: EmergencyExtrasByPet = {
        ...latest.current,
        [petId]: { ...latest.current[petId], ...patch },
      };
      latest.current = next;
      setDetails(next);
      if (!ready) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        emergencyDetailsRepository.saveAll(latest.current).catch(() => undefined);
      }, SAVE_DEBOUNCE_MS);
    },
    [ready],
  );

  const forPet = useCallback((petId: string) => extrasForPet(details, petId), [details]);

  return useMemo(() => ({ details, forPet, update, ready }), [details, forPet, update, ready]);
}
