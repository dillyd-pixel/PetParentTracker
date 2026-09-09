/**
 * Local notification scheduling for medication, feeding, and vaccine
 * reminders (Blueprint Premium feature 1/4).
 *
 * 100% offline: every function here uses expo-notifications' *local* trigger
 * API (`scheduleNotificationAsync` with `DAILY` / `WEEKLY` / `DATE`
 * triggers). There is zero server involvement — no expo-push-notifications,
 * no Firebase, no remote push token, no `getExpoPushTokenAsync`.
 *
 * Cancellation is managed through id maps persisted in AsyncStorage: for
 * every scheduled notification we store its expo identifier under the owning
 * entity's id (`med:`, `feed:`, `vac:` prefixes keep the namespaces apart).
 * Deleting/editing an entity then cancels exactly its own notifications by
 * looking up that map — no need to scan the OS queue (which Android can
 * return empty for without the notification permission).
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { FeedingSchedule, Medication, Vaccine } from '../types';

/**
 * The browser preview is a review surface only: medicines are tracked and
 * stored exactly like on Android (AsyncStorage → localStorage), but no
 * local notifications can be scheduled. `Platform.OS === 'web'` is a
 * compile-time constant in both Metro bundles, so on web every function
 * below short-circuits before touching expo-notifications (which has no
 * browser implementation), while Android keeps its exact behavior.
 */
const IS_WEB = Platform.OS === 'web';

/** Android notification channel used by every reminder. */
export const MEDICATION_CHANNEL_ID = 'medication-reminders';

/** Expo weekday (1 = Sunday … 7 = Saturday) for a JS `getDay()` day (0 = Sunday). */
function expoWeekday(jsDay: number): number {
  return jsDay === 0 ? 1 : jsDay + 1;
}

/** Parse "HH:mm" into [hour, minute], or null when invalid. */
function parseTimeHM(time: string): [number, number] | null {
  const [hour, minute] = time.split(':').map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return [hour, minute];
}

/** Parse an ISO "YYYY-MM-DD" date into [year, month, day], or null when invalid. */
function parseISODateParts(s: string): [number, number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }
  return [y, m, d];
}

/**
 * Stable, unique identifier for one reminder notification of a medication.
 * Same input always produces the same id, so rescheduling after an edit
 * overwrites the old notification instead of stacking duplicates.
 */
export function medicationNotificationId(
  medicationId: string,
  scheduleKey: string,
): string {
  return `med:${medicationId}:${scheduleKey}`;
}

/**
 * Stable, unique identifier for one reminder notification of a feeding entry.
 * `dayN` keys one WEEKLY notification per repeat day (or `daily` for the
 * every-day DAILY trigger).
 */
export function feedingNotificationId(
  feedingId: string,
  scheduleKey: string,
): string {
  return `feed:${feedingId}:${scheduleKey}`;
}

/** Stable identifier for one vaccine's due-date reminder notification. */
export function vaccineNotificationId(vaccineId: string): string {
  return `vac:${vaccineId}:due`;
}

/** AsyncStorage key holding the medication-id → notification-id map. */
const NOTIFICATION_MAP_KEY = '@pet-parent-tracker/med-notification-map';

/** AsyncStorage key holding the feeding-entry-id → notification-id map. */
const FEEDING_NOTIFICATION_MAP_KEY = '@pet-parent-tracker/feed-notification-map';

/** AsyncStorage key holding the vaccine-id → notification-id map. */
const VACCINE_NOTIFICATION_MAP_KEY = '@pet-parent-tracker/vac-notification-map';

/** Read the full id map (medication id → array of scheduled notification ids). */
async function getNotificationMap(): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function setNotificationMap(
  map: Record<string, string[]>,
): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
}

/** Generic AsyncStorage id-map reader for the feeding/vaccine maps. */
async function getIdMap(key: string): Promise<Record<string, string[]>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

async function setIdMap(key: string, map: Record<string, string[]>): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(map));
}

