/**
 * React context for Blueprint Premium — the app's on-device paywall gate.
 *
 * Holds the persisted premium state in memory (mirroring AsyncStorage, like
 * the other contexts) and computes premium/trial status from timestamps on
 * the device clock: the 14-day trial is active while `Date.now()` is between
 * `trialStartedAt` and `trialEndsAt`; the one-time unlock is permanent.
 *
 * 100% offline: no receipts, no server, no billing SDK — the state is just
 * JSON in AsyncStorage. While the tier is gated on-device it is still fully
 * functional, but nothing ever moves money.
 *
 * Any screen can read premium state via `usePremium()`, which is what future
 * premium features (reminders, global search, PDF export, co-parent share)
 * will gate behind.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_PREMIUM_STATE,
  getPremiumState,
  PREMIUM_TRIAL_DAYS,
  setPremiumState,
} from '../storage/premium';
import type { PremiumState } from '../storage/premium';

interface PremiumContextValue {
  /**
   * True when the user has premium access right now — either the one-time
   * unlock was recorded, or the 14-day free trial is still running (both
   * computed from stored timestamps against the device clock).
   */
  isPremium: () => boolean;
  /**
   * Whole days left in the free trial (14 … 0), or 0 when the trial hasn't
   * started or has already expired. The day boundary is `trialEndsAt`,
   * matching the timestamp-based expiry.
   */
  trialRemainingDays: () => number;
  /** Whether the free trial was ever started (even if it has since ended). */
  trialStarted: () => boolean;
  /** When the current trial ends (ISO), or undefined when none is running. */
  trialEndsAt: () => string | undefined;
  /** When the on-device unlock was recorded (ISO), or undefined. */
  unlockedAt: () => string | undefined;
  /**
   * Start the 14-day free trial. No-op if a trial was already started (the
   * timer must never restart). Returns the updated state.
   */
  startTrial: () => Promise<PremiumState>;
  /** Record the one-time unlock (permanent, timestamped). */
  unlock: () => Promise<PremiumState>;
  /**
   * Re-read the persisted state from AsyncStorage. The browser preview's
   * "Restore" button calls this so a freshly reloaded page picks up the
   * stored trial/unlock exactly like a returning app launch.
   */
  restore: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextValue | undefined>(
  undefined,
);

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PremiumState>(DEFAULT_PREMIUM_STATE);

  const refresh = useCallback(async () => {
    setState(await getPremiumState());
  }, []);

  // Load the persisted state once on mount, like the other providers.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const trialRunning = useCallback(
    () =>
      !!state.trialStartedAt &&
      !!state.trialEndsAt &&
      Date.now() > new Date(state.trialStartedAt).getTime() &&
      Date.now() < new Date(state.trialEndsAt).getTime(),
    [state.trialStartedAt, state.trialEndsAt],
  );

  const isPremium = useCallback(
    () => state.unlocked || trialRunning(),
    [state.unlocked, trialRunning],
  );

  const trialRemainingDays = useCallback(() => {
    if (!state.trialEndsAt) return 0;
    const endsAt = new Date(state.trialEndsAt).getTime();
    if (!Number.isFinite(endsAt)) return 0; // corrupt timestamp → no trial
    const remaining = Math.max(0, endsAt - Date.now());
    if (remaining <= 0) return 0;
    return Math.ceil(remaining / (24 * 60 * 60 * 1000));
  }, [state.trialEndsAt]);

  const trialStarted = useCallback(
    () => !!state.trialStartedAt,
    [state.trialStartedAt],
  );

  const trialEndsAt = useCallback(
    () => (trialRunning() ? state.trialEndsAt : undefined),
    [trialRunning, state.trialEndsAt],
  );

  const unlockedAt = useCallback(() => state.unlockedAt, [state.unlockedAt]);

  const startTrial = useCallback(async () => {
    // Once-only: a trial that was ever started never restarts, even if the
    // premium screen gets re-opened (or a co-parent imports an old file).
    if (state.trialStartedAt || state.unlocked) return state;
    const now = Date.now();
    const next: PremiumState = {
      ...state,
      trialStartedAt: new Date(now).toISOString(),
      trialEndsAt: new Date(now + PREMIUM_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    };
    await setPremiumState(next);
    setState(next);
    return next;
  }, [state]);

  const unlock = useCallback(async () => {
    if (state.unlocked) return state;
    const next: PremiumState = {
      ...state,
      unlocked: true,
      unlockedAt: new Date().toISOString(),
    };
    await setPremiumState(next);
    setState(next);
    return next;
  }, [state]);

  const restore = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      isPremium,
      trialRemainingDays,
      trialStarted,
      trialEndsAt,
      unlockedAt,
      startTrial,
      unlock,
      restore,
    }),
    [
      isPremium,
      trialRemainingDays,
      trialStarted,
      trialEndsAt,
      unlockedAt,
      startTrial,
      unlock,
      restore,
    ],
  );

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

/** Hook for reading premium state anywhere inside PremiumProvider. */
export function usePremium(): PremiumContextValue {
  const ctx = useContext(PremiumContext);
  if (!ctx) {
    throw new Error('usePremium must be used within a PremiumProvider');
  }
  return ctx;
}