/**
 * React context that holds vaccine records in memory, mirroring what's
 * persisted in AsyncStorage. Screens read vaccine state through this context
 * (via `useVaccines()`), so when the data layer changes, the UI re-renders.
 *
 * Whenever a vaccine is created, updated, or deleted, its local due-date
 * reminder notification is re-scheduled or cancelled through the
 * notifications helper (all local scheduling — no server, no push).
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
import { Platform } from 'react-native';

import {
  cancelVaccineReminders,
  getNotificationIdsForVaccine,
  scheduleVaccineReminders,
} from '../storage/notifications';
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
  /** Toggle the due-date reminder on/off for one vaccine without a full edit. */
  toggleVaccineReminders: (
    id: string,
    enabled: boolean,
  ) => Promise<Vaccine | null>;
  /**
   * All notification ids currently scheduled for one vaccine (from the
   * AsyncStorage id map). Empty list on web — nothing is ever scheduled there.
   */
  scheduledVaccineNotificationIds: (vaccineId: string) => Promise<string[]>;
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
    // Local due-date reminder, scheduled by the vaccine's own id.
    try {
      await scheduleVaccineReminders(vaccine);
    } catch {
      // Scheduling must never fail a save — the record is already persisted.
    }
    return vaccine;
  }, []);

  const updateVaccine = useCallback(
    async (id: string, changes: Partial<VaccineInput>) => {
      const updated = await vaccineRepository.update(id, changes);
      if (updated) {
        setVaccines((prev) => prev.map((v) => (v.id === id ? updated : v)));
        try {
          await scheduleVaccineReminders(updated);
        } catch {
          // Non-fatal; the record update is already persisted.
        }
      }
      return updated;
    },
    [],
  );

  const toggleVaccineReminders = useCallback(
    async (id: string, enabled: boolean) => {
      const updated = await vaccineRepository.update(id, {
        reminderEnabled: enabled,
      });
      if (updated) {
        setVaccines((prev) => prev.map((v) => (v.id === id ? updated : v)));
        try {
          await scheduleVaccineReminders(updated);
        } catch {
          // Non-fatal; the toggle is persisted.
        }
      }
      return updated;
    },
    [],
  );

  const deleteVaccine = useCallback(async (id: string) => {
    // Drop the reminder first so a failed delete leaves nothing scheduled.
    try {
      await cancelVaccineReminders(id);
    } catch {
      // Non-fatal: proceeding with the record delete regardless.
    }
    const removed = await vaccineRepository.remove(id);
    if (removed) {
      setVaccines((prev) => prev.filter((v) => v.id !== id));
    }
    return removed;
  }, []);

  const deleteVaccinesForPet = useCallback(async (petId: string) => {
    // Compute what's being removed BEFORE rewriting the store, so we still
    // know which vaccines to cancel notifications for.
    const all = await vaccineRepository.list();
    const removed = all.filter((v) => v.petId === petId);
    const remaining = all.filter((v) => v.petId !== petId);
    await vaccineStore.setAll(remaining);
    setVaccines(remaining);
    // Cancel every notification belonging to the deleted pet's vaccines too.
    try {
      await Promise.all(
        removed.map((v) => cancelVaccineReminders(v.id).catch(() => undefined)),
      );
    } catch {
      // Non-fatal: data is already gone.
    }
  }, []);

  const scheduledVaccineNotificationIds = useCallback((vaccineId: string) => {
    // Web preview never schedules anything — report an empty list.
    if (Platform.OS === 'web') return Promise.resolve([]);
    return getNotificationIdsForVaccine(vaccineId);
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
      toggleVaccineReminders,
      scheduledVaccineNotificationIds,
    }),
    [
      vaccines,
      vaccinesForPet,
      refresh,
      addVaccine,
      updateVaccine,
      deleteVaccine,
      deleteVaccinesForPet,
      toggleVaccineReminders,
      scheduledVaccineNotificationIds,
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