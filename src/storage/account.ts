/**
 * Account/settings storage — the two device-level preferences behind the
 * Settings screen, plus the "delete account" wipe.
 *
 * Shape: two plain strings, both namespaced under `STORAGE_PREFIX`, so a
 * "settings key" never collides with an entity collection:
 *  - `<prefix>username`  — what the pet parent calls themselves. No key stored
 *    means never set, which reads back as `DEFAULT_USERNAME`; clearing the key
 *    is exactly how a blank field reverts to the default (same rule as the
 *    home title — see storage/homeTitle.ts).
 *  - `<prefix>time-zone` — the IANA zone dates and times are shown in, or
 *    `auto` (the default) for this device's own zone. Values are validated
 *    against `Intl` on read and on write, so a stale/typo'd zone degrades to
 *    "auto" instead of breaking every date in the app.
 *
 * This is not a login: there is no server, no credential and no sync. The
 * "account" is one local preference pair plus everything else this app stores
 * on the device — which is why deleting it means wiping every key below the
 * app's prefix.
 *
 * 100% offline: AsyncStorage only — no network, no analytics.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_PREFIX } from './storage';
import { AUTO_TIME_ZONE, isValidTimeZone } from '../utils/datetime';

/** AsyncStorage key for the pet parent's own name. */
export const USERNAME_KEY = STORAGE_PREFIX + 'username';
/** AsyncStorage key for the chosen IANA time zone (or `auto`). */
export const TIME_ZONE_KEY = STORAGE_PREFIX + 'time-zone';

/** What the app calls the owner when they have never set a name. */
export const DEFAULT_USERNAME = 'Pet Parent';

/** The two stored preferences, read together by the Settings screen. */
export interface AccountSettings {
  username: string;
  /** An IANA zone id, or `AUTO_TIME_ZONE` for this device's own zone. */
  timeZone: string;
}

/** The name to show, or the default when nothing is stored / data is corrupt. */
export async function loadUsername(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(USERNAME_KEY);
    const trimmed = raw?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : DEFAULT_USERNAME;
  } catch {
    // Unreadable state must never break the Settings screen or the greeting.
    return DEFAULT_USERNAME;
  }
}

/**
 * Save the owner's name and return the name now in effect. Trimmed; an empty
 * or all-whitespace name removes the key so it falls back to `DEFAULT_USERNAME`
 * rather than storing a blank name.
 */
export async function saveUsername(value: string): Promise<string> {
  const trimmed = value.trim();
  try {
    if (trimmed.length === 0) {
      await AsyncStorage.removeItem(USERNAME_KEY);
      return DEFAULT_USERNAME;
    }
    await AsyncStorage.setItem(USERNAME_KEY, trimmed);
    return trimmed;
  } catch {
    // A failed write still shows the typed name; it just won't survive a restart.
    return trimmed.length > 0 ? trimmed : DEFAULT_USERNAME;
  }
}

/** The chosen zone, or `auto` when nothing is stored / the value is unusable. */
export async function loadTimeZone(): Promise<string> {
  try {
    const raw = (await AsyncStorage.getItem(TIME_ZONE_KEY))?.trim() ?? '';
    if (!raw || raw === AUTO_TIME_ZONE) return AUTO_TIME_ZONE;
    return isValidTimeZone(raw) ? raw : AUTO_TIME_ZONE;
  } catch {
    return AUTO_TIME_ZONE;
  }
}

/**
 * Save the chosen zone and return the zone now in effect. `auto` (or anything
 * `Intl` doesn't recognise) clears the key and reads back as `AUTO_TIME_ZONE`.
 */
export async function saveTimeZone(value: string): Promise<string> {
  const trimmed = value.trim();
  const next = trimmed === AUTO_TIME_ZONE || !isValidTimeZone(trimmed)
    ? AUTO_TIME_ZONE
    : trimmed;
  try {
    if (next === AUTO_TIME_ZONE) {
      await AsyncStorage.removeItem(TIME_ZONE_KEY);
    } else {
      await AsyncStorage.setItem(TIME_ZONE_KEY, next);
    }
  } catch {
    // Best effort — the in-memory value still applies for this session.
  }
  return next;
}

/** Both preferences in one read, for the Settings screen's initial hydration. */
export async function loadAccountSettings(): Promise<AccountSettings> {
  const [username, timeZone] = await Promise.all([loadUsername(), loadTimeZone()]);
  return { username, timeZone };
}

/**
 * Delete everything this app has stored on this device.
 *
 * Every key the app owns lives below `STORAGE_PREFIX`, so one prefix scan is a
 * complete, honest wipe: pets, vaccines, medications, feeding, vet records,
 * expenses, journal entries, premium/trial state, the username and time zone,
 * the home title, today's check-off, the notification id maps, co-parent share
 * artifacts, the first-run onboarding flag — all of it. Nothing is kept and
 * nothing is sent anywhere; there is no server copy to delete, because there
 * never was one.
 *
 * Returns the keys it removed, so the caller can report what actually happened.
 */
export async function wipeAllAppData(): Promise<string[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter((key) => key.startsWith(STORAGE_PREFIX));
    if (mine.length > 0) {
      await AsyncStorage.multiRemove(mine);
    }
    return mine;
  } catch {
    // A storage failure here is not recoverable in-place; report an empty wipe
    // rather than pretending it worked.
    return [];
  }
}
