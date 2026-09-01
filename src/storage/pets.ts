/**
 * Pet data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<Pet>` and the active-pet `KeyValueStore` into a
 * small typed API the screens and PetContext use. Because CollectionStore is
 * generic, a future module creates an analogous repository for its entity and
 * plugs it into the same storage.
 */
import { CollectionStore, KeyValueStore } from './storage';
import type { Pet, PetInput } from '../types';

/** Persisted collection of pets. */
export const petStore = new CollectionStore<Pet>('pets');

/** Meta store holding the id of the currently active pet. */
export const activePetStore = new KeyValueStore('activePetId');

/** All CRUD + active-pet operations for pets. */
export const petRepository = {
  list(): Promise<Pet[]> {
    return petStore.getAll();
  },

  get(id: string): Promise<Pet | null> {
    return petStore.findById(id);
  },

  update(id: string, changes: Partial<PetInput>): Promise<Pet | null> {
    return petStore.update(id, changes);
  },

  remove(id: string): Promise<boolean> {
    return petStore.remove(id);
  },

  /** Persist a new pet. */
  create(input: PetInput): Promise<Pet> {
    return petStore.create(input as Pet);
  },
};

/** Active-pet operations. */
export const activePet = {
  getId(): Promise<string | null> {
    return activePetStore.get();
  },

  setId(id: string): Promise<void> {
    return activePetStore.set(id);
  },

  clear(): Promise<void> {
    return activePetStore.remove();
  },
};
