/**
 * Expenses data-access layer over the generic storage.
 *
 * Wraps `CollectionStore<Expense>` into a small typed API the ExpensesContext
 * and screens use, mirroring how `vetRepository` wraps the vet collection.
 * Each record carries the owning pet's id, so filtering by pet is a pure
 * in-memory operation — no extra storage keys, no network. `deleteByPet`
 * exists here (and on the Vet records) so the pet-deletion cascade can drop
 * every child record in one storage write.
 */
import { CollectionStore } from './storage';
import type { Expense, ExpenseInput } from '../types';

/** Persisted collection of expenses (all pets). */
export const expenseStore = new CollectionStore<Expense>('expenses');

/** All CRUD + per-pet listing operations for expenses. */
export const expenseRepository = {
  /** Every expense (all pets). */
  list(): Promise<Expense[]> {
    return expenseStore.getAll();
  },

  /** All expenses for one pet, sorted by date (newest first). */
  listByPet(petId: string): Promise<Expense[]> {
    return expenseStore.getAll().then((all) =>
      all
        .filter((e) => e.petId === petId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
        ),
    );
  },

  get(id: string): Promise<Expense | null> {
    return expenseStore.findById(id);
  },

  /** Persist a new expense. */
  create(input: ExpenseInput): Promise<Expense> {
    return expenseStore.create(input as Expense);
  },

  /** Update selected fields of an expense by id. Returns null if not found. */
  update(
    id: string,
    changes: Partial<ExpenseInput>,
  ): Promise<Expense | null> {
    return expenseStore.update(id, changes);
  },

  /** Delete an expense by id. Returns true if something was removed. */
  remove(id: string): Promise<boolean> {
    return expenseStore.remove(id);
  },

  /** Delete every expense belonging to a pet (used by the pet-delete cascade). */
  async deleteByPet(petId: string): Promise<void> {
    const remaining = (await expenseStore.getAll()).filter(
      (e) => e.petId !== petId,
    );
    await expenseStore.setAll(remaining);
  },
};