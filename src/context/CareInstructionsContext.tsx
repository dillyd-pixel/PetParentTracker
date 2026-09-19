/**
 * React context for a pet's Care Instructions — Sitter Mode's per-pet notes.
 *
 * Follows the app's other contexts: the persisted records are mirrored in
 * memory so a screen re-renders the moment the notes are saved, and every write
 * goes through `careInstructionsRepository` (AsyncStorage) first.
 *
 * Free, always: writing care instructions is NOT premium-gated. Only creating a
 * Care Pass is (Stage 1, unchanged) — the content an owner writes here is theirs
 * whatever tier they are on.
 *
 * 100% offline: AsyncStorage only.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { careInstructionsRepository } from '../storage/careInstructions';
import type { CareInstructions, CareInstructionValues } from '../types';

interface CareInstructionsContextValue {
  /** Every pet's notes on this device, most recently edited first. */
  careInstructions: CareInstructions[];
  /** Load them all from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** One pet's notes (undefined while unloaded, or when none are written). */
  getForPet: (petId: string) => CareInstructions | undefined;
  /** Write a pet's notes (creates the pet's first record, then edits it). */
  saveForPet: (
    petId: string,
    values: CareInstructionValues,
  ) => Promise<CareInstructions>;
  /** Delete a pet's notes (used by the pet-delete cascade). */
  deleteForPet: (petId: string) => Promise<boolean>;
}

const CareInstructionsContext = createContext<CareInstructionsContextValue | undefined>(
  undefined,
);

export function CareInstructionsProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [careInstructions, setCareInstructions] = useState<CareInstructions[]>([]);

  const refresh = useCallback(async () => {
    setCareInstructions(await careInstructionsRepository.list());
  }, []);

  const getForPet = useCallback(
    (petId: string) => careInstructions.find((record) => record.petId === petId),
    [careInstructions],
  );

  const saveForPet = useCallback(
    async (petId: string, values: CareInstructionValues) => {
      const saved = await careInstructionsRepository.saveForPet(petId, values);
      setCareInstructions((prev) => [
        saved,
        ...prev.filter((record) => record.petId !== petId),
      ]);
      return saved;
    },
    [],
  );

  const deleteForPet = useCallback(async (petId: string) => {
    const removed = await careInstructionsRepository.deleteForPet(petId);
    if (removed) {
      setCareInstructions((prev) => prev.filter((record) => record.petId !== petId));
    }
    return removed;
  }, []);

  // Load from AsyncStorage once on mount, like the other providers.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ careInstructions, refresh, getForPet, saveForPet, deleteForPet }),
    [careInstructions, refresh, getForPet, saveForPet, deleteForPet],
  );

  return (
    <CareInstructionsContext.Provider value={value}>
      {children}
    </CareInstructionsContext.Provider>
  );
}

/** Hook for reading/writing care instructions anywhere inside the provider. */
export function useCareInstructions(): CareInstructionsContextValue {
  const ctx = useContext(CareInstructionsContext);
  if (!ctx) {
    throw new Error('useCareInstructions must be used within a CareInstructionsProvider');
  }
  return ctx;
}
