/**
 * Caregiver Check-In derivations — the pure heart of Sitter Mode's check-in
 * engine (everything the new screens show, with no React and no storage in
 * sight, so it can be exercised directly in Node).
 *
 * Three jobs, all read-only over the app's own records:
 *
 *  1. **Log lines.** One recorded event, said out loud: "Fed by Sarah —
 *     8:03 AM", "Mood: Normal — Sarah — 8:02 AM". The clock is rendered in the
 *     owner's chosen display zone through `utils/datetime`, exactly like the
 *     Daily Care Ring's day maths, so a sitter's 8:03 AM and the owner's 8:03 AM
 *     are the same fact. A record with no name simply omits the name; a record
 *     with an unusable timestamp omits the time rather than printing `NaN`.
 *  2. **The owner's log.** The same lines, newest first, grouped by the local
 *     day they happened on (Today / Yesterday / a date), from the per-pet
 *     repository.
 *  3. **Today's tasks per pet** — derived honestly from the real feeding and
 *     medication schedules plus the pet's written care instructions. A task
 *     line says what the pet's own schedules put on today; the badge beside it
 *     says what has been *recorded*, which is the only thing the app can know.
 *     Nothing here can produce a "missed" state: a day with no schedule data
 *     produces no rows at all, and the act buttons always work.
 *
 * Tone rule (kept literally, checked by the harness): no string in this file
 * scolds. There is no "missed", "failed", "late" or "overdue" anywhere, and an
 * unrecorded act is simply absent.
 *
 * 100% offline: pure functions over in-memory records.
 */
import {
  CARE_ACT_LABELS,
  careCheckInByName,
  careCheckInIsOn,
  PET_MOOD_EMOJI,
  PET_MOOD_LABELS,
  petMoodOrNull,
} from '../types/checkIn';
import type { CareCheckInEvent, CareCheckInType, PetMood } from '../types/checkIn';
import { isEveryDay, medicationScheduleLabel } from '../types';
import type { CareInstructions, FeedingSchedule, Medication } from '../types';
import { formatDateOnlyInTimeZone, formatInTimeZone, todayISOInTimeZone } from './datetime';
import { daysFromToday, weekdayFromISO } from './homeSections';
import { shiftISODate } from './gamification';

/* ------------------------------------------------------------- one line -- */

/** The clock on a log line, e.g. "8:03 AM" — empty when the timestamp is junk. */
export function careLogTime(at: string, zone?: string): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return '';
  const rendered = formatInTimeZone(
    when,
    zone,
    { hour: 'numeric', minute: '2-digit', hour12: true },
    'en-US',
  ).trim();
  return rendered;
}

/**
 * One event as the log says it.
 *
 *  - a care act:  "Fed by Sarah — 8:03 AM"  (or "Fed — 8:03 AM" with no name)
 *  - a mood:      "Mood: Normal — Sarah — 8:02 AM"
 *
 * An unrecognised stored `type` still renders as something honest ("Care
 * check-in") rather than `undefined`, and an unparseable timestamp drops the
 * time instead of printing `NaN`.
 */
export function careLogLine(event: CareCheckInEvent, zone?: string): string {
  const label = CARE_ACT_LABELS[event.type] ?? 'Care check-in';
  const name = careCheckInByName(event);
  const time = careLogTime(event.at, zone);

  if (event.type === 'mood') {
    const mood = petMoodOrNull(event.mood);
    const moodLabel = mood ? PET_MOOD_LABELS[mood] : 'Noted';
    const parts = [`Mood: ${moodLabel}`];
    if (name) parts.push(name);
    if (time) parts.push(time);
    return parts.join(' — ');
  }

  if (name && time) return `${label} by ${name} — ${time}`;
  if (name) return `${label} by ${name}`;
  if (time) return `${label} — ${time}`;
  return label;
}

/** The local calendar day an event fell on, or '' when the timestamp is junk. */
export function careLogDayKey(at: string, zone?: string): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return '';
  return todayISOInTimeZone(when, zone);
}

/** How a day's heading reads: today, yesterday, or the date itself. */
export function careLogDayLabel(dayKey: string, todayKey: string, zone?: string): string {
  if (!dayKey) return 'Date unknown';
  if (dayKey === todayKey) return 'Today';
  if (dayKey === shiftISODate(todayKey, -1)) return 'Yesterday';
  return formatDateOnlyInTimeZone(dayKey, zone) || dayKey;
}

