/**
 * Printable care binder — the bridge between the app's stores and the document.
 *
 * The binder reads the SAME contexts every other screen reads (pets, vaccines,
 * medications, feeding, vet records, expenses, care instructions and the
 * owner's own name) plus the one store that lives outside a context: the
 * per-pet emergency-card details (the microchip and the allergies/conditions
 * line), loaded exactly the way Emergency Mode and the Leaving Town wizard load
 * them. There is no second copy of the data and no re-entry anywhere.
 *
 * The print HTML comes from the planner's own `buildPlannerHtml` — one engine,
 * two documents.
 *
 * 100% offline: it only reads already-loaded local state and one AsyncStorage
 * key. No fetch, no server, no account.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAccount } from '../../context/AccountContext';
import { useCareInstructions } from '../../context/CareInstructionsContext';
import { useExpenses } from '../../context/ExpensesContext';
import { useFeeding } from '../../context/FeedingContext';
import { useMedications } from '../../context/MedicationsContext';
import { usePets } from '../../context/PetContext';
import { useVaccines } from '../../context/VaccinesContext';
import { useVetRecords } from '../../context/VetContext';
import { emergencyDetailsRepository } from '../../storage/emergencyDetails';
import type { EmergencyExtrasByPet } from '../emergency/document';
import { buildPlannerHtml } from '../planner/html';
import {
  buildBinderDocument,
  type BinderConfig,
  type BinderDocument,
  type BinderSource,
} from './document';

/** The document builders the binder screens use, plus what they are built from. */
export interface BinderBuilders {
  /** Build the structured document (the preview draws this). */
  document: (config: BinderConfig) => BinderDocument;
  /** Build the print HTML for the same configuration (PDF + browser print). */
  html: (config: BinderConfig) => string;
  /** False while the card details are still being read (so the screen can wait). */
  ready: boolean;
}

/** Gather the stores and expose the document/HTML builders for a config. */
export function useBinderBuilders(): BinderBuilders {
  const { pets } = usePets();
  const { vaccines } = useVaccines();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { vetRecords } = useVetRecords();
  const { expenses } = useExpenses();
  const { careInstructions } = useCareInstructions();
  const { username } = useAccount();

  const [extras, setExtras] = useState<EmergencyExtrasByPet>({});
  const [ready, setReady] = useState(false);

  // The card details are the one prefill source that is not in a context: they
  // are read from their own store, exactly like the emergency sheet, the printed
  // card and the Leaving Town wizard do.
  useEffect(() => {
    let cancelled = false;
    emergencyDetailsRepository
      .load()
      .then((loaded) => {
        if (!cancelled) {
          setExtras(loaded);
          setReady(true);
        }
      })
      .catch(() => {
        /* unreadable storage simply means "nothing on file" — still printable */
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const source: BinderSource = useMemo(
    () => ({
      pets,
      vaccines,
      medications,
      feeding: feedingSchedules,
      vetRecords,
      expenses,
      careInstructions,
      ownerName: username,
      emergencyExtras: extras,
    }),
    [
      pets,
      vaccines,
      medications,
      feedingSchedules,
      vetRecords,
      expenses,
      careInstructions,
      username,
      extras,
    ],
  );

  const document = useCallback(
    (config: BinderConfig) => buildBinderDocument(source, config),
    [source],
  );
  const html = useCallback(
    (config: BinderConfig) => buildPlannerHtml(buildBinderDocument(source, config)),
    [source],
  );

  return useMemo(() => ({ document, html, ready }), [document, html, ready]);
}
