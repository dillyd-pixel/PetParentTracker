/**
 * React context that holds journal entries in memory, mirroring what's
 * persisted in AsyncStorage. Screens read journal state through this context
 * (via `useJournal()`), so when the data layer changes, the UI re-renders.
 *
 * Pure CRUD + per-pet listing + cascade — no notifications (a journal entry
 * is a record, not a schedule). Mirrors the ExpensesContext pattern: a
 * context, a provider, and a typed hook.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { journalRepository, journalStore } from '../storage/journal';
import type { JournalEntry, JournalEntryInput } from '../types';

interface JournalContextValue {
  /** Every journal entry, for all pets. */
  journalEntries: JournalEntry[];
  /** All entries belonging to one pet, newest first. */
  journalForPet: (petId: string) => JournalEntry[];
  /** Load all journal entries from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create a journal entry and return it. */
  addJournalEntry: (input: JournalEntryInput) => Promise<JournalEntry>;
  /** Update an existing journal entry. */
  updateJournalEntry: (
    id: string,
    changes: Partial<JournalEntryInput>,
  ) => Promise<JournalEntry | null>;
  /** Delete a journal entry. Returns true if something was removed. */
  deleteJournalEntry: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its journal entries. */
  deleteJournalForPet: (petId: string) => Promise<void>;
}

const JournalContext = createContext<JournalContextValue | undefined>(undefined);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);

  const refresh = useCallback(async () => {
    setJournalEntries(await journalRepository.list());
  }, []);

  const addJournalEntry = useCallback(async (input: JournalEntryInput) => {
    const entry = await journalRepository.create(input);
    setJournalEntries((prev) => [...prev, entry]);
    return entry;
  }, []);

  const updateJournalEntry = useCallback(
    async (id: string, changes: Partial<JournalEntryInput>) => {
      const updated = await journalRepository.update(id, changes);
      if (updated) {
        setJournalEntries((prev) =>
          prev.map((e) => (e.id === id ? updated : e)),
        );
      }
      return updated;
    },
    [],
  );

  const deleteJournalEntry = useCallback(async (id: string) => {
    const removed = await journalRepository.remove(id);
    if (removed) {
      setJournalEntries((prev) => prev.filter((e) => e.id !== id));
    }
    return removed;
  }, []);

  const deleteJournalForPet = useCallback(async (petId: string) => {
    const remaining = (await journalStore.getAll()).filter(
      (e) => e.petId !== petId,
    );
    await journalStore.setAll(remaining);
    setJournalEntries(remaining);
  }, []);

  /** Live (re-computed) per-pet listing — always up to date with `journalEntries`. */
  const journalForPet = useCallback(
    (petId: string) =>
      journalEntries
        .filter((e) => e.petId === petId)
        .sort(
          (a, b) =>
            b.entryDate.localeCompare(a.entryDate) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [journalEntries],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      journalEntries,
      journalForPet,
      refresh,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      deleteJournalForPet,
    }),
    [
      journalEntries,
      journalForPet,
      refresh,
      addJournalEntry,
      updateJournalEntry,
      deleteJournalEntry,
      deleteJournalForPet,
    ],
  );

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}

/** Hook for reading journal state anywhere inside JournalProvider. */
export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error('useJournal must be used within a JournalProvider');
  }
  return ctx;
}