/** One line in the owner's log, already said out loud. */
export interface CareLogEntry {
  id: string;
  /** The event this line came from (kept for an honest "undo"). */
  event: CareCheckInEvent;
  text: string;
  at: string;
  /** The local day it happened on ('' when the timestamp is unusable). */
  dayKey: string;
}

/** One day's worth of lines, newest day first. */
export interface CareLogGroup {
  dayKey: string;
  label: string;
  entries: CareLogEntry[];
}

/**
 * One pet's whole log, newest first, grouped by local day.
 *
 * Pure and storage-free: it takes the events the per-pet repository returned.
 * Events with an unusable timestamp land in a trailing "Date unknown" group
 * rather than being thrown away — a record the owner can still see beats one
 * that silently vanished.
 */
export function careLogGroups(
  events: readonly CareCheckInEvent[],
  petId: string,
  todayKey: string,
  zone?: string,
): CareLogGroup[] {
  const mine = events.filter((event) => event.petId === petId);
  const sorted = [...mine].sort((a, b) => {
    const left = careLogDayKey(a.at, zone);
    const right = careLogDayKey(b.at, zone);
    if (!left && !right) return 0;
    if (!left) return 1; // unusable timestamps last
    if (!right) return -1;
    return b.at.localeCompare(a.at);
  });

  const groups = new Map<string, CareLogGroup>();
  for (const event of sorted) {
    const dayKey = careLogDayKey(event.at, zone);
    let group = groups.get(dayKey);
    if (!group) {
      group = { dayKey, label: careLogDayLabel(dayKey, todayKey, zone), entries: [] };
      groups.set(dayKey, group);
    }
    group.entries.push({
      id: event.id,
      event,
      text: careLogLine(event, zone),
      at: event.at,
      dayKey,
    });
  }
  return [...groups.values()];
}

/** How many events a pet has in total — the pet page's honest count. */
export function careLogCount(events: readonly CareCheckInEvent[], petId: string): number {
  return events.filter((event) => event.petId === petId).length;
}

/* --------------------------------------------------------- today's acts -- */

/** Every event of one act kind for one pet on one local day. */
function eventsOn(
  events: readonly CareCheckInEvent[],
  petId: string,
  dayKey: string,
  zone?: string,
): CareCheckInEvent[] {
  return events.filter(
    (event) => event.petId === petId && careCheckInIsOn(event, dayKey, zone),
  );
}

/** How many times one act was recorded for a pet today. */
export function actCountToday(
  events: readonly CareCheckInEvent[],
  petId: string,
  type: CareCheckInType,
  dayKey: string,
  zone?: string,
): number {
  return eventsOn(events, petId, dayKey, zone).filter((event) => event.type === type).length;
}

/** Which acts have been recorded for a pet today (moods excluded). */
export function actsToday(
  events: readonly CareCheckInEvent[],
  petId: string,
  dayKey: string,
  zone?: string,
): CareCheckInType[] {
  const done = eventsOn(events, petId, dayKey, zone)
    .map((event) => event.type)
    .filter((type) => type !== 'mood');
  return [...new Set(done)];
}

/** The caregiver's latest read of a pet today, or null. Latest wins. */
export function latestMoodToday(
  events: readonly CareCheckInEvent[],
  petId: string,
  dayKey: string,
  zone?: string,
): { mood: PetMood; byName: string | null; at: string } | null {
  const moods = eventsOn(events, petId, dayKey, zone).filter((event) => {
    return event.type === 'mood' && petMoodOrNull(event.mood) !== null;
  });
  if (moods.length === 0) return null;
  const latest = moods.reduce((best, event) => (event.at > best.at ? event : best));
  const mood = petMoodOrNull(latest.mood);
  if (!mood) return null;
  return { mood, byName: careCheckInByName(latest), at: latest.at };
}

/** Today's recorded lines for one pet, newest first (the sitter's own log). */
export function todayLogEntries(
  events: readonly CareCheckInEvent[],
  petId: string,
  dayKey: string,
  zone?: string,
): CareLogEntry[] {
  return eventsOn(events, petId, dayKey, zone)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => ({
      id: event.id,
      event,
      text: careLogLine(event, zone),
      at: event.at,
      dayKey,
    }));
}

/* -------------------------------------------------------- today's tasks -- */

/**
 * One line of "what today holds" for a pet, derived from the pet's own
 * schedules. `status` is what has actually been *recorded* (never an
 * expectation, never a warning).
 */
