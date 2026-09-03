/**
 * Medication data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<Medication>` into a small typed API the
 * MedicationsContext and screens use, mirroring how `vaccineRepository` wraps
 * the vaccine collection. Because each record carries the owning pet's id,
 * filtering by pet is a pure in-memory operation — no extra storage keys, no
 * network.
 */
import { CollectionStore } from './storage';
import type { Medication, MedicationInput } from '../types';

/** Persisted collection of medication records (all pets). */
export const medicationStore = new CollectionStore<Medication>('medications');

/** All CRUD + per-pet listing operations for medications. */
export const medicationRepository = {
  /** Every medication record (all pets). */
  list(): Promise<Medication[]> {
    return medicationStore.getAll();
  },

  /** All medications for one pet, most recently created first. */
  listByPet(petId: string): Promise<Medication[]> {
    return medicationStore.getAll().then((all) =>
      all
        .filter((m) => m.petId === petId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },

  get(id: string): Promise<Medication | null> {
    return medicationStore.findById(id);
  },

  /** Persist a new medication record. */
  create(input: MedicationInput): Promise<Medication> {
    return medicationStore.create(input as Medication);
  },

  /** Update selected fields of a medication by id. Returns null if not found. */
  update(id: string, changes: Partial<MedicationInput>): Promise<Medication | null> {
    return medicationStore.update(id, changes);
  },

  /** Delete a medication record by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return medicationStore.remove(id);
  },
};