/** Cancel every scheduled notification id in `ids`, ignoring failures. */
async function cancelScheduledIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await Promise.all(
    ids.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined),
    ),
  );
}

/** Remove one entity's entry from an id map (persisting the change). */
async function dropIdMapEntry(key: string, entityId: string): Promise<void> {
  const map = await getIdMap(key);
  delete map[entityId];
  await setIdMap(key, map);
}

/** All scheduled notification ids currently tracked for one medication. */
export async function getNotificationIdsForMedication(
  medicationId: string,
): Promise<string[]> {
  const map = await getNotificationMap();
  return map[medicationId] ?? [];
}

/** All scheduled notification ids currently tracked for one feeding entry. */
export async function getNotificationIdsForFeeding(
  feedingId: string,
): Promise<string[]> {
  const map = await getIdMap(FEEDING_NOTIFICATION_MAP_KEY);
  return map[feedingId] ?? [];
}

/** All scheduled notification ids currently tracked for one vaccine. */
export async function getNotificationIdsForVaccine(
  vaccineId: string,
): Promise<string[]> {
  const map = await getIdMap(VACCINE_NOTIFICATION_MAP_KEY);
  return map[vaccineId] ?? [];
}

/**
 * Ask the user for notification permission (graceful: Android 13+ shows the
 * system prompt; earlier versions are granted by default). Returns true when
 * local notifications may be scheduled.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (IS_WEB) return false; // browser preview: no notifications, no prompt
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  }
  return false;
}

/** Whether notification permission is currently granted (no prompt). */
export async function hasNotificationPermission(): Promise<boolean> {
  if (IS_WEB) return false; // browser preview: no notifications
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

/**
 * Set up the app-wide notification handler (shows banners/lock-screen alerts
 * while the app is in the foreground) and the Android channel all reminders
 * use. Best called once at app start (RootNavigator) and is idempotent.
 */
export async function setupNotifications(): Promise<void> {
  if (IS_WEB) return; // no notification handler/channel in a browser
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  // Android 8+ requires a channel before notifications can appear.
  await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
    name: 'Pet care reminders',
    importance: Notifications.AndroidImportance.HIGH,
    description: 'Reminders for your pets’ medications, meals, and vaccines.',
    sound: 'default',
    enableVibrate: true,
  });
}

/** Date exactly `days` days from now, at local midnight. */
function dateInDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whether a medication still has an active schedule on `day` (offset from today). */
function isActiveOnDay(m: Medication, day: number): boolean {
  const d = dateInDays(day);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
  if (m.startDate && iso < m.startDate) return false;
  if (m.endDate && iso > m.endDate) return false;
  return true;
}

/**
 * Schedule the local reminder(s) for one medication. Replaces the medication's
 * existing scheduled notifications (cancels old ones first, then schedules the
 * new set). Intervals longer than a day are scheduled as a rolling chain of
 * one-shot notifications 24h apart (expo has no "every N days" trigger), each
 * checked against the medication's start/end window; the chain re-arms on the
 * next app launch.
 */
