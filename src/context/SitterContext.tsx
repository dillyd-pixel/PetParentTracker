/**
 * React context for Sitter Mode — the Care Passes held on this device.
 *
 * Follows the app's other contexts: the persisted passes are mirrored in
 * memory so screens re-render when one is created, closed or opened, and every
 * write goes through `carePassRepository` (AsyncStorage) first. On a sitter's
 * device this context holds the passes they were given; on the owner's device
 * it holds the passes they created — the model is the same either way, and
 * `pass.source` says which is which.
 *
 * 100% offline: AsyncStorage only. Nothing here talks to a network, an account
 * or a server — the sitter's side needs no sign-in, no premium and no pet of
 * their own.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { carePassRepository, importCarePassInvite } from '../storage/carePasses';
import type { CarePassImportOutcome } from '../storage/carePasses';
import type { CarePass, CarePassInput, CarePassInviteFile } from '../types';

interface SitterContextValue {
  /** Every care pass on this device, newest first. */
  carePasses: CarePass[];
  /** Load every pass from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** One pass by its local id (undefined while unknown/unloaded). */
  getPass: (id: string) => CarePass | undefined;
  /** One pass by its invite code (undefined when it isn't on this device). */
  findByInviteCode: (code: string) => CarePass | undefined;
  /** Create a pass (mints its invite code and derives its status). */
  createPass: (input: CarePassInput) => Promise<CarePass>;
  /** End a pass early — the owner's "Close pass". */
  closePass: (id: string) => Promise<CarePass | null>;
  /**
   * Store a validated invite on this device (the sitter's side). Reports a
   * `conflict` when a pass with that code is already here and no `overwrite`
   * was asked for — the screens prompt first.
   */
  openInvite: (
    file: CarePassInviteFile,
    options?: { overwrite?: boolean },
  ) => Promise<CarePassImportOutcome>;
}

const SitterContext = createContext<SitterContextValue | undefined>(undefined);

export function SitterProvider({ children }: { children: React.ReactNode }) {
  const [carePasses, setCarePasses] = useState<CarePass[]>([]);

  const refresh = useCallback(async () => {
    setCarePasses(await carePassRepository.list());
  }, []);

  const getPass = useCallback(
    (id: string) => carePasses.find((pass) => pass.id === id),
    [carePasses],
  );

  const findByInviteCode = useCallback(
    (code: string) => {
      const wanted = code.trim().toUpperCase();
      return carePasses.find((pass) => pass.inviteCode === wanted);
    },
    [carePasses],
  );

  const createPass = useCallback(async (input: CarePassInput) => {
    const pass = await carePassRepository.create(input);
    setCarePasses((prev) => [pass, ...prev]);
    return pass;
  }, []);

  const closePass = useCallback(async (id: string) => {
    const closed = await carePassRepository.close(id);
    if (closed) {
      setCarePasses((prev) => prev.map((pass) => (pass.id === id ? closed : pass)));
    }
    return closed;
  }, []);

  const openInvite = useCallback(
    async (file: CarePassInviteFile, options?: { overwrite?: boolean }) => {
      const outcome = await importCarePassInvite(file, options);
      if (outcome.ok) {
        // Re-read the whole collection: the import either replaced a pass or
        // created one, and the list is the cheapest source of truth for both.
        setCarePasses(await carePassRepository.list());
      }
      return outcome;
    },
    [],
  );

  // Load from AsyncStorage once on mount, like the other providers.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      carePasses,
      refresh,
      getPass,
      findByInviteCode,
      createPass,
      closePass,
      openInvite,
    }),
    [
      carePasses,
      refresh,
      getPass,
      findByInviteCode,
      createPass,
      closePass,
      openInvite,
    ],
  );

  return <SitterContext.Provider value={value}>{children}</SitterContext.Provider>;
}

/** Hook for reading Sitter Mode state anywhere inside SitterProvider. */
export function useSitter(): SitterContextValue {
  const ctx = useContext(SitterContext);
  if (!ctx) {
    throw new Error('useSitter must be used within a SitterProvider');
  }
  return ctx;
}
