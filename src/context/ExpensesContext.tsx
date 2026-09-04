/**
 * React context that holds expenses in memory, mirroring what's persisted in
 * AsyncStorage. Screens read expense state through this context (via
 * `useExpenses()`), so when the data layer changes, the UI re-renders.
 *
 * Pure CRUD + per-pet listing + cascade — no notifications (an expense is a
 * record, not a schedule). Mirrors the VetContext pattern: a context, a
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

import { expenseRepository, expenseStore } from '../storage/expenses';
import type { Expense, ExpenseInput } from '../types';

interface ExpensesContextValue {
  /** Every expense, for all pets. */
  expenses: Expense[];
  /** All expenses belonging to one pet, newest date first. */
  expensesForPet: (petId: string) => Expense[];
  /** Load all expenses from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** Create an expense and return it. */
  addExpense: (input: ExpenseInput) => Promise<Expense>;
  /** Update an existing expense. */
  updateExpense: (
    id: string,
    changes: Partial<ExpenseInput>,
  ) => Promise<Expense | null>;
  /** Delete an expense. Returns true if something was removed. */
  deleteExpense: (id: string) => Promise<boolean>;
  /** When a pet is deleted, drop all of its expenses. */
  deleteExpensesForPet: (petId: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(undefined);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const refresh = useCallback(async () => {
    setExpenses(await expenseRepository.list());
  }, []);

  const addExpense = useCallback(async (input: ExpenseInput) => {
    const expense = await expenseRepository.create(input);
    setExpenses((prev) => [...prev, expense]);
    return expense;
  }, []);

  const updateExpense = useCallback(
    async (id: string, changes: Partial<ExpenseInput>) => {
      const updated = await expenseRepository.update(id, changes);
      if (updated) {
        setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
      return updated;
    },
    [],
  );

  const deleteExpense = useCallback(async (id: string) => {
    const removed = await expenseRepository.remove(id);
    if (removed) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    }
    return removed;
  }, []);

  const deleteExpensesForPet = useCallback(async (petId: string) => {
    const remaining = (await expenseStore.getAll()).filter(
      (e) => e.petId !== petId,
    );
    await expenseStore.setAll(remaining);
    setExpenses(remaining);
  }, []);

  /** Live (re-computed) per-pet listing — always up to date with `expenses`. */
  const expensesForPet = useCallback(
    (petId: string) =>
      expenses
        .filter((e) => e.petId === petId)
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
        ),
    [expenses],
  );

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      expenses,
      expensesForPet,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      deleteExpensesForPet,
    }),
    [
      expenses,
      expensesForPet,
      refresh,
      addExpense,
      updateExpense,
      deleteExpense,
      deleteExpensesForPet,
    ],
  );

  return (
    <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>
  );
}

/** Hook for reading expense state anywhere inside ExpensesProvider. */
export function useExpenses(): ExpensesContextValue {
  const ctx = useContext(ExpensesContext);
  if (!ctx) {
    throw new Error('useExpenses must be used within an ExpensesProvider');
  }
  return ctx;
}