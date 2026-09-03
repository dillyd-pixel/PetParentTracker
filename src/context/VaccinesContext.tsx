/**
 * React context that holds vaccine records in memory, mirroring what's
 * persisted in AsyncStorage. Screens read vaccine state through this context
 * (via `useVaccines()`), so when the data layer changes, the UI re-renders.
 *
 * Following the PetContext pattern: a context, a provider, and a typed hook.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { vaccineRepository, vaccineStore } from '../storage/vaccines';
import type { Vaccine, VaccineInput } from '../types';

interface VaccinesContextValue {
  /** Every vaccine record, for all pets. */
  vaccines: Vaccine[];
  /** All vaccines belonging to one pet, newest first. */
  vaccinesForPet: (petId: string) => Vaccine[];
  /** Load all vaccines from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create a vaccine record and return it. */
  addVaccine: (input: VaccineInput) => Promise<Vaccine>;
  /** Update an existing vaccine record. */
  updateVaccine: (
    id: string,
    changes: Partial<VaccineInput>,
  ) => Promise<Vaccine | null>;
  /** Delete a vaccine record. Returns true if something was removed. */
  deleteVaccine: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its vaccine records. */
  deleteVaccinesForPet: (petId: string) => Promise<void>;
}

const VaccinesContext = createContext<VaccinesContextValue | undefined>(undefined);

export function VaccinesProvider({ children }: { children: React.ReactNode }) {
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);

  const refresh = useCallback(async () => {
    setVaccines(await vaccineRepository.list());
  }, []);

  const addVaccine = useCallback(async (input: VaccineInput) => {
    const vaccine = await vaccineRepository.create(input);
    setVaccines((prev) => [...prev, vaccine]);
    return vaccine;
  }, []);

  const updateVaccine = useCallback(
    async (id: string, changes: Partial<VaccineInput>) => {
      const updated = await vaccineRepository.update(id, changes);
      if (updated) {
        setVaccines((prev) => prev.map((v) => (v.id === id ? updated : v)));
      }
      return updated;
    },
    [],
  );

  const deleteVaccine = useCallback(async (id: string) => {
    const removed = await vaccineRepository.remove(id);
    if (removed) {
      setVaccines((prev) => prev.filter((v) => v.id !== id));
    }
    return removed;
  }, []);

  const deleteVaccinesForPet = useCallback(async (petId: string) => {
    const remaining = (await vaccineRepository.list()).filter(
      (v) => v.petId !== petId,
    );
    await vaccineStore.setAll(remaining);
    setVaccines(remaining);
  }, []);

  /** Live (re-computed) per-pet listing — always up to date with `vaccines`. */
  const vaccinesForPet = useCallback(
    (petId: string) =>
      vaccines
        .filter((v) => v.petId === petId)
        .sort(
          (a, b) =>
            b.dateGiven.localeCompare(a.dateGiven) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [vaccines],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      vaccines,
      vaccinesForPet,
      refresh,
      addVaccine,
      updateVaccine,
      deleteVaccine,
      deleteVaccinesForPet,
    }),
    [
      vaccines,
      vaccinesForPet,
      refresh,
      addVaccine,
      updateVaccine,
      deleteVaccine,
      deleteVaccinesForPet,
    ],
  );

  return (
    <VaccinesContext.Provider value={value}>{children}</VaccinesContext.Provider>
  );
}

/** Hook for reading vaccine state anywhere inside VaccinesProvider. */
export function useVaccines(): VaccinesContextValue {
  const ctx = useContext(VaccinesContext);
  if (!ctx) {
    throw new Error('useVaccines must be used within a VaccinesProvider');
  }
  return ctx;
}