export interface PetDayTask {
  id: string;
  /** The act this line's badge counts (so a tap and a badge agree). */
  type: CareCheckInType;
  emoji: string;
  title: string;
  detail: string;
  /** e.g. "1 of 2 done", "given" — absent when nothing is recorded yet. */
  status?: string;
}

/** Everything today's task lines are derived from. */
export interface PetDayInput {
  events: readonly CareCheckInEvent[];
  feeding: readonly FeedingSchedule[];
  medications: readonly Medication[];
  /** The pet's written care notes, when they have any. */
  careInstructions?: CareInstructions | null;
  /** Today in the owner's display zone (`YYYY-MM-DD`). */
  todayKey: string;
  zone?: string;
}

/** Is this medication on today's list? (Course window and repeat honoured.) */
function medicationDueToday(m: Medication, todayKey: string): boolean {
  if (!m.active) return false;
  if (m.endDate && m.endDate < todayKey) return false;
  if (m.startDate && m.startDate > todayKey) return false;
  if (m.times.length > 0) return true; // a fixed number of doses per day
  if (m.intervalDays <= 1) return true; // every day (or an unscheduled record)
  if (!m.startDate) return true; // an interval with no anchor — never hidden
  const since = daysFromToday(m.startDate, todayKey);
  if (since === null || since < 0) return true;
  return since % m.intervalDays === 0;
}

/** A note trimmed for a one-line task detail (never truncated mid-word ugly). */
function noteBrief(note: string | undefined, max = 90): string {
  const trimmed = note?.trim() ?? '';
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Today's task lines for one pet, in time order: the meals the pet's feeding
 * schedule puts on today, then each medication the pet's course window puts on
 * today, then — only when the owner has written them — the walk and the
 * bathroom routine from the pet's care instructions.
 *
 * Empty when the pet has no schedule data at all: the screen then says so
 * plainly and leaves the act buttons to do their job. Water is deliberately
 * never listed here — it is a tap, not a schedule, and inventing a "due" for
 * it would be exactly the kind of guess this app does not make.
 */
export function petDayTasks(
  petId: string,
  input: PetDayInput,
): PetDayTask[] {
  const tasks: PetDayTask[] = [];
  const weekday = weekdayFromISO(input.todayKey);
  const done = (type: CareCheckInType): number =>
    actCountToday(input.events, petId, type, input.todayKey, input.zone);

  const meals = input.feeding
    .filter(
      (schedule) =>
        schedule.petId === petId &&
        (isEveryDay(schedule.daysOfWeek) ||
          (weekday !== null && schedule.daysOfWeek.includes(weekday))),
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  if (meals.length > 0) {
    const fed = Math.min(done('food'), meals.length);
    tasks.push({
      id: `food-${petId}`,
      type: 'food',
      emoji: '🍽️',
      title: meals.length === 1 ? 'Feeding' : `Feeding ${meals.length}× today`,
      detail: meals.map((meal) => `${meal.mealType} ${meal.time}`).join(' · '),
      ...(fed > 0 ? { status: `${fed} of ${meals.length} done` } : {}),
    });
  }

  const meds = input.medications
    .filter((medication) => medication.petId === petId)
    .filter((medication) => medicationDueToday(medication, input.todayKey))
    .sort((a, b) => (a.times[0] ?? '99:99').localeCompare(b.times[0] ?? '99:99'));

  for (const medication of meds) {
    tasks.push({
      id: `med-${medication.id}`,
      type: 'medication',
      emoji: '💊',
      title: medication.name,
      detail: `${medication.dosage} · ${medicationScheduleLabel(medication)}`,
      ...(done('medication') > 0 ? { status: 'given' } : {}),
    });
  }

  const notes = input.careInstructions;
  const walk = noteBrief(notes?.walkSchedule);
  if (walk) {
    tasks.push({
      id: `walk-${petId}`,
      type: 'exercise',
      emoji: '🐾',
      title: 'Walk',
      detail: walk,
      ...(done('exercise') > 0 ? { status: 'done' } : {}),
    });
  }

  const bathroom = noteBrief(notes?.litterRoutine ?? notes?.yardRoutine);
  if (bathroom) {
    tasks.push({
      id: `litter-${petId}`,
      type: 'litter',
      emoji: '🧹',
      title: 'Litter & bathroom',
      detail: bathroom,
      ...(done('litter') > 0 ? { status: 'cleaned' } : {}),
    });
  }

  return tasks;
}

/** The glyph for a mood chip (re-exported so screens import from one place). */
export function moodEmoji(mood: PetMood): string {
  return PET_MOOD_EMOJI[mood] ?? '🐾';
}
