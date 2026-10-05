/**
 * Care Instructions on-device storage — Sitter Mode's per-pet notes (Stage 2).
 *
 * Follows the app's existing pattern (`feeding.ts`, `carePasses.ts`): a
 * `CollectionStore<CareInstructions>` over one AsyncStorage key, wrapped in a
 * small typed repository the context and screens use.
 *
 * The one rule this layer owns: **one record per pet**. `saveForPet` looks up
 * the pet's existing record first and updates it, so a second save edits the
 * notes instead of piling up duplicates; `getForPet` is the matching read. The
 * flat entity (see `../types/careInstructions`) is stored as-is, so a record
 * written before a field existed still reads with the fields it has.
 *
 * 100% offline: AsyncStorage only — no fetch, no URLs, no accounts.
 */
import { CollectionStore, newId } from './storage';
import { cleanCareInstructionValues } from '../types';
import type { CareInstructions, CareInstructionValues } from '../types';

/** Persisted collection of per-pet care instructions. */
export const careInstructionsStore = new CollectionStore<CareInstructions>(
  'careInstructions',
);

/** The record for one pet out of a list, or null (pure — no I/O). */
export function careInstructionsForPet(
  all: readonly CareInstructions[],
  petId: string,
): CareInstructions | null {
  return all.find((record) => record.petId === petId) ?? null;
}

/** Most recently edited first, so a list can show what changed last. */
function byRecentlyUpdated(a: CareInstructions, b: CareInstructions): number {
  const left = a.updatedAt ?? a.createdAt;
  const right = b.updatedAt ?? b.createdAt;
  return right.localeCompare(left);
}

/** All CRUD + per-pet operations for care instructions. */
export const careInstructionsRepository = {
  /** Every pet's notes on this device, most recently edited first. */
  async list(): Promise<CareInstructions[]> {
    const all = await careInstructionsStore.getAll();
    return all.sort(byRecentlyUpdated);
  },

  get(id: string): Promise<CareInstructions | null> {
    return careInstructionsStore.findById(id);
  },

  /** This pet's notes, or null when the owner has not written any yet. */
  async getForPet(petId: string): Promise<CareInstructions | null> {
    return careInstructionsForPet(await careInstructionsStore.getAll(), petId);
  },

  /**
   * Write a pet's notes: update the pet's existing record, or create the first
   * one. Values are trimmed and blanks dropped (`cleanCareInstructionValues`),
   * so clearing every box leaves an empty record rather than a shell of `''`.
   * Saving always succeeds — notes are free text and nothing is required.
   */
  async saveForPet(
    petId: string,
    values: CareInstructionValues,
  ): Promise<CareInstructions> {
    const clean = cleanCareInstructionValues(values);
    const now = new Date().toISOString();
    const existing = await careInstructionsRepository.getForPet(petId);
    if (existing) {
      const updated = await careInstructionsStore.update(existing.id, {
        ...clean,
        updatedAt: now,
      });
      // `update` only returns null for a record that vanished mid-write.
      return updated ?? { ...existing, ...clean, updatedAt: now };
    }
    return careInstructionsStore.create({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      petId,
      ...clean,
    });
  },

  /** Delete one record by id. Returns true when something was removed. */
  remove(id: string): Promise<boolean> {
    return careInstructionsStore.remove(id);
  },

  /**
   * Delete a pet's notes (used by the pet-delete cascade, so no orphan notes
   * are left behind on the device).
   */
  async deleteForPet(petId: string): Promise<boolean> {
    const existing = await careInstructionsRepository.getForPet(petId);
    if (!existing) return false;
    return careInstructionsStore.remove(existing.id);
  },
};
