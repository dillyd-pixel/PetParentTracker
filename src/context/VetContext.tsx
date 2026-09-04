/**
 * React context that holds vet records in memory, mirroring what's persisted
 * in AsyncStorage. Screens read vet state through this context (via
 * `useVetRecords()`), so when the data layer changes, the UI re-renders.
 *
 * Pure CRUD + per-pet listing + cascade — no notifications (vet visits are a
 * record, not a schedule). Mirrors the FeedingContext pattern: a context, a
 * provider, and a typed hook.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { vetRepository, vetStore } from '../storage/vet';
import type { VetRecord, VetRecordInput } from '../types';

interface VetContextValue {
  /** Every vet record, for all pets. */
  vetRecords: VetRecord[];
  /** All vet records belonging to one pet, newest visit first. */
  vetRecordsForPet: (petId: string) => VetRecord[];
  /** Load all vet records from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create a vet record and return it. */
  addVetRecord: (input: VetRecordInput) => Promise<VetRecord>;
  /** Update an existing vet record. */
  updateVetRecord: (
    id: string,
    changes: Partial<VetRecordInput>,
  ) => Promise<VetRecord | null>;
  /** Delete a vet record. Returns true if something was removed. */
  deleteVetRecord: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its vet records. */
  deleteVetRecordsForPet: (petId: string) => Promise<void>;
}

const VetContext = createContext<VetContextValue | undefined>(undefined);

export function VetProvider({ children }: { children: React.ReactNode }) {
  const [vetRecords, setVetRecords] = useState<VetRecord[]>([]);

  const refresh = useCallback(async () => {
    setVetRecords(await vetRepository.list());
  }, []);

  const addVetRecord = useCallback(async (input: VetRecordInput) => {
    const record = await vetRepository.create(input);
    setVetRecords((prev) => [...prev, record]);
    return record;
  }, []);

  const updateVetRecord = useCallback(
    async (id: string, changes: Partial<VetRecordInput>) => {
      const updated = await vetRepository.update(id, changes);
      if (updated) {
        setVetRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
      return updated;
    },
    [],
  );

  const deleteVetRecord = useCallback(async (id: string) => {
    const removed = await vetRepository.remove(id);
    if (removed) {
      setVetRecords((prev) => prev.filter((r) => r.id !== id));
    }
    return removed;
  }, []);

  const deleteVetRecordsForPet = useCallback(async (petId: string) => {
    const remaining = (await vetRepository.list()).filter(
      (r) => r.petId !== petId,
    );
    await vetStore.setAll(remaining);
    setVetRecords(remaining);
  }, []);

  /** Live (re-computed) per-pet listing — always up to date with `vetRecords`. */
  const vetRecordsForPet = useCallback(
    (petId: string) =>
      vetRecords
        .filter((r) => r.petId === petId)
        .sort(
          (a, b) =>
            b.visitDate.localeCompare(a.visitDate) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [vetRecords],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      vetRecords,
      vetRecordsForPet,
      refresh,
      addVetRecord,
      updateVetRecord,
      deleteVetRecord,
      deleteVetRecordsForPet,
    }),
    [
      vetRecords,
      vetRecordsForPet,
      refresh,
      addVetRecord,
      updateVetRecord,
      deleteVetRecord,
      deleteVetRecordsForPet,
    ],
  );

  return (
    <VetContext.Provider value={value}>{children}</VetContext.Provider>
  );
}

/** Hook for reading vet state anywhere inside VetProvider. */
export function useVetRecords(): VetContextValue {
  const ctx = useContext(VetContext);
  if (!ctx) {
    throw new Error('useVetRecords must be used within a VetProvider');
  }
  return ctx;
}
