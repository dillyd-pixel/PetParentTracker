/**
 * Today's check-off list — which of today's meds and meals are done.
 *
 * The Today tab lets the user tick off the day's medications and meals. That
 * tick is UI state, so it lives in its own tiny AsyncStorage record rather than
 * in the medication/feeding entities (which stay exactly as they were).
 *
 * Shape: `{ "<YYYY-MM-DD>": ["med:<id>", "feed:<id>", …] }` — only today's key
 * is kept, so opening the app tomorrow starts a fresh list (what the design's
 * ephemeral checklist implies). 100% offline: AsyncStorage only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_PREFIX } from './storage';

const KEY = STORAGE_PREFIX + 'today-checkoff';

type CheckoffByDay = Record<string, string[]>;

/** Local date key, e.g. "2026-09-09". */
export function todayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The ids ticked off today (empty when nothing is stored or data is corrupt). */
export async function loadTodayDone(date: Date = new Date()): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CheckoffByDay;
    return parsed[todayKey(date)] ?? [];
  } catch {
    // Unreadable state should never break the Today tab.
    return [];
  }
}

/** Tick or untick one task, returning the day's new list. */
export async function toggleTodayDone(id: string, date: Date = new Date()): Promise<string[]> {
  const key = todayKey(date);
  let current: string[] = [];
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) current = (JSON.parse(raw) as CheckoffByDay)[key] ?? [];
  } catch {
    current = [];
  }
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];

  // Store only today — yesterday's ticks have no meaning any more.
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ [key]: next } as CheckoffByDay));
  } catch {
    // If the write fails the list simply doesn't persist; the UI stays usable.
  }
  return next;
}
