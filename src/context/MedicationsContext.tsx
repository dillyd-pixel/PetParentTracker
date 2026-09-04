/**
 * React context that holds medication records in memory, mirroring what's
 * persisted in AsyncStorage. Screens read medication state through this
 * context (via `useMedications()`), so when the data layer changes, the UI
 * re-renders.
 *
 * Whenever a medication is created, updated, or deleted, its local reminder
 * notifications are re-scheduled or cancelled through the notifications
 * helper (all local scheduling — no server, no push).
 *
 * Following the VaccinesContext pattern: a context, a provider, and a typed
 * hook.
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
  cancelMedicationReminders,
  getNotificationIdsForMedication,
  hasNotificationPermission,
  scheduleMedicationReminders,
} from '../storage/notifications';
import { medicationRepository, medicationStore } from '../storage/medications';
import type { Medication, MedicationInput } from '../types';

/** Notifications are native-only: web preview reports "no notifications". */
const NOTIFICATIONS_SUPPORTED = Platform.OS !== 'web';

interface MedicationsContextValue {
  /** Every medication record, for all pets. */
  medications: Medication[];
  /** All medications belonging to one pet, newest first. */
  medicationsForPet: (petId: string) => Medication[];
  /** Nominal "granted" flag: false on web preview (no notifications at all). */
  notificationPermission: boolean;
  /**
   * Re-check the notification permission and update the flag. On web this
   * always reports false — the browser preview has no notification center.
   */
  refreshNotificationPermission: () => Promise<void>;
  /** Load all medications from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /**
   * All notification ids currently scheduled for one medication (from the
   * AsyncStorage id map), used by the screen to show whether reminders are
   * actually armed. Empty list on web — nothing is ever scheduled there.
   */
  scheduledNotificationIds: (medicationId: string) => Promise<string[]>;
  /** Create a medication, schedule its reminders, and return it. */
  addMedication: (input: MedicationInput) => Promise<Medication>;
  /** Update a medication and re-schedule its reminders. */
  updateMedication: (
    id: string,
    changes: Partial<MedicationInput>,
  ) => Promise<Medication | null>;
  /** Delete a medication and cancel its scheduled notifications. */
  deleteMedication: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its medication records. */
  deleteMedicationsForPet: (petId: string) => Promise<void>;
  /** Toggle reminders on/off for one medication without a full edit. */
  toggleMedicationReminders: (
    id: string,
    enabled: boolean,
  ) => Promise<Medication | null>;
}

const MedicationsContext = createContext<MedicationsContextValue | undefined>(
  undefined,
);

/** Whether the device lets us post local notifications right now. */
async function computePermission(): Promise<boolean> {
  if (!NOTIFICATIONS_SUPPORTED) return false;
  return hasNotificationPermission();
}

export function MedicationsProvider({ children }: { children: React.ReactNode }) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [notificationPermission, setNotificationPermission] = useState(false);

  const refresh = useCallback(async () => {
    setMedications(await medicationRepository.list());
    setNotificationPermission(await computePermission());
  }, []);

  const refreshNotificationPermission = useCallback(async () => {
    setNotificationPermission(await computePermission());
  }, []);

  const addMedication = useCallback(async (input: MedicationInput) => {
    const medication = await medicationRepository.create(input);
    setMedications((prev) => [...prev, medication]);
    // Local reminders, scheduled by the med's own id (id map is keyed on it).
    try {
      await scheduleMedicationReminders(medication);
      // Permission may have changed during the request.
      setNotificationPermission(await computePermission());
    } catch {
      // Scheduling must never fail a save — the record is already persisted.
    }
    return medication;
  }, []);

  const updateMedication = useCallback(
    async (id: string, changes: Partial<MedicationInput>) => {
      const updated = await medicationRepository.update(id, changes);
      if (updated) {
        setMedications((prev) => prev.map((m) => (m.id === id ? updated : m)));
        try {
          await scheduleMedicationReminders(updated);
          setNotificationPermission(await computePermission());
        } catch {
          // Non-fatal; the record update is already persisted.
        }
      }
      return updated;
    },
    [],
  );

  const toggleMedicationReminders = useCallback(
    async (id: string, enabled: boolean) => {
      const updated = await medicationRepository.update(id, {
        remindersEnabled: enabled,
      });
      if (updated) {
        setMedications((prev) => prev.map((m) => (m.id === id ? updated : m)));
        try {
          await scheduleMedicationReminders(updated);
          setNotificationPermission(await computePermission());
        } catch {
          // Non-fatal; the toggle is persisted.
        }
      }
      return updated;
    },
    [],
  );

  const deleteMedication = useCallback(async (id: string) => {
    // Drop the reminders first so a failed delete leaves nothing scheduled.
    try {
      await cancelMedicationReminders(id);
    } catch {
      // Non-fatal: proceeding with the record delete regardless.
    }
    const removed = await medicationRepository.remove(id);
    if (removed) {
      setMedications((prev) => prev.filter((m) => m.id !== id));
    }
    return removed;
  }, []);

  const deleteMedicationsForPet = useCallback(async (petId: string) => {
    // Compute what's being removed BEFORE rewriting the store, so we still
    // know which meds to cancel notifications for.
    const all = await medicationRepository.list();
    const removed = all.filter((m) => m.petId === petId);
    const remaining = all.filter((m) => m.petId !== petId);
    await medicationStore.setAll(remaining);
    setMedications(remaining);
    // Cancel every notification belonging to the deleted pet's meds too.
    try {
      await Promise.all(
        removed.map((m) =>
          cancelMedicationReminders(m.id).catch(() => undefined),
        ),
      );
    } catch {
      // Non-fatal: data is already gone.
    }
  }, []);

  const medicationsForPet = useCallback(
    (petId: string) =>
      medications
        .filter((m) => m.petId === petId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [medications],
  );

  const scheduledNotificationIds = useCallback(
    (medicationId: string) =>
      NOTIFICATIONS_SUPPORTED
        ? getNotificationIdsForMedication(medicationId)
        : Promise.resolve([]),
    [],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      medications,
      medicationsForPet,
      notificationPermission,
      refresh,
      refreshNotificationPermission,
      scheduledNotificationIds,
      addMedication,
      updateMedication,
      deleteMedication,
      deleteMedicationsForPet,
      toggleMedicationReminders,
    }),
    [
      medications,
      medicationsForPet,
      notificationPermission,
      refresh,
      refreshNotificationPermission,
      scheduledNotificationIds,
      addMedication,
      updateMedication,
      deleteMedication,
      deleteMedicationsForPet,
      toggleMedicationReminders,
    ],
  );

  return (
    <MedicationsContext.Provider value={value}>
      {children}
    </MedicationsContext.Provider>
  );
}

/** Hook for reading medication state anywhere inside MedicationsProvider. */
export function useMedications(): MedicationsContextValue {
  const ctx = useContext(MedicationsContext);
  if (!ctx) {
    throw new Error('useMedications must be used within a MedicationsProvider');
  }
  return ctx;
}