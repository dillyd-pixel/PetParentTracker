/**
 * Journal data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<JournalEntry>` into a small typed API the
 * JournalContext and screens use, mirroring how `expenseRepository` wraps the
 * expenses collection. Each record carries the owning pet's id, so filtering
 * by pet is a pure in-memory operation — no extra storage keys, no network.
 * `deleteByPet` exists so the pet-deletion cascade can drop every journal
 * entry in one storage write.
 */
import { CollectionStore } from './storage';
import type { JournalEntry, JournalEntryInput } from '../types';

/** Persisted collection of journal entries (all pets). */
export const journalStore = new CollectionStore<JournalEntry>('journal-entries');

/** All CRUD + per-pet listing operations for journal entries. */
export const journalRepository = {
  /** Every journal entry (all pets). */
  list(): Promise<JournalEntry[]> {
    return journalStore.getAll();
  },

  /** All entries for one pet, newest first (entryDate, then createdAt). */
  listByPet(petId: string): Promise<JournalEntry[]> {
    return journalStore.getAll().then((all) =>
      all
        .filter((e) => e.petId === petId)
        .sort(
          (a, b) =>
            b.entryDate.localeCompare(a.entryDate) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    );
  },

  get(id: string): Promise<JournalEntry | null> {
    return journalStore.findById(id);
  },

  /** Persist a new journal entry. */
  create(input: JournalEntryInput): Promise<JournalEntry> {
    return journalStore.create(input as JournalEntry);
  },

  /** Update selected fields of an entry by id. Returns null if not found. */
  update(
    id: string,
    changes: Partial<JournalEntryInput>,
  ): Promise<JournalEntry | null> {
    return journalStore.update(id, changes);
  },

  /** Delete a journal entry by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return journalStore.remove(id);
  },

  /** Delete every entry belonging to a pet (used by the pet-delete cascade). */
  async deleteByPet(petId: string): Promise<void> {
    const remaining = (await journalStore.getAll()).filter(
      (e) => e.petId !== petId,
    );
    await journalStore.setAll(remaining);
  },
};
