/**
 * Vaccine data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<Vaccine>` into a small typed API the VaccinesContext
 * and screens use, mirroring how `petRepository` wraps the pet collection.
 * Because each record carries the owning pet's id, filtering by pet is a pure
 * in-memory operation — no extra storage keys, no network.
 */
import { CollectionStore } from './storage';
import type { Vaccine, VaccineInput } from '../types';

/** Persisted collection of vaccine records. */
export const vaccineStore = new CollectionStore<Vaccine>('vaccines');

/** All CRUD + per-pet listing operations for vaccines. */
export const vaccineRepository = {
  /** Every vaccine record (all pets). */
  list(): Promise<Vaccine[]> {
    return vaccineStore.getAll();
  },

  /** All vaccines for one pet, newest first (by date given, then created). */
  listByPet(petId: string): Promise<Vaccine[]> {
    return vaccineStore.getAll().then((all) =>
      all
        .filter((v) => v.petId === petId)
        .sort(
          (a, b) =>
            b.dateGiven.localeCompare(a.dateGiven) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    );
  },

  get(id: string): Promise<Vaccine | null> {
    return vaccineStore.findById(id);
  },

  /** Persist a new vaccine record. */
  create(input: VaccineInput): Promise<Vaccine> {
    return vaccineStore.create(input as Vaccine);
  },

  /** Update selected fields of a vaccine by id. Returns null if not found. */
  update(id: string, changes: Partial<VaccineInput>): Promise<Vaccine | null> {
    return vaccineStore.update(id, changes);
  },

  /** Delete a vaccine record by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return vaccineStore.remove(id);
  },
};