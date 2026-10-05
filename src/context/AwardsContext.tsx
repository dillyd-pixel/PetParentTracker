/**
 * React context holding the earned-award shelf in memory, mirroring what is
 * persisted in AsyncStorage (`storage/awards`).
 *
 * Home computes which awards a pet's real records satisfy and hands the list
 * here through `syncAwards`; the context writes only the ones it has not seen
 * before, so opening the app is idempotent and a badge is never awarded twice.
 * The freshly-created rows are returned, which is exactly what the celebration
 * card needs to say "you just earned this".
 *
 * Following the pattern of the module contexts: a context, a provider, a typed
 * hook.
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

import { awardRepository } from '../storage/awards';
import type { AwardKind, EarnedAward } from '../storage/awards';

/** One award the app would like to make sure is on the shelf. */
export interface AwardToSync {
  petId: string;
  awardId: string;
  kind: AwardKind;
}

interface AwardsContextValue {
  /** Every earned award on this device, for every pet. */
  awards: EarnedAward[];
  /** Load the shelf from AsyncStorage. Call on app start. */
  refresh: () => Promise<void>;
  /** One pet's shelf, newest earned first. */
  awardsFor: (petId: string) => EarnedAward[];
  /** Is this award already on a pet's shelf? */
  hasAward: (petId: string, awardId: string) => boolean;
  /**
   * Make sure every award in `wanted` is recorded, and return only the ones
   * that were newly written (so the caller can celebrate them). Idempotent.
   */
  syncAwards: (wanted: AwardToSync[]) => Promise<EarnedAward[]>;
  /** When a pet is deleted, drop its whole shelf. */
  deleteAwardsForPet: (petId: string) => Promise<void>;
}

const AwardsContext = createContext<AwardsContextValue | undefined>(undefined);

export function AwardsProvider({ children }: { children: React.ReactNode }) {
  const [awards, setAwards] = useState<EarnedAward[]>([]);

  const refresh = useCallback(async () => {
    setAwards(await awardRepository.list());
  }, []);

  const awardsFor = useCallback(
    (petId: string) =>
      awards
        .filter((award) => award.petId === petId)
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
    [awards],
  );

  const hasAward = useCallback(
    (petId: string, awardId: string) =>
      awards.some((award) => award.petId === petId && award.awardId === awardId),
    [awards],
  );

  const syncAwards = useCallback(
    async (wanted: AwardToSync[]): Promise<EarnedAward[]> => {
      if (wanted.length === 0) return [];
      // Read the shelf fresh, so a sync that races a previous one can't double-write.
      const current = await awardRepository.list();
      const held = new Set(current.map((award) => `${award.petId}\u0000${award.awardId}`));
      const missing = wanted.filter((item) => !held.has(`${item.petId}\u0000${item.awardId}`));
      if (missing.length === 0) {
        // Keep memory in step without churning state.
        setAwards(current);
        return [];
      }
      const earnedAt = new Date().toISOString();
      const created: EarnedAward[] = [];
      for (const item of missing) {
        created.push(
          await awardRepository.create({
            petId: item.petId,
            awardId: item.awardId,
            kind: item.kind,
            earnedAt,
          }),
        );
      }
      setAwards((prev) => [...prev, ...created]);
      return created;
    },
    [],
  );

  const deleteAwardsForPet = useCallback(async (petId: string) => {
    await awardRepository.removeForPet(petId);
    setAwards((prev) => prev.filter((award) => award.petId !== petId));
  }, []);

  // Load from AsyncStorage once on mount.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      awards,
      refresh,
      awardsFor,
      hasAward,
      syncAwards,
      deleteAwardsForPet,
    }),
    [awards, refresh, awardsFor, hasAward, syncAwards, deleteAwardsForPet],
  );

  return <AwardsContext.Provider value={value}>{children}</AwardsContext.Provider>;
}

/** Hook for reading the award shelf anywhere inside AwardsProvider. */
export function useAwards(): AwardsContextValue {
  const ctx = useContext(AwardsContext);
  if (!ctx) {
    throw new Error('useAwards must be used within an AwardsProvider');
  }
  return ctx;
}
