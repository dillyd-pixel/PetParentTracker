/**
 * React context that holds feeding schedule entries in memory, mirroring
 * what's persisted in AsyncStorage. Screens read feeding state through this
 * context (via `useFeeding()`), so when the data layer changes, the UI
 * re-renders.
 *
 * No notifications: feeding entries are a plain schedule (unlike
 * medications), so this context is pure CRUD + per-pet listing + cascade.
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

import { feedingRepository, feedingStore } from '../storage/feeding';
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
    return entry;
  }, []);

  const updateFeeding = useCallback(
    async (id: string, changes: Partial<FeedingScheduleInput>) => {
      const updated = await feedingRepository.update(id, changes);
      if (updated) {
        setFeedingSchedules((prev) => prev.map((f) => (f.id === id ? updated : f)));
      }
      return updated;
    },
    [],
  );

  const deleteFeeding = useCallback(async (id: string) => {
    const removed = await feedingRepository.remove(id);
    if (removed) {
      setFeedingSchedules((prev) => prev.filter((f) => f.id !== id));
    }
    return removed;
  }, []);

  const deleteFeedingForPet = useCallback(async (petId: string) => {
    const remaining = (await feedingRepository.list()).filter(
      (f) => f.petId !== petId,
    );
    await feedingStore.setAll(remaining);
    setFeedingSchedules(remaining);
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
    }),
    [
      feedingSchedules,
      feedingForPet,
      refresh,
      addFeeding,
      updateFeeding,
      deleteFeeding,
      deleteFeedingForPet,
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
