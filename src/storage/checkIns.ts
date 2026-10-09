/**
 * Care check-in data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<CareCheckInEvent>` into the small typed API the
 * CheckInsContext and the Daily Care Ring use — exactly the shape
 * `src/storage/feeding.ts` established for its own collection. Every record
 * carries the owning pet's id, so listing one pet's log is a pure in-memory
 * filter: no extra storage keys, no network, nothing to sync.
 *
 * One key holds every check-in the app has ever recorded
 * (`@pet-parent-tracker/check-ins`), which keeps the week/day maths of the ring
 * honest: "done today" is derived by rendering each event's timestamp in the
 * owner's display time zone (see `careCheckInIsOn`).
 */
import { CollectionStore } from './storage';
import { careCheckInIsOn, isMoodCheckIn } from '../types/checkIn';
import type { CareCheckInEvent, CareCheckInInput, CareCheckInType } from '../types/checkIn';

/** Persisted collection of care check-ins (every pet, every day). */
export const checkInStore = new CollectionStore<CareCheckInEvent>('check-ins');

/** All CRUD + per-pet listing operations for care check-ins. */
export const checkInRepository = {
  /** Every check-in ever recorded (all pets), oldest first. */
  list(): Promise<CareCheckInEvent[]> {
    return checkInStore.getAll();
  },

  /** One pet's whole log, newest first. */
  listByPet(petId: string): Promise<CareCheckInEvent[]> {
    return checkInStore
      .getAll()
      .then((all) =>
        all
          .filter((event) => event.petId === petId)
          .sort((a, b) => b.at.localeCompare(a.at)),
      );
  },

  /** Record a check-in. */
  create(input: CareCheckInInput): Promise<CareCheckInEvent> {
    return checkInStore.create(input as CareCheckInEvent);
  },

  /** Delete one check-in by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return checkInStore.remove(id);
  },

  /** When a pet is deleted, drop its whole check-in history. */
  async removeForPet(petId: string): Promise<void> {
    const all = await checkInStore.getAll();
    await checkInStore.setAll(all.filter((event) => event.petId !== petId));
  },
};

/**
 * The acts already recorded for one pet on one local calendar day
 * (`YYYY-MM-DD`, in the display zone). Pure — the same filter the ring applies
 * in memory, kept here so storage and UI can never disagree.
 *
 * Mood observations (`type: 'mood'`, written by the Sitter Mode check-in
 * engine) are deliberately left out: a mood says how the pet seemed, not that
 * an act of care happened, so it never lights a ring tile and never counts as
 * an act done. Read it with `latestMoodOn` instead.
 */
export function doneTypesOn(
  events: CareCheckInEvent[],
  petId: string,
  dayKey: string,
  zone?: string,
): CareCheckInType[] {
  const done = events
    .filter(
      (event) =>
        event.petId === petId &&
        !isMoodCheckIn(event.type) &&
        careCheckInIsOn(event, dayKey, zone),
    )
    .map((event) => event.type);
  return [...new Set(done)];
}
