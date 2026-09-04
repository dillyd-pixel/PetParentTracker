/**
 * Vet records data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<VetRecord>` into a small typed API the VetContext
 * and screens use, mirroring how `feedingRepository` wraps the feeding
 * collection. Because each record carries the owning pet's id, filtering by
 * pet is a pure in-memory operation — no extra storage keys, no network.
 */
import { CollectionStore } from './storage';
import type { VetRecord, VetRecordInput } from '../types';

/** Persisted collection of vet records (all pets). */
export const vetStore = new CollectionStore<VetRecord>('vet-records');

/** All CRUD + per-pet listing operations for vet records. */
export const vetRepository = {
  /** Every vet record (all pets). */
  list(): Promise<VetRecord[]> {
    return vetStore.getAll();
  },

  /** All vet records for one pet, sorted by visit date (newest first). */
  listByPet(petId: string): Promise<VetRecord[]> {
    return vetStore.getAll().then((all) =>
      all
        .filter((r) => r.petId === petId)
        .sort(
          (a, b) =>
            b.visitDate.localeCompare(a.visitDate) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    );
  },

  get(id: string): Promise<VetRecord | null> {
    return vetStore.findById(id);
  },

  /** Persist a new vet record. */
  create(input: VetRecordInput): Promise<VetRecord> {
    return vetStore.create(input as VetRecord);
  },

  /** Update selected fields of a vet record by id. Returns null if not found. */
  update(
    id: string,
    changes: Partial<VetRecordInput>,
  ): Promise<VetRecord | null> {
    return vetStore.update(id, changes);
  },

  /** Delete a vet record by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return vetStore.remove(id);
  },
};
