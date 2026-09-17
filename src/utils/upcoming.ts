/**
 * "Upcoming" — the dated events list shown on the Today tab.
 *
 * Pure, offline formatting: it takes the entities the app has already loaded
 * from AsyncStorage (vaccines, vet visits, medication courses) and turns the
 * ones with a future date into a sorted, date-grouped list with relative date
 * labels ("Today", "Tomorrow", "Sep 20 · in 3 days"). No storage, no network,
 * no clock beyond the `today` argument it is handed.
 *
 * Daily/recurring things (meals, daily doses) deliberately stay out: they are
 * already on the Today list. Only dates that mark a one-off event — a vaccine
 * due, a vet appointment, a course starting or ending — belong here.
 */
import type { Medication, Vaccine, VetRecord } from '../types';
import { todayISO } from './petDisplay';
import { todayISOInTimeZone } from './datetime';

/** Which module screen a row opens (all live in the Pets tab's stack). */
export type UpcomingScreen = 'Vaccines' | 'VetRecords' | 'Meds';

/** One dated event, ready to render. */
export interface UpcomingItem {
  /** Stable React key, e.g. "vac:<id>:due". */
  id: string;
  /** ISO date (YYYY-MM-DD) the event falls on. */
  date: string;
  /** Pet the event belongs to. */
  petId: string;
  /** The pet's name, resolved by the caller. */
  petName: string;
  /** Short one-line descriptor, e.g. "Vaccine due — Rabies". */
  descriptor: string;
  /** Module screen the row opens. */
  screen: UpcomingScreen;
}

/** Items sharing one date, under that date's relative label. */
export interface UpcomingGroup {
  date: string;
  /** "Today" / "Tomorrow" / "Sep 20 · in 3 days". */
  label: string;
  items: UpcomingItem[];
}

/** What the Today tab renders: groups in date order plus any overflow count. */
export interface UpcomingList {
  groups: UpcomingGroup[];
  /** Items that did not fit under the cap ("… and N more"). */
  hiddenCount: number;
}

/** How many rows the section shows before collapsing into "… and N more". */
export const UPCOMING_LIMIT = 10;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Local-midnight Date for an ISO "YYYY-MM-DD", or null when malformed. */
function isoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Whole local days from `today` to `iso` (negative when in the past), or null. */
export function daysUntil(iso: string, today: string): number | null {
  const target = isoDate(iso);
  const from = isoDate(today);
  if (!target || !from) return null;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Relative label for a date: "Today", "Tomorrow", or "Sep 20 · in 3 days".
 * The year is added when the date falls outside the current year, so a label
 * that crosses a year boundary is never ambiguous.
 */
export function relativeDateLabel(iso: string, today: string): string {
  const days = daysUntil(iso, today);
  if (days === null) return iso;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  const target = isoDate(iso);
  const from = isoDate(today);
  if (!target) return iso;
  const sameYear = from ? target.getFullYear() === from.getFullYear() : true;
  const monthDay = `${MONTHS_SHORT[target.getMonth()]} ${target.getDate()}`;
  const year = sameYear ? '' : `, ${target.getFullYear()}`;
  return `${monthDay}${year} · in ${days} days`;
}

interface BuildUpcomingInput {
  vaccines: Vaccine[];
  vetRecords: VetRecord[];
  medications: Medication[];
  /** Resolve a pet id to its display name (falls back to "Pet"). */
  petName: (petId: string) => string;
  /** Today as ISO "YYYY-MM-DD". Defaults to the device's today. */
  today?: string;
  /**
   * The display time zone chosen in Settings (an IANA id, or `auto`). It only
   * decides *which day counts as today* when the caller doesn't pass `today`
   * itself — so "Today"/"Tomorrow" and the "in N days" counts line up with the
   * clock the owner sees in the Today header, even when the chosen zone is
   * already on a different calendar day than the device. Invalid zones fall
   * back to the device's own day.
   */
  timeZone?: string;
}

/**
 * Build the Upcoming list: every one-off event dated today or later, sorted by
 * date (earliest first) and grouped under its relative date label. Capped at
 * `UPCOMING_LIMIT` rows; anything beyond is reported as `hiddenCount`.
 */
export function buildUpcoming({
  vaccines,
  vetRecords,
  medications,
  petName,
  today: explicitToday,
  timeZone,
}: BuildUpcomingInput): UpcomingList {
  // The day that counts as "today": the caller's when given (the Today screen
  // passes the live clock's day), otherwise derived in the chosen zone.
  const today =
    explicitToday ?? (timeZone ? todayISOInTimeZone(new Date(), timeZone) : todayISO());
  const found: UpcomingItem[] = [];
  const nameFor = (petId: string) => petName(petId) || 'Pet';

  // Vaccines whose next due date is still ahead.
  vaccines.forEach((vaccine) => {
    if (!vaccine.dueDate) return;
    const days = daysUntil(vaccine.dueDate, today);
    if (days === null || days < 0) return;
    found.push({
      id: `vac:${vaccine.id}:due`,
      date: vaccine.dueDate,
      petId: vaccine.petId,
      petName: nameFor(vaccine.petId),
      descriptor: `Vaccine due — ${vaccine.name}`,
      screen: 'Vaccines',
    });
  });

  // Vet visits still to come, with their appointment time when one is set.
  vetRecords.forEach((record) => {
    const days = daysUntil(record.visitDate, today);
    if (days === null || days < 0) return;
    found.push({
      id: `vet:${record.id}:visit`,
      date: record.visitDate,
      petId: record.petId,
      petName: nameFor(record.petId),
      descriptor: record.visitTime
        ? `Vet visit ${record.visitTime} — ${record.visitTitle}`
        : `Vet visit — ${record.visitTitle}`,
      screen: 'VetRecords',
    });
  });

  // Active medication courses: the day a course starts and the day it ends are
  // both one-off events (the daily doses themselves stay on the Today list).
  medications
    .filter((medication) => medication.active)
    .forEach((medication) => {
      const startDate = medication.startDate;
      const endDate = medication.endDate;
      const startDays = startDate ? daysUntil(startDate, today) : null;
      if (startDate && startDays !== null && startDays >= 0) {
        found.push({
          id: `med:${medication.id}:start`,
          date: startDate,
          petId: medication.petId,
          petName: nameFor(medication.petId),
          descriptor: `Course starts — ${medication.name}`,
          screen: 'Meds',
        });
      }
      const endDays = endDate ? daysUntil(endDate, today) : null;
      if (endDate && endDays !== null && endDays >= 0) {
        found.push({
          id: `med:${medication.id}:end`,
          date: endDate,
          petId: medication.petId,
          petName: nameFor(medication.petId),
          descriptor: `Course ends — ${medication.name}`,
          screen: 'Meds',
        });
      }
    });

  found.sort(
    (a, b) => a.date.localeCompare(b.date) || a.descriptor.localeCompare(b.descriptor),
  );

  const shown = found.slice(0, UPCOMING_LIMIT);
  const groups: UpcomingGroup[] = [];
  shown.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.date === item.date) {
      last.items.push(item);
    } else {
      groups.push({
        date: item.date,
        label: relativeDateLabel(item.date, today),
        items: [item],
      });
    }
  });

  return { groups, hiddenCount: found.length - shown.length };
}
