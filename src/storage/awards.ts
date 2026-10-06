/**
 * Earned awards — the on-device record behind the Command Center's gentle
 * gamification (design Phase C: badges and milestones).
 *
 * An `EarnedAward` is a fact about something that already happened for one pet:
 * "this pet earned the 7-day care streak on this date", "this pet's first photo
 * was filed on this date". It is written once, when the app notices the
 * condition is met, and it never changes afterwards — so a badge the owner has
 * seen is still there tomorrow, even if a streak later lapses or a record is
 * edited. Nothing is deleted when the pet's data changes; only deleting the pet
 * clears its shelf.
 *
 * Two deliberate limits, mirroring `types/checkIn`:
 *  - **Never a score.** An award has no points, no level and no rank. Every
 *    condition is a positive thing the owner did (a record filed, a day of care,
 *    a celebration), never a penalty, and there is no award for "not missing
 *    a dose".
 *  - **Never invented.** The condition is evaluated against real on-device
 *    records (see `utils/gamification`), so a fresh install earns nothing at all.
 *
 * 100% offline: AsyncStorage only — no network, no analytics.
 */
import { CollectionStore } from './storage';
import type { BaseEntity } from '../types';

/** Whether an award is a badge (a marker) or a milestone (a first/round number). */
export type AwardKind = 'badge' | 'milestone';

/** One award a pet has earned, persisted on the device. */
export interface EarnedAward extends BaseEntity {
  /** The pet it was earned by. */
  petId: string;
  /** The catalogue id, e.g. `streak-7` (see utils/gamification). */
  awardId: string;
  /** Badge or milestone — how the shelf groups it. */
  kind: AwardKind;
  /** ISO timestamp of the moment the app noticed it was earned. */
  earnedAt: string;
}

/** Input for recording an award (id/createdAt come from the storage layer). */
export type EarnedAwardInput = Omit<EarnedAward, keyof BaseEntity> & Partial<BaseEntity>;

/** Persisted collection of earned awards (every pet, ever). */
export const awardStore = new CollectionStore<EarnedAward>('awards');

/** All CRUD + per-pet listing operations for earned awards. */
export const awardRepository = {
  /** Every award on this device, oldest first. */
  list(): Promise<EarnedAward[]> {
    return awardStore.getAll();
  },

  /** One pet's shelf, newest first. */
  listByPet(petId: string): Promise<EarnedAward[]> {
    return awardStore
      .getAll()
      .then((all) =>
        all
          .filter((award) => award.petId === petId)
          .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
      );
  },

  /** Record an award. */
  create(input: EarnedAwardInput): Promise<EarnedAward> {
    return awardStore.create(input as EarnedAward);
  },

  /** Delete one award by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return awardStore.remove(id);
  },

  /** When a pet is deleted, drop its whole shelf. */
  async removeForPet(petId: string): Promise<void> {
    const all = await awardStore.getAll();
    await awardStore.setAll(all.filter((award) => award.petId !== petId));
  },
};
