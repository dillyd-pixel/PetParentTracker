/**
 * React context that holds the care check-in log in memory, mirroring what is
 * persisted in AsyncStorage. The Daily Care Ring reads its "done today" state
 * through this context (via `useCheckIns()`), so a tap re-renders immediately
 * and — because the event is written to the device first — the state is still
 * there after a restart.
 *
 * Following the pattern of the module contexts (Pet, Feeding, Vaccines…): a
 * context, a provider, a typed hook. Unlike those, a check-in has no derived
 * notification side effects: it is a record of something that already happened.
 *
 * 100% offline: AsyncStorage only — no network, no analytics.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { checkInRepository, doneTypesOn } from '../storage/checkIns';
import { careCheckInIsOn } from '../types/checkIn';
import type {
  CareCheckInEvent,
  CareCheckInInput,
  CareCheckInType,
} from '../types/checkIn';

/** What a toggle did, so the caller can react (e.g. show a cheer). */
export type CheckInToggleResult = 'added' | 'removed';

interface CheckInsContextValue {
  /** Every check-in on this device, for every pet. */
  checkIns: CareCheckInEvent[];
  /** Load the log from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Record a check-in and return it (also used by Sitter Mode later). */
  addCheckIn: (input: CareCheckInInput) => Promise<CareCheckInEvent>;
  /** Delete one check-in by id. Returns true if something was removed. */
  removeCheckIn: (id: string) => Promise<boolean>;
  /**
   * Tick or untick one act for one pet *on one local day*. Ticks by writing an
   * event; unticking removes that day's event(s) for the act, so the log stays
   * truthful about what was recorded (nothing is kept as a "not done" row).
   */
  toggleCheckIn: (
    petId: string,
    type: CareCheckInType,
    dayKey: string,
    zone?: string,
  ) => Promise<CheckInToggleResult>;
  /** The acts already recorded for a pet on a local day (newest state). */
  doneTypesFor: (petId: string, dayKey: string, zone?: string) => CareCheckInType[];
  /** When a pet is deleted, drop its whole check-in history. */
  deleteCheckInsForPet: (petId: string) => Promise<void>;
}

const CheckInsContext = createContext<CheckInsContextValue | undefined>(undefined);

export function CheckInsProvider({ children }: { children: React.ReactNode }) {
  const [checkIns, setCheckIns] = useState<CareCheckInEvent[]>([]);

  const refresh = useCallback(async () => {
    setCheckIns(await checkInRepository.list());
  }, []);

  const addCheckIn = useCallback(async (input: CareCheckInInput) => {
    const event = await checkInRepository.create(input);
    setCheckIns((prev) => [...prev, event]);
    return event;
  }, []);

  const removeCheckIn = useCallback(async (id: string) => {
    const removed = await checkInRepository.remove(id);
    if (removed) {
      setCheckIns((prev) => prev.filter((event) => event.id !== id));
    }
    return removed;
  }, []);

  const doneTypesFor = useCallback(
    (petId: string, dayKey: string, zone?: string) =>
      doneTypesOn(checkIns, petId, dayKey, zone),
    [checkIns],
  );

  const toggleCheckIn = useCallback(
    async (
      petId: string,
      type: CareCheckInType,
      dayKey: string,
      zone?: string,
    ): Promise<CheckInToggleResult> => {
      const existing = checkIns.filter(
        (event) =>
          event.petId === petId &&
          event.type === type &&
          careCheckInIsOn(event, dayKey, zone),
      );
      if (existing.length > 0) {
        const ids = new Set(existing.map((event) => event.id));
        await Promise.all(existing.map((event) => checkInRepository.remove(event.id)));
        setCheckIns((prev) => prev.filter((event) => !ids.has(event.id)));
        return 'removed';
      }
      const event = await checkInRepository.create({
        petId,
        type,
        at: new Date().toISOString(),
        source: 'owner',
      });
      setCheckIns((prev) => [...prev, event]);
      return 'added';
    },
    [checkIns],
  );

  const deleteCheckInsForPet = useCallback(async (petId: string) => {
    await checkInRepository.removeForPet(petId);
    setCheckIns((prev) => prev.filter((event) => event.petId !== petId));
  }, []);

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      checkIns,
      refresh,
      addCheckIn,
      removeCheckIn,
      toggleCheckIn,
      doneTypesFor,
      deleteCheckInsForPet,
    }),
    [
      checkIns,
      refresh,
      addCheckIn,
      removeCheckIn,
      toggleCheckIn,
      doneTypesFor,
      deleteCheckInsForPet,
    ],
  );

  return <CheckInsContext.Provider value={value}>{children}</CheckInsContext.Provider>;
}

/** Hook for reading the check-in log anywhere inside CheckInsProvider. */
export function useCheckIns(): CheckInsContextValue {
  const ctx = useContext(CheckInsContext);
  if (!ctx) {
    throw new Error('useCheckIns must be used within a CheckInsProvider');
  }
  return ctx;
}
