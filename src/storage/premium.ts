/**
 * Blueprint Premium data-access layer over AsyncStorage.
 *
 * Blueprint Premium is a single on-device state object: whether the one-time
 * unlock was recorded, and (optionally) the timestamps of the once-only
 * 14-day free trial. Everything is persisted under one AsyncStorage key via
 * the app's existing KeyValueStore — no network, no receipt server, no
 * billing SDK. Real payment (app-store billing) is a later step; until then
 * the gate and trial are fully functional on-device and no money moves.
 */
import { KeyValueStore } from './storage';

/** Blueprint Premium's persisted on-device state. */
export interface PremiumState {
  /** True once the one-time unlock has been recorded. */
  unlocked: boolean;
  /** ISO timestamp when the 14-day free trial started (once-only). */
  trialStartedAt?: string;
  /** ISO timestamp when the 14-day free trial ends. */
  trialEndsAt?: string;
  /** ISO timestamp when the one-time unlock was recorded. */
  unlockedAt?: string;
}

/** Length of the free trial, in days. */
export const PREMIUM_TRIAL_DAYS = 14;

/** One AsyncStorage key holding the whole premium state (a JSON blob). */
const premiumStore = new KeyValueStore('premium');

/** Default state: no unlock, no trial started. */
export const DEFAULT_PREMIUM_STATE: PremiumState = { unlocked: false };

/** Read the persisted premium state (all-off when nothing stored yet). */
export async function getPremiumState(): Promise<PremiumState> {
  try {
    const raw = await premiumStore.get();
    if (!raw) return { ...DEFAULT_PREMIUM_STATE };
    const parsed = JSON.parse(raw) as Partial<PremiumState>;
    return {
      unlocked: parsed.unlocked === true,
      trialStartedAt: parsed.trialStartedAt,
      trialEndsAt: parsed.trialEndsAt,
      unlockedAt: parsed.unlockedAt,
    };
  } catch {
    // Corrupt/unreadable state must never crash the app; treat as all-off.
    return { ...DEFAULT_PREMIUM_STATE };
  }
}

/** Persist the premium state. */
export async function setPremiumState(state: PremiumState): Promise<void> {
  await premiumStore.set(JSON.stringify(state));
}