export async function scheduleMedicationReminders(
  m: Medication,
): Promise<void> {
  if (IS_WEB) return; // browser preview: reminders are a no-op
  // 1) Clear whatever this medication had scheduled before.
  await cancelMedicationReminders(m.id);

  // 2) Nothing to schedule for a course that isn't active or enabled.
  if (!m.active || !m.remindersEnabled) return;
  if (m.times.length === 0 && m.intervalDays <= 0) return; // no schedule
  const needsPermission = await ensureNotificationPermission();
  if (!needsPermission) {
    // Reminders stay saved on-device; nothing is scheduled. The UI shows a
    // note ("reminders saved but not scheduled") when permission is denied.
    return;
  }

  const scheduled: string[] = [];
  const medId = m.id;

  if (m.times.length > 0) {
    // Repeating DAILY triggers — one notification per dose time, every day.
    for (const t of m.times) {
      const [hour, minute] = t.split(':').map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) continue;
      const id = medicationNotificationId(medId, t);
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: `${m.name} 💊`,
            body: `Time for ${m.name} — ${m.dosage || 'medication'}.`,
            data: { medicationId: medId, petId: m.petId, kind: 'medication-reminder' },
            sound: 'default',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
        });
        scheduled.push(id);
      } catch {
        // A single bad trigger must not corrupt the rest of the schedule.
      }
    }
  } else {
    // Interval mode: chain of one-shot notifications, one per day, for the
    // next 90 days (the chain re-arms on every app launch, so it effectively
    // continues as long as the user opens the app now and then). The first
    // dose is always scheduled tomorrow morning so the chain only ever fires
    // for future doses.
    for (let day = 1; day <= 90; day++) {
      if (day % m.intervalDays !== 0) continue;
      if (!isActiveOnDay(m, day)) continue;
      const id = medicationNotificationId(medId, `day${day}`);
      try {
        const fire = dateInDays(day);
        fire.setHours(8, 0, 0, 0); // morning dose time
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: `${m.name} 💊`,
            body: `Time for ${m.name} — ${m.dosage || 'medication'} (every ${m.intervalDays} days).`,
            data: { medicationId: medId, petId: m.petId, kind: 'medication-reminder' },
            sound: 'default',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
        });
        scheduled.push(id);
      } catch {
        // Ignore individual failures.
      }
    }
  }

  // 3) Persist the id map so we can cancel by medication id later.
  if (scheduled.length > 0) {
    const map = await getNotificationMap();
    map[medId] = scheduled;
    await setNotificationMap(map);
  }
}

/**
 * Cancel every scheduled notification belonging to one medication and drop it
 * from the id map. Safe to call multiple times.
 */
export async function cancelMedicationReminders(
  medicationId: string,
): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const ids = await getNotificationIdsForMedication(medicationId);
  await cancelScheduledIds(ids);
  const map = await getNotificationMap();
  delete map[medicationId];
  await setNotificationMap(map);
}

/** Cancel every scheduled notification for a pet's medications (pet deletion). */
export async function cancelMedicationsForPet(
  petId: string,
  medications: Medication[],
): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const petMeds = medications.filter((m) => m.petId === petId);
  await Promise.all(
    petMeds.map((m) => cancelMedicationReminders(m.id).catch(() => undefined)),
  );
}

/**
 * Schedule the local reminder notification(s) for one feeding entry.
 * Replaces the entry's existing scheduled notifications (cancels old ones
 * first). An entry repeating every day gets one DAILY trigger at its time;
 * an entry on specific days gets one WEEKLY trigger per day at that time.
 * Entries with `reminderEnabled` off (or unset) schedule nothing.
 */
export async function scheduleFeedingReminders(
  f: FeedingSchedule,
): Promise<void> {
  if (IS_WEB) return; // browser preview: reminders are a no-op
  // 1) Clear whatever this entry had scheduled before.
  await cancelFeedingReminders(f.id);

  // 2) Nothing to schedule when reminders are off.
  if (!f.reminderEnabled) return;
  const parsed = parseTimeHM(f.time);
  if (!parsed) return;
  const [hour, minute] = parsed;
  const needsPermission = await ensureNotificationPermission();
  if (!needsPermission) {
    // Reminders stay saved on-device; nothing is scheduled.
    return;
  }

  const scheduled: string[] = [];
  const days =
    f.daysOfWeek.length === 0
      ? null // every day
      : [...new Set(f.daysOfWeek)].filter(
          (d) => Number.isInteger(d) && d >= 0 && d <= 6,
        );

  if (days === null) {
    const id = feedingNotificationId(f.id, 'daily');
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: `${f.mealType} time 🍖`,
          body: `Time for ${f.mealType.toLowerCase()} — ${f.portionAmount} ${f.portionUnit}.`,
          data: { feedingId: f.id, petId: f.petId, kind: 'feeding-reminder' },
          sound: 'default',
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
      scheduled.push(id);
    } catch {
      // A single bad trigger must not corrupt the rest of the schedule.
    }
  } else {
    for (const day of days) {
      const id = feedingNotificationId(f.id, `day${day}`);
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: {
            title: `${f.mealType} time 🍖`,
            body: `Time for ${f.mealType.toLowerCase()} — ${f.portionAmount} ${f.portionUnit}.`,
            data: { feedingId: f.id, petId: f.petId, kind: 'feeding-reminder' },
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: expoWeekday(day),
            hour,
            minute,
          },
        });
        scheduled.push(id);
      } catch {
        // Ignore individual failures.
      }
    }
  }

  // 3) Persist the id map so we can cancel by feeding-entry id later.
  if (scheduled.length > 0) {
    const map = await getIdMap(FEEDING_NOTIFICATION_MAP_KEY);
    map[f.id] = scheduled;
    await setIdMap(FEEDING_NOTIFICATION_MAP_KEY, map);
  }
}

