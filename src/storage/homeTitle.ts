/**
 * The family's preferred name for the app's home page.
 *
 * The Today header used to be hardcoded to "The Blueprint". Owners asked to
 * rename it, so the title now lives in its own tiny AsyncStorage key at device
 * level — it names the household's blueprint, not any one pet (pet names live
 * on the Pet entities).
 *
 * Shape: one plain string under `@pet-parent-tracker/home-title`. No key stored
 * means "never renamed", which reads back as `DEFAULT_HOME_TITLE`; clearing the
 * key is exactly how a rename reverts to the default.
 *
 * 100% offline: AsyncStorage only — no network, no analytics.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_PREFIX } from './storage';

const KEY = STORAGE_PREFIX + 'home-title';

/** What the home title shows when the owner has never renamed it. */
export const DEFAULT_HOME_TITLE = 'The Blueprint';

/** The saved title, or the default when nothing is stored / data is corrupt. */
export async function loadHomeTitle(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const trimmed = raw?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : DEFAULT_HOME_TITLE;
  } catch {
    // Unreadable state should never break the Today tab.
    return DEFAULT_HOME_TITLE;
  }
}

/**
 * Save the owner's title and return the title now in effect.
 *
 * The value is trimmed; an empty or all-whitespace title removes the key, so the
 * header falls back to `DEFAULT_HOME_TITLE` (per the owner's "empty reverts to
 * the default" rule rather than storing an empty name).
 */
export async function saveHomeTitle(value: string): Promise<string> {
  const trimmed = value.trim();
  try {
    if (trimmed.length === 0) {
      await AsyncStorage.removeItem(KEY);
      return DEFAULT_HOME_TITLE;
    }
    await AsyncStorage.setItem(KEY, trimmed);
    return trimmed;
  } catch {
    // If the write fails the header still shows what the owner typed; it just
    // won't survive a restart.
    return trimmed.length > 0 ? trimmed : DEFAULT_HOME_TITLE;
  }
}
