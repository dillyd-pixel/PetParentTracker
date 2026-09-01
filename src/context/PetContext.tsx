/**
 * React context that holds the pet list and the active pet id in memory,
 * mirroring what's persisted in AsyncStorage. Every screen reads pet state
 * through this context, so when the data layer changes, the UI re-renders.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { activePet, petRepository } from '../storage/pets';
import type { Pet, PetInput } from '../types';

interface PetContextValue {
  /** All pets, sorted by creation time (newest not guaranteed; insertion order). */
  pets: Pet[];
  /** The currently active pet, or null if none. */
  activePet: Pet | null;
  /** Load the list + active pet from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create a pet and return it. */
  addPet: (input: PetInput) => Promise<Pet>;
  /** Update an existing pet. */
  updatePet: (id: string, changes: Partial<PetInput>) => Promise<Pet | null>;
  /** Delete a pet; if it was the active one, clears the active selection. */
  deletePet: (id: string) => Promise<boolean>;
  /** Set which pet is currently active (persisted). */
  selectPet: (id: string) => Promise<void>;
}

const PetContext = createContext<PetContextValue | undefined>(undefined);

export function PetProvider({ children }: { children: React.ReactNode }) {
  const [pets, setPets] = useState<Pet[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await petRepository.list();
    setPets(all);
    const id = await activePet.getId();
    setActivePetId(id);
  }, []);

  const addPet = useCallback(async (input: PetInput) => {
    const pet = await petRepository.create(input);
    setPets((prev) => [...prev, pet]);
    // First pet created becomes active automatically.
    const current = await activePet.getId();
    if (!current) {
      await activePet.setId(pet.id);
      setActivePetId(pet.id);
    }
    return pet;
  }, []);

  const updatePet = useCallback(
    async (id: string, changes: Partial<PetInput>) => {
      const updated = await petRepository.update(id, changes);
      if (updated) {
        setPets((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
      return updated;
    },
    [],
  );

  const deletePet = useCallback(async (id: string) => {
    const removed = await petRepository.remove(id);
    if (removed) {
      setPets((prev) => prev.filter((p) => p.id !== id));
      const current = await activePet.getId();
      if (current === id) {
        await activePet.clear();
        setActivePetId(null);
      }
    }
    return removed;
  }, []);

  const selectPet = useCallback(async (id: string) => {
    await activePet.setId(id);
    setActivePetId(id);
  }, []);

  const activePetRecord = useMemo(
    () => pets.find((p) => p.id === activePetId) ?? null,
    [pets, activePetId],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      pets,
      activePet: activePetRecord,
      refresh,
      addPet,
      updatePet,
      deletePet,
      selectPet,
    }),
    [pets, activePetRecord, refresh, addPet, updatePet, deletePet, selectPet],
  );

  return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

/** Hook for reading pet state anywhere inside PetProvider. */
export function usePets(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) {
    throw new Error('usePets must be used within a PetProvider');
  }
  return ctx;
}
