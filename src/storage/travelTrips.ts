/**
 * Travel Mode's on-device storage (HANDOFF, unit 1 of 3).
 *
 * A trip is a plain local record — id, name, the two dates, the pets and the
 * "before you go" checklist — held in the app's own AsyncStorage collection
 * under the app prefix (`@pet-parent-tracker/travelTrips`), exactly like pets,
 * passes and check-ins. So it is covered by Settings' one-sweep wipe
 * (`wipeAllAppData` removes every key below the prefix) and it never leaves the
 * device: no account, no sync, no server.
 *
 * Two rules worth stating plainly:
 *  - **Storage is not trusted.** Anything read back goes through
 *    `cleanTravelTrip`, which drops records with no usable id, flattens and
 *    caps every string, keeps only real pet ids and only the canonical
 *    checklist slugs. Nothing downstream can print "undefined" or "NaN", and a
 *    hand-edited store cannot break the screen.
 *  - **Saving a trip creates no pass.** The trip is the owner's own plan;
 *    creating the pass is the wizard's job, and Travel Mode hands off to it (see
 *    `utils/travelMode`'s `travelPrefillForTrip`).
 *
 * 100% offline: JSON in memory + AsyncStorage. No fetch, no URLs, no accounts.
 */
import { CollectionStore, newId } from './storage';
import type {
  TravelTrip,
  TravelTripInput,
} from '../utils/travelMode';
import {
  TRAVEL_CHECKLIST_SLUGS,
  TRAVEL_MAX_PETS,
  TRAVEL_NAME_MAX,
  TRAVEL_PET_ID_MAX,
  travelCheckedSlugs,
} from '../utils/travelMode';
// The app's one text sanitiser (Emergency Mode's): flattens control characters
// and newlines, collapses whitespace, caps the length. One rule for every
// owner-typed value in the app, rather than a second copy here.
import { emergencyText } from '../utils/emergencyMode';

/** Persisted collection of the owner's trips. */
export const travelTripStore = new CollectionStore<TravelTrip>('travelTrips');

/** The AsyncStorage key this feature owns (for the wipe + harness checks). */
export const TRAVEL_TRIPS_KEY = '@pet-parent-tracker/travelTrips';

/**
 * One stored record, made safe: a missing id or timestamp is filled in, every
 * string is flattened and capped, pet ids are de-duplicated strings and the
 * checklist keeps only its own four slugs. Returns null only when the record
 * cannot be a trip at all (not an object).
 */
export function cleanTravelTrip(raw: unknown): TravelTrip | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = emergencyText(record.id, TRAVEL_PET_ID_MAX);
  // A record with no id cannot be opened, updated or removed — it is dropped
  // rather than shown as a row that does nothing when tapped.
  if (id.length === 0) return null;
  const petIds: string[] = [];
  for (const value of Array.isArray(record.petIds) ? record.petIds : []) {
    const petId = emergencyText(value, TRAVEL_PET_ID_MAX);
    if (petId.length === 0 || petIds.includes(petId)) continue;
    petIds.push(petId);
    if (petIds.length >= TRAVEL_MAX_PETS) break;
  }
  return {
    id,
    createdAt: emergencyText(record.createdAt, 40),
    name: emergencyText(record.name, TRAVEL_NAME_MAX),
    startDate: emergencyText(record.startDate, 10),
    endDate: emergencyText(record.endDate, 10),
    petIds,
    checked: travelCheckedSlugs(record.checked),
  };
}

/** Newest first, so the trip most recently made sits at the top. */
function byNewest(a: TravelTrip, b: TravelTrip): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

/**
 * The whole collection, as a list — whatever the key actually holds.
 *
 * `CollectionStore.getAll()` JSON-parses the key inside a try/catch, so junk that
 * is not JSON at all already reads as empty. A value that *is* valid JSON but not
 * an array (a hand-edited `{"nope":true}`, or a bare `42`) still comes back as
 * that value, and both `for…of` and `.find()` would throw on it. So the feature
 * reads through here: anything that is not an array is treated as "nothing
 * stored", and the key is repaired to an empty list so the next write is a real
 * array again. A storage failure on the repair is not fatal — the caller gets an
 * honest empty list either way.
 */
async function readAll(): Promise<TravelTrip[]> {
  let raw: unknown;
  try {
    raw = await travelTripStore.getAll();
  } catch {
    return [];
  }
  if (Array.isArray(raw)) return raw;
  try {
    await travelTripStore.setAll([]);
  } catch {
    // Read-only trouble is the screen's business to report, not a reason to throw
    // out of a read.
  }
  return [];
}

/** All CRUD for the `travelTrips` collection, with the reads cleaned. */
export const travelTripRepository = {
  /** Every trip on this device, newest first, every field made safe. */
  async list(): Promise<TravelTrip[]> {
    const raw = await readAll();
    const trips: TravelTrip[] = [];
    for (const item of raw) {
      const clean = cleanTravelTrip(item);
      if (clean) trips.push(clean);
    }
    return trips.sort(byNewest);
  },

  /** One trip by id, cleaned, or null. */
  async get(id: string): Promise<TravelTrip | null> {
    const wanted = typeof id === 'string' ? id : '';
    if (wanted === '') return null;
    const rows = await readAll();
    const found = rows.find((item) => item != null && item.id === wanted);
    return cleanTravelTrip(found ?? null);
  },

  /**
   * Save a trip: update the record when `id` is given and still exists,
   * otherwise create a new one. The stored record is cleaned first, so what
   * comes back is exactly what a later read will see.
   */
  async save(input: TravelTripInput, id?: string): Promise<TravelTrip> {
    const clean = cleanTravelTrip({ id: 'pending', createdAt: '', ...input });
    // Only reachable with a non-object input; the screen always passes fields.
    const fields: TravelTripInput = clean
      ? {
          name: clean.name,
          startDate: clean.startDate,
          endDate: clean.endDate,
          petIds: clean.petIds,
          checked: clean.checked,
        }
      : {
          name: '',
          startDate: '',
          endDate: '',
          petIds: [],
          checked: [],
        };
    const wanted = typeof id === 'string' ? id.trim() : '';
    // Read through the guard first: it repairs a corrupt key, so the create /
    // update below always lands in a real array.
    const rows = await readAll();
    if (wanted !== '') {
      const existing = rows.find((item) => item != null && item.id === wanted);
      if (existing) {
        const updated = await travelTripStore.update(wanted, fields);
        return cleanTravelTrip(updated) ?? {
          id: wanted,
          createdAt: existing.createdAt ?? '',
          ...fields,
        };
      }
    }
    return travelTripStore.create({
      id: newId(),
      createdAt: new Date().toISOString(),
      ...fields,
    });
  },

  /** Tick or untick one checklist line on a saved trip, in place. */
  async setChecked(id: string, checked: readonly string[]): Promise<TravelTrip | null> {
    const updated = await travelTripStore.update(id, {
      checked: travelCheckedSlugs(checked),
    });
    return cleanTravelTrip(updated);
  },

  /** Remove a trip. Returns true when a record was actually removed. */
  remove(id: string): Promise<boolean> {
    return travelTripStore.remove(id);
  },

  /** Every canonical checklist slug — the store's own contract, for callers. */
  checklistSlugs(): readonly string[] {
    return TRAVEL_CHECKLIST_SLUGS;
  },
};
