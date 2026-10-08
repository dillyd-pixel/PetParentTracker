/**
 * Who is checking in — the caregiver's own name, kept on this device.
 *
 * The Caregiver Check-In engine writes "Fed by Sarah — 8:03 AM" into the pet's
 * log, so it has to know who is holding the phone. This is that one fact, and
 * nothing else: a plain string under `@pet-parent-tracker/caregiver-name`,
 * exactly the shape `storage/homeTitle.ts` established for a small meta value.
 *
 * Rules this file owns:
 *  - **No name stored means "ask".** `loadCaregiverName()` returns null rather
 *    than inventing a name, which is what makes the one-time "Who's checking
 *    in?" prompt honest — the app never signs a record with a name it guessed.
 *  - **The owner's own name is the sensible default.** `caregiverNameOrOwner`
 *    falls back to the name the owner set in Settings, but only when they
 *    actually set one: the placeholder ("Pet Parent") is not a name and is
 *    never used as a signature.
 *  - **Blank clears the key** (same rule as the home title): an empty field
 *    reverts to "no name yet" instead of storing whitespace.
 *
 * Not a login, not a profile, not an account: one string on the device. It is
 * wiped by "delete everything" along with every other key under the app's
 * prefix. 100% offline — AsyncStorage only, no network.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_USERNAME } from './account';
import { STORAGE_PREFIX } from './storage';

/** AsyncStorage key for the caregiver's name. */
export const CAREGIVER_NAME_KEY = STORAGE_PREFIX + 'caregiver-name';

/**
 * The name stored for check-ins, trimmed, or null when none is set yet (or the
 * stored value is unreadable — never a guessed name).
 */
export async function loadCaregiverName(): Promise<string | null> {
  try {
    const trimmed = (await AsyncStorage.getItem(CAREGIVER_NAME_KEY))?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

/**
 * Save the caregiver's name and return what is now in effect (null when the
 * field was cleared). Trimmed; blank removes the key so the screen asks again
 * rather than signing records with an empty name.
 */
export async function saveCaregiverName(value: string): Promise<string | null> {
  const trimmed = value.trim();
  try {
    if (trimmed.length === 0) {
      await AsyncStorage.removeItem(CAREGIVER_NAME_KEY);
      return null;
    }
    await AsyncStorage.setItem(CAREGIVER_NAME_KEY, trimmed);
    return trimmed;
  } catch {
    // A failed write still applies for this session; it just won't survive a
    // restart. Never silent about the value the screen shows, either way.
    return trimmed.length > 0 ? trimmed : null;
  }
}

/** Forget the caregiver's name (the key is removed; the screen asks again). */
export async function clearCaregiverName(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CAREGIVER_NAME_KEY);
  } catch {
    // Best effort — an unreadable key simply reads back as "no name".
  }
}

/**
 * The name a check-in should be recorded under: the caregiver's own name when
 * one is stored, otherwise the owner's name — but only when the owner actually
 * set one. Pure, so the same rule is testable without storage.
 *
 * `ownerName` is what Settings holds, including its `DEFAULT_USERNAME`
 * placeholder; that placeholder is deliberately not a name we sign with.
 */
export function caregiverNameOrOwner(
  stored: string | null,
  ownerName: string | null | undefined,
): string | null {
  const own = stored?.trim() ?? '';
  if (own.length > 0) return own;
  const owner = ownerName?.trim() ?? '';
  if (owner.length === 0 || owner === DEFAULT_USERNAME) return null;
  return owner;
}
