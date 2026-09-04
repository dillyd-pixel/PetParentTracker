/**
 * Feeding schedule data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<FeedingSchedule>` into a small typed API the
 * FeedingContext and screens use, mirroring how `medicationRepository` wraps
 * the medication collection. Because each record carries the owning pet's id,
 * filtering by pet is a pure in-memory operation — no extra storage keys, no
 * network.
 */
import { CollectionStore } from './storage';
import type { FeedingSchedule, FeedingScheduleInput } from '../types';

/** Persisted collection of feeding schedule entries (all pets). */
export const feedingStore = new CollectionStore<FeedingSchedule>('feeding');

/** All CRUD + per-pet listing operations for feeding schedules. */
export const feedingRepository = {
  /** Every feeding entry (all pets). */
  list(): Promise<FeedingSchedule[]> {
    return feedingStore.getAll();
  },

  /** All feeding entries for one pet, sorted by meal time (earliest first). */
  listByPet(petId: string): Promise<FeedingSchedule[]> {
    return feedingStore.getAll().then((all) =>
      all
        .filter((f) => f.petId === petId)
        .sort(
          (a, b) =>
            a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt),
        ),
    );
  },

  get(id: string): Promise<FeedingSchedule | null> {
    return feedingStore.findById(id);
  },

  /** Persist a new feeding entry. */
  create(input: FeedingScheduleInput): Promise<FeedingSchedule> {
    return feedingStore.create(input as FeedingSchedule);
  },

  /** Update selected fields of a feeding entry by id. Returns null if not found. */
  update(
    id: string,
    changes: Partial<FeedingScheduleInput>,
  ): Promise<FeedingSchedule | null> {
    return feedingStore.update(id, changes);
  },

  /** Delete a feeding entry by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return feedingStore.remove(id);
  },
};
