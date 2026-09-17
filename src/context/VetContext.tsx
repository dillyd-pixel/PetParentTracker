/**
 * React context that holds vet records in memory, mirroring what's persisted
 * in AsyncStorage. Screens read vet state through this context (via
 * `useVetRecords()`), so when the data layer changes, the UI re-renders.
 *
 * Pure CRUD + per-pet listing + cascade. Whenever a vet record is created,
 * updated, or deleted, its local appointment reminder notification is
 * re-scheduled or cancelled through the notifications helper (all local
 * scheduling — no server, no push). Mirrors the VaccinesContext/Vaccine
 * pattern: a context, a provider, and a typed hook.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import {
  cancelVetReminders,
  getNotificationIdsForVetRecord,
  scheduleVetReminders,
} from '../storage/notifications';
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
  /** Toggle the appointment reminder on/off for one visit without a full edit. */
  toggleVetReminders: (
    id: string,
    enabled: boolean,
  ) => Promise<VetRecord | null>;
  /**
   * All notification ids currently scheduled for one vet record (from the
   * AsyncStorage id map). Empty list on web — nothing is ever scheduled there.
   */
  scheduledVetNotificationIds: (vetRecordId: string) => Promise<string[]>;
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
    // Local appointment reminder, scheduled by the record's own id.
    try {
      await scheduleVetReminders(record);
    } catch {
      // Scheduling must never fail a save — the record is already persisted.
    }
    return record;
  }, []);

  const updateVetRecord = useCallback(
    async (id: string, changes: Partial<VetRecordInput>) => {
      const updated = await vetRepository.update(id, changes);
      if (updated) {
        setVetRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
        try {
          await scheduleVetReminders(updated);
        } catch {
          // Non-fatal; the record update is already persisted.
        }
      }
      return updated;
    },
    [],
  );

  const toggleVetReminders = useCallback(async (id: string, enabled: boolean) => {
    const updated = await vetRepository.update(id, {
      reminderEnabled: enabled,
    });
    if (updated) {
      setVetRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      try {
        await scheduleVetReminders(updated);
      } catch {
        // Non-fatal; the toggle is persisted.
      }
    }
    return updated;
  }, []);

  const deleteVetRecord = useCallback(async (id: string) => {
    // Drop the reminder first so a failed delete leaves nothing scheduled.
    try {
      await cancelVetReminders(id);
    } catch {
      // Non-fatal: proceeding with the record delete regardless.
    }
    const removed = await vetRepository.remove(id);
    if (removed) {
      setVetRecords((prev) => prev.filter((r) => r.id !== id));
    }
    return removed;
  }, []);

  const deleteVetRecordsForPet = useCallback(async (petId: string) => {
    // Compute what's being removed BEFORE rewriting the store, so we still
    // know which vet records to cancel notifications for.
    const all = await vetRepository.list();
    const removed = all.filter((r) => r.petId === petId);
    const remaining = all.filter((r) => r.petId !== petId);
    await vetStore.setAll(remaining);
    setVetRecords(remaining);
    // Cancel every notification belonging to the deleted pet's vet records too.
    try {
      await Promise.all(
        removed.map((r) => cancelVetReminders(r.id).catch(() => undefined)),
      );
    } catch {
      // Non-fatal: data is already gone.
    }
  }, []);

  const scheduledVetNotificationIds = useCallback((vetRecordId: string) => {
    // Web preview never schedules anything — report an empty list.
    if (Platform.OS === 'web') return Promise.resolve([]);
    return getNotificationIdsForVetRecord(vetRecordId);
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
      toggleVetReminders,
      scheduledVetNotificationIds,
    }),
    [
      vetRecords,
      vetRecordsForPet,
      refresh,
      addVetRecord,
      updateVetRecord,
      deleteVetRecord,
      deleteVetRecordsForPet,
      toggleVetReminders,
      scheduledVetNotificationIds,
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
