/**
 * React context that holds feeding schedule entries in memory, mirroring
 * what's persisted in AsyncStorage. Screens read feeding state through this
 * context (via `useFeeding()`), so when the data layer changes, the UI
 * re-renders.
 *
 * Whenever a feeding entry is created, updated, or deleted, its local
 * mealtime reminder notifications are re-scheduled or cancelled through the
 * notifications helper (all local scheduling — no server, no push).
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

import { feedingRepository, feedingStore } from '../storage/feeding';
import {
  cancelFeedingReminders,
  getNotificationIdsForFeeding,
  scheduleFeedingReminders,
} from '../storage/notifications';
import type { FeedingSchedule, FeedingScheduleInput } from '../types';

interface FeedingContextValue {
  /** Every feeding entry, for all pets. */
  feedingSchedules: FeedingSchedule[];
  /** All feeding entries belonging to one pet, sorted by time. */
  feedingForPet: (petId: string) => FeedingSchedule[];
  /** Load all feeding entries from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create a feeding entry and return it. */
  addFeeding: (input: FeedingScheduleInput) => Promise<FeedingSchedule>;
  /** Update an existing feeding entry. */
  updateFeeding: (
    id: string,
    changes: Partial<FeedingScheduleInput>,
  ) => Promise<FeedingSchedule | null>;
  /** Delete a feeding entry. Returns true if something was removed. */
  deleteFeeding: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its feeding entries. */
  deleteFeedingForPet: (petId: string) => Promise<void>;
  /** Toggle reminders on/off for one feeding entry without a full edit. */
  toggleFeedingReminders: (
    id: string,
    enabled: boolean,
  ) => Promise<FeedingSchedule | null>;
  /**
   * All notification ids currently scheduled for one feeding entry (from the
   * AsyncStorage id map). Empty list on web — nothing is ever scheduled there.
   */
  scheduledFeedingNotificationIds: (feedingId: string) => Promise<string[]>;
}

const FeedingContext = createContext<FeedingContextValue | undefined>(undefined);

export function FeedingProvider({ children }: { children: React.ReactNode }) {
  const [feedingSchedules, setFeedingSchedules] = useState<FeedingSchedule[]>([]);

  const refresh = useCallback(async () => {
    setFeedingSchedules(await feedingRepository.list());
  }, []);

  const addFeeding = useCallback(async (input: FeedingScheduleInput) => {
    const entry = await feedingRepository.create(input);
    setFeedingSchedules((prev) => [...prev, entry]);
    // Local mealtime reminders, scheduled by the entry's own id.
    try {
      await scheduleFeedingReminders(entry);
    } catch {
      // Scheduling must never fail a save — the record is already persisted.
    }
    return entry;
  }, []);

  const updateFeeding = useCallback(
    async (id: string, changes: Partial<FeedingScheduleInput>) => {
      const updated = await feedingRepository.update(id, changes);
      if (updated) {
        setFeedingSchedules((prev) => prev.map((f) => (f.id === id ? updated : f)));
        try {
          await scheduleFeedingReminders(updated);
        } catch {
          // Non-fatal; the record update is already persisted.
        }
      }
      return updated;
    },
    [],
  );

  const toggleFeedingReminders = useCallback(
    async (id: string, enabled: boolean) => {
      const updated = await feedingRepository.update(id, {
        reminderEnabled: enabled,
      });
      if (updated) {
        setFeedingSchedules((prev) => prev.map((f) => (f.id === id ? updated : f)));
        try {
          await scheduleFeedingReminders(updated);
        } catch {
          // Non-fatal; the toggle is persisted.
        }
      }
      return updated;
    },
    [],
  );

  const deleteFeeding = useCallback(async (id: string) => {
    // Drop the reminders first so a failed delete leaves nothing scheduled.
    try {
      await cancelFeedingReminders(id);
    } catch {
      // Non-fatal: proceeding with the record delete regardless.
    }
    const removed = await feedingRepository.remove(id);
    if (removed) {
      setFeedingSchedules((prev) => prev.filter((f) => f.id !== id));
    }
    return removed;
  }, []);

  const deleteFeedingForPet = useCallback(async (petId: string) => {
    // Compute what's being removed BEFORE rewriting the store, so we still
    // know which entries to cancel notifications for.
    const all = await feedingRepository.list();
    const removed = all.filter((f) => f.petId === petId);
    const remaining = all.filter((f) => f.petId !== petId);
    await feedingStore.setAll(remaining);
    setFeedingSchedules(remaining);
    // Cancel every notification belonging to the deleted pet's entries too.
    try {
      await Promise.all(
        removed.map((f) => cancelFeedingReminders(f.id).catch(() => undefined)),
      );
    } catch {
      // Non-fatal: data is already gone.
    }
  }, []);

  const scheduledFeedingNotificationIds = useCallback((feedingId: string) => {
    // Web preview never schedules anything — report an empty list.
    if (Platform.OS === 'web') return Promise.resolve([]);
    return getNotificationIdsForFeeding(feedingId);
  }, []);

  /** Live (re-computed) per-pet listing — always up to date with `feedingSchedules`. */
  const feedingForPet = useCallback(
    (petId: string) =>
      feedingSchedules
        .filter((f) => f.petId === petId)
        .sort(
          (a, b) =>
            a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt),
        ),
    [feedingSchedules],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      feedingSchedules,
      feedingForPet,
      refresh,
      addFeeding,
      updateFeeding,
      deleteFeeding,
      deleteFeedingForPet,
      toggleFeedingReminders,
      scheduledFeedingNotificationIds,
    }),
    [
      feedingSchedules,
      feedingForPet,
      refresh,
      addFeeding,
      updateFeeding,
      deleteFeeding,
      deleteFeedingForPet,
      toggleFeedingReminders,
      scheduledFeedingNotificationIds,
    ],
  );

  return (
    <FeedingContext.Provider value={value}>{children}</FeedingContext.Provider>
  );
}

/** Hook for reading feeding state anywhere inside FeedingProvider. */
export function useFeeding(): FeedingContextValue {
  const ctx = useContext(FeedingContext);
  if (!ctx) {
    throw new Error('useFeeding must be used within a FeedingProvider');
  }
  return ctx;
}