/**
 * Cancel every scheduled notification belonging to one feeding entry and drop
 * it from the id map. Safe to call multiple times.
 */
export async function cancelFeedingReminders(feedingId: string): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const ids = await getNotificationIdsForFeeding(feedingId);
  await cancelScheduledIds(ids);
  await dropIdMapEntry(FEEDING_NOTIFICATION_MAP_KEY, feedingId);
}

/** Cancel every scheduled notification for a pet's feeding entries (pet deletion). */
export async function cancelFeedingForPet(
  petId: string,
  entries: FeedingSchedule[],
): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const petEntries = entries.filter((f) => f.petId === petId);
  await Promise.all(
    petEntries.map((f) => cancelFeedingReminders(f.id).catch(() => undefined)),
  );
}

/**
 * Schedule the local due-date reminder for one vaccine. Replaces the
 * vaccine's existing scheduled notification (cancels the old one first).
 * Fires on the due date at 9am local time; past due dates and vaccines with
 * `reminderEnabled` off (or unset) schedule nothing.
 */
export async function scheduleVaccineReminders(v: Vaccine): Promise<void> {
  if (IS_WEB) return; // browser preview: reminders are a no-op
  // 1) Clear whatever this vaccine had scheduled before.
  await cancelVaccineReminders(v.id);

  // 2) Nothing to schedule without a due date or with reminders off.
  if (!v.reminderEnabled || !v.dueDate) return;
  const parts = parseISODateParts(v.dueDate);
  if (!parts) return;
  const [year, month, day] = parts;
  const fire = new Date(year, month - 1, day, 9, 0, 0, 0);
  if (fire.getTime() <= Date.now()) return; // already due — no future fire time
  const needsPermission = await ensureNotificationPermission();
  if (!needsPermission) {
    // Reminders stay saved on-device; nothing is scheduled.
    return;
  }

  const id = vaccineNotificationId(v.id);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title: `${v.name} due 💉`,
        body: `${v.name} is due today — time to book the vet visit.`,
        data: { vaccineId: v.id, petId: v.petId, kind: 'vaccine-reminder' },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    });
    const map = await getIdMap(VACCINE_NOTIFICATION_MAP_KEY);
    map[v.id] = [id];
    await setIdMap(VACCINE_NOTIFICATION_MAP_KEY, map);
  } catch {
    // Ignore individual failures.
  }
}

/**
 * Cancel every scheduled notification belonging to one vaccine and drop it
 * from the id map. Safe to call multiple times.
 */
export async function cancelVaccineReminders(vaccineId: string): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const ids = await getNotificationIdsForVaccine(vaccineId);
  await cancelScheduledIds(ids);
  await dropIdMapEntry(VACCINE_NOTIFICATION_MAP_KEY, vaccineId);
}

/** Cancel every scheduled notification for a pet's vaccines (pet deletion). */
export async function cancelVaccinesForPet(
  petId: string,
  vaccines: Vaccine[],
): Promise<void> {
  if (IS_WEB) return; // browser preview: nothing scheduled
  const petVaccines = vaccines.filter((v) => v.petId === petId);
  await Promise.all(
    petVaccines.map((v) => cancelVaccineReminders(v.id).catch(() => undefined)),
  );
}