/**
 * Home's bottom-half derivations (design Phase B2) — pure, offline, no storage.
 *
 * The Command Center home shows seven sections under the Daily Care Ring:
 * Today's Tasks, Needs Attention, Upcoming, Health Snapshot, Pet Spending,
 * Their Story and Blueprint Completion. This module is where every one of them
 * is *derived*: the screen reads the app's existing contexts and hands their
 * plain arrays here, and gets back small view models it can render.
 *
 * Two rules hold throughout, and they are the reason this is a separate module:
 *
 *  1. **Nothing is invented.** Every value comes from a record the owner
 *     actually created (a feeding schedule, a medication, a vaccine, a visit,
 *     an expense, a journal entry, a care check-in, a pet field). There is no
 *     demo data, no default date and no seeded anything. A pet with no dates
 *     simply contributes no rows.
 *  2. **Nothing shames.** An absent record is "not on file yet", a passed date
 *     is "past due — whenever suits", an unticked task is "not yet". No score,
 *     no streak penalty, no clinical verdict, no negative copy anywhere in this
 *     file.
 *
 * 100% offline: pure functions over already-loaded data — no network, no
 * AsyncStorage, no dependencies beyond the app's own types and helpers.
 */
import type {
  CareCheckInType,
  Expense,
  ExpenseCategory,
  FeedingSchedule,
  JournalEntry,
  Medication,
  Pet,
  Vaccine,
  VetRecord,
} from '../types';
import { isEveryDay, VACCINE_DUE_SOON_DAYS } from '../types';
import { isVetVisitLike } from '../types';
import { journalMoodEmoji } from '../types';
import { feedingScheduleLabel, medicationScheduleLabel } from '../types';
import type { ToneName } from '../theme';
import { petWeightLabel, shortDate } from './petDisplay';

const DAY_MS = 86_400_000;

/** How long a weigh-in stays "current" before Home gently mentions it. */
export const WEIGH_IN_PROMPT_DAYS = 60;

/** How soon an active medication's course ending counts as "refill due". */
export const REFILL_SOON_DAYS = 7;

/** How far ahead the Upcoming rail looks before Home stops listing items. */
export const UPCOMING_HORIZON_DAYS = 400;

/* ------------------------------------------------------------- dates -- */

/** Parse "YYYY-MM-DD" to UTC midnight ms; null when malformed. */
function isoToUTC(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(at) ? null : at;
}

/** Whole days from `todayISO` to `iso` (negative when the date has passed). */
export function daysFromToday(iso: string, todayISO: string): number | null {
  const from = isoToUTC(todayISO);
  const to = isoToUTC(iso);
  if (from === null || to === null) return null;
  return Math.round((to - from) / DAY_MS);
}

/** The weekday (0 = Sunday) of an ISO calendar day, or null when malformed. */
export function weekdayFromISO(iso: string): number | null {
  const at = isoToUTC(iso);
  return at === null ? null : new Date(at).getUTCDay();
}

/** The month a stored ISO date belongs to, as "YYYY-MM". */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * The next yearly occurrence of a stored date, on or after today. A birthday of
 * 2021-04-12 becomes 2027-04-12 once this year's has passed — never a guessed
 * date, and null for anything that isn't a real ISO day.
 */
export function nextAnniversary(iso: string, todayISO: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const today = isoToUTC(todayISO);
  if (!match || today === null) return null;
  const [, , month, day] = match;
  const year = Number(todayISO.slice(0, 4));
  const thisYear = `${year}-${month}-${day}`;
  const at = isoToUTC(thisYear);
  if (at === null) return null;
  return at >= today ? thisYear : `${year + 1}-${month}-${day}`;
}

/**
 * "Today", "Tomorrow", "in 6 days", "3 months ago" — the relative line the
 * Upcoming rail and Needs Attention use. Always neutral about the past: a
 * missed date is simply a date that has passed.
 */
export function relativeDayLabel(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) {
    if (days <= 30) return `in ${days} days`;
    if (days <= 60) return 'in about a month';
    return `in ${Math.round(days / 30)} months`;
  }
  const ago = -days;
  if (ago <= 30) return `${ago} days ago`;
  return `${Math.round(ago / 30)} months ago`;
}

/** How many years an anniversary turns on `onISO` (e.g. a 3rd birthday). */
export function anniversaryYears(iso: string, onISO: string): number | null {
  const start = isoToUTC(iso);
  const on = isoToUTC(onISO);
  if (start === null || on === null) return null;
  const years = new Date(on).getUTCFullYear() - new Date(start).getUTCFullYear();
  return years > 0 ? years : null;
}

/* ------------------------------------------------------------- data -- */

/**
 * Everything Home's bottom half derives from: the app's existing stores, plus
 * the two facts that depend on "now" (today's display-zone calendar day and its
 * weekday) and the day's care check-ins.
 */
export interface HomeData {
  pets: Pet[];
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  journal: JournalEntry[];
  /** Pet ids that have care instructions written (Sitter Mode stage 2). */
  careInstructionPetIds: string[];
  /** The acts already recorded for a pet on `todayISO` in the display zone. */
  doneTypesFor: (petId: string) => CareCheckInType[];
  /** Today, as the owner's chosen display zone sees it. */
  todayISO: string;
  /** That day's weekday (0 = Sunday). */
  weekday: number;
}

/* ------------------------------------------------------- today's tasks -- */

/**
 * One tickable line in Today's Tasks. `checkIn` is the care act the tick writes,
 * which is what keeps this list and the Daily Care Ring honest about each other:
 * ticking a meal records the `food` check-in, so the ring fills in too, and
 * ticking it again removes the record for both.
 */
export interface HomeTask {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  checkIn: CareCheckInType;
  done: boolean;
}

/** Is this medication scheduled for today? (Course window and repeat honoured.) */
function medicationDueToday(m: Medication, todayISO: string, weekday: number): boolean {
  if (!m.active) return false;
  if (m.endDate && m.endDate < todayISO) return false;
  if (m.startDate && m.startDate > todayISO) return false;
  if (m.times.length > 0) return true; // a fixed number of doses per day
  if (m.intervalDays <= 1) return true; // every day (or an unscheduled record)
  if (!m.startDate) return true; // an interval with no anchor — never hidden
  const since = daysFromToday(m.startDate, todayISO);
  if (since === null || since < 0) return true;
  return since % m.intervalDays === 0;
}

/**
 * Today's tasks for one pet: every meal and medication the pet's own schedules
 * put on today, in time order, each already carrying its ticked state.
 *
 * Water, exercise and care are deliberately *not* repeated here — the Care Ring
 * directly above is their home, and duplicating them would just read as nagging.
 */
export function buildTodayTasks(pet: Pet | null, data: HomeData): HomeTask[] {
  if (!pet) return [];
  const done = data.doneTypesFor(pet.id);
  const tasks: HomeTask[] = [];

  const meals = data.feeding
    .filter(
      (schedule) =>
        schedule.petId === pet.id &&
        (isEveryDay(schedule.daysOfWeek) || schedule.daysOfWeek.includes(data.weekday)),
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  for (const meal of meals) {
    tasks.push({
      id: `food-${meal.id}`,
      emoji: '🍽️',
      title: meal.mealType,
      detail: `${meal.time} · ${meal.portionAmount} ${meal.portionUnit}`,
      checkIn: 'food',
      done: done.includes('food'),
    });
  }

  const meds = data.medications
    .filter((medication) => medication.petId === pet.id)
    .filter((medication) => medicationDueToday(medication, data.todayISO, data.weekday))
    .sort((a, b) => (a.times[0] ?? '99:99').localeCompare(b.times[0] ?? '99:99'));
  for (const medication of meds) {
    tasks.push({
      id: `med-${medication.id}`,
      emoji: '💊',
      title: medication.name,
      detail: `${medication.dosage} · ${medicationScheduleLabel(medication)}`,
      checkIn: 'medication',
      done: done.includes('medication'),
    });
  }

  return tasks;
}

/* ----------------------------------------------------- needs attention -- */

/** A place a "Fix Now →" can send the owner. */
export type PetModuleScreen =
  | 'Vaccines'
  | 'Meds'
  | 'Feeding'
  | 'VetRecords'
  | 'Expenses'
  | 'Journal'
  | 'CareInstructionsEditor';

/** Where a "Fix Now →" action goes. TodayScreen turns each into navigation. */
export type FixAction =
  | { to: 'petForm'; petId: string }
  | { to: 'petModule'; petId: string; module: PetModuleScreen }
  | { to: 'addRecord' };

/** One surfaced thing worth a look, with the action that goes and sorts it. */
export interface AttentionItem {
  id: string;
  emoji: string;
  /** The pet it is about, shown as a kicker above the title. */
  petName: string;
  title: string;
  detail: string;
  tone: ToneName;
  /** Lower sorts first — overdue before a nudge before a missing record. */
  rank: number;
  fix: FixAction;
}

/**
 * Every surfaced item across the household, most pressing first.
 *
 * What can appear: a past-due or soon-due vaccine, a medication course about to
 * run out, a weigh-in that has gone stale (or was never taken), a vet visit
 * coming up, and the records worth starting from nothing at all. Each carries a
 * working destination, and every line is phrased as an invitation, never a
 * reprimand.
 */
export function buildAttention(data: HomeData): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const pet of data.pets) {
    const own = data.vaccines.filter((vaccine) => vaccine.petId === pet.id);
    // Only clinic visits and booked appointments count as "visits" here — a
    // filed document (an invoice, a lab printout) is not a trip to the vet and
    // must never read as one.
    const visits = data.vetRecords.filter(
      (record) => record.petId === pet.id && isVetVisitLike(record),
    );
    const meds = data.medications.filter(
      (medication) => medication.petId === pet.id && medication.active,
    );

    // 1. A vaccine whose due date has passed.
    const overdue = own
      .filter((vaccine) => vaccine.dueDate && vaccine.dueDate < data.todayISO)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
    if (overdue?.dueDate) {
      items.push({
        id: `vaccine-overdue-${overdue.id}`,
        emoji: '💉',
        petName: pet.name,
        title: `${overdue.name} is past due`,
        detail: `Due ${shortDate(overdue.dueDate)} — book it whenever suits, nothing here is on the clock.`,
        tone: 'coral',
        rank: 0,
        fix: { to: 'petModule', petId: pet.id, module: 'Vaccines' },
      });
    }

    // 2. A vaccine coming up inside the app's own "due soon" window.
    const soonest = own
      .filter(
        (vaccine) =>
          vaccine.dueDate &&
          vaccine.dueDate >= data.todayISO &&
          (daysFromToday(vaccine.dueDate, data.todayISO) ?? 999) <= VACCINE_DUE_SOON_DAYS,
      )
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))[0];
    if (soonest?.dueDate) {
      const days = daysFromToday(soonest.dueDate, data.todayISO) ?? 0;
      items.push({
        id: `vaccine-soon-${soonest.id}`,
        emoji: '💉',
        petName: pet.name,
        title: `${soonest.name} falls due soon`,
        detail: `${shortDate(soonest.dueDate)} — ${relativeDayLabel(days)}. Worth a call to the clinic.`,
        tone: 'sunshine',
        rank: 1,
        fix: { to: 'petModule', petId: pet.id, module: 'Vaccines' },
      });
    }

    // 3. A medication course about to run out — the only "refill" fact the app
    //    actually holds (there is no pharmacy inventory, so nothing is invented).
    for (const medication of meds) {
      if (!medication.endDate) continue;
      const days = daysFromToday(medication.endDate, data.todayISO);
      if (days === null || days > REFILL_SOON_DAYS) continue;
      items.push({
        id: `refill-${medication.id}`,
        emoji: '💊',
        petName: pet.name,
        title:
          days < 0
            ? `${medication.name}'s course has ended`
            : `${medication.name} runs out ${relativeDayLabel(days).toLowerCase()}`,
        detail:
          days < 0
            ? `Course finished ${shortDate(medication.endDate)}. Ask about a repeat if it's still needed.`
            : `${medication.dosage} · refill time if the course is continuing.`,
        tone: 'coral',
        rank: 2,
        fix: { to: 'petModule', petId: pet.id, module: 'Meds' },
      });
    }

    // 4. The weigh-in. The pet's weight field is the app's only weigh-in record,
    //    and `weightUpdatedAt` is the day it was last taken.
    if (typeof pet.weight !== 'number') {
      items.push({
        id: `weight-missing-${pet.id}`,
        emoji: '⚖️',
        petName: pet.name,
        title: 'No weigh-in on file yet',
        detail: 'A rough number is plenty — it starts the health card off.',
        tone: 'aqua',
        rank: 3,
        fix: { to: 'petForm', petId: pet.id },
      });
    } else if (!pet.weightUpdatedAt) {
      items.push({
        id: `weight-undated-${pet.id}`,
        emoji: '⚖️',
        petName: pet.name,
        title: `${petWeightLabel(pet)} is on file, no date yet`,
        detail: 'Add today’s weigh-in and Home can keep it current.',
        tone: 'aqua',
        rank: 4,
        fix: { to: 'petForm', petId: pet.id },
      });
    } else {
      const days = daysFromToday(pet.weightUpdatedAt, data.todayISO);
      if (days !== null && days <= -WEIGH_IN_PROMPT_DAYS) {
        items.push({
          id: `weight-stale-${pet.id}`,
          emoji: '⚖️',
          petName: pet.name,
          title: 'Looks like someone skipped weigh-in week',
          detail: `Last recorded ${shortDate(pet.weightUpdatedAt)} (${relativeDayLabel(days)}). No rush — whenever you're near a scale.`,
          tone: 'tangerine',
          rank: 3,
          fix: { to: 'petForm', petId: pet.id },
        });
      }
    }

    // 5. A vet visit coming up (a nudge, not a problem).
    const nextVisit = visits
      .filter((record) => record.visitDate >= data.todayISO)
      .sort((a, b) => a.visitDate.localeCompare(b.visitDate))[0];
    if (nextVisit) {
      const days = daysFromToday(nextVisit.visitDate, data.todayISO) ?? 0;
      const extra = nextVisit.clinicName ? ` · ${nextVisit.clinicName}` : '';
      items.push({
        id: `visit-${nextVisit.id}`,
        emoji: '📅',
        petName: pet.name,
        title: `${nextVisit.visitTitle} — ${relativeDayLabel(days)}`,
        detail: `${shortDate(nextVisit.visitDate)}${nextVisit.visitTime ? ` at ${nextVisit.visitTime}` : ''}${extra}`,
        tone: 'blue',
        rank: 5,
        fix: { to: 'petModule', petId: pet.id, module: 'VetRecords' },
      });
    }

    // 6. The health record starting from nothing.
    if (own.length === 0) {
      items.push({
        id: `vaccines-empty-${pet.id}`,
        emoji: '📋',
        petName: pet.name,
        title: 'No vaccine records yet',
        detail: 'Add what you have — the card from the last visit is enough.',
        tone: 'lavender',
        rank: 6,
        fix: { to: 'petModule', petId: pet.id, module: 'Vaccines' },
      });
    }
    if (visits.length === 0) {
      items.push({
        id: `visits-empty-${pet.id}`,
        emoji: '🩺',
        petName: pet.name,
        title: 'No vet visits logged',
        detail: 'Log the last checkup and the history builds itself from here.',
        tone: 'lavender',
        rank: 7,
        fix: { to: 'addRecord' },
      });
    }
  }

  return items.sort((a, b) => a.rank - b.rank);
}

/* -------------------------------------------------------------- upcoming -- */

/** One dated thing on the Upcoming rail, always with a real date behind it. */
export interface TimelineItem {
  id: string;
  emoji: string;
  /** ISO calendar date of the occurrence. */
  dateISO: string;
  title: string;
  detail: string;
  petName: string;
  tone: ToneName;
  /** Whole days from today (never negative — past items live in Needs Attention). */
  days: number;
  fix: FixAction;
}

/**
 * The household's next dates, in order: vet visits, vaccine due dates,
 * medication courses ending, birthdays and adoption days.
 *
 * A pet with no stored dates contributes nothing at all — no filler rows, no
 * "no birthday set" line. Anniversaries are the *next* occurrence, which is why
 * a birthday from 2021 shows up again this year.
 */
export function buildUpcoming(data: HomeData): TimelineItem[] {
  const items: TimelineItem[] = [];

  const push = (item: TimelineItem) => {
    if (item.days < 0 || item.days > UPCOMING_HORIZON_DAYS) return;
    items.push(item);
  };

  for (const pet of data.pets) {
    for (const record of data.vetRecords.filter(
      (r) => r.petId === pet.id && isVetVisitLike(r),
    )) {
      const days = daysFromToday(record.visitDate, data.todayISO);
      if (days === null) continue;
      push({
        id: `visit-${record.id}`,
        emoji: '📅',
        dateISO: record.visitDate,
        title: record.visitTitle,
        detail: [
          record.visitTime,
          record.clinicName ?? record.veterinarian,
        ]
          .filter(Boolean)
          .join(' · '),
        petName: pet.name,
        tone: 'blue',
        days,
        fix: { to: 'petModule', petId: pet.id, module: 'VetRecords' },
      });
    }

    for (const vaccine of data.vaccines.filter((v) => v.petId === pet.id)) {
      if (!vaccine.dueDate) continue;
      const days = daysFromToday(vaccine.dueDate, data.todayISO);
      if (days === null) continue;
      push({
        id: `vaccine-${vaccine.id}`,
        emoji: '💉',
        dateISO: vaccine.dueDate,
        title: `${vaccine.name} due`,
        detail: `Given ${shortDate(vaccine.dateGiven)}`,
        petName: pet.name,
        tone: 'lavender',
        days,
        fix: { to: 'petModule', petId: pet.id, module: 'Vaccines' },
      });
    }

    for (const medication of data.medications.filter((m) => m.petId === pet.id && m.active)) {
      if (!medication.endDate) continue;
      const days = daysFromToday(medication.endDate, data.todayISO);
      if (days === null) continue;
      push({
        id: `course-${medication.id}`,
        emoji: '💊',
        dateISO: medication.endDate,
        title: `${medication.name} course ends`,
        detail: `${medication.dosage} · started ${shortDate(medication.startDate ?? medication.createdAt.slice(0, 10))}`,
        petName: pet.name,
        tone: 'coral',
        days,
        fix: { to: 'petModule', petId: pet.id, module: 'Meds' },
      });
    }

    if (pet.birthdate) {
      const next = nextAnniversary(pet.birthdate, data.todayISO);
      const days = next ? daysFromToday(next, data.todayISO) : null;
      if (next && days !== null) {
        const turns = anniversaryYears(pet.birthdate, next);
        push({
          id: `birthday-${pet.id}-${next}`,
          emoji: '🎂',
          dateISO: next,
          title: `${pet.name}'s birthday`,
          detail: turns ? `Turning ${turns} 🎉` : 'A whole year older',
          petName: pet.name,
          tone: 'sunshine',
          days,
          fix: { to: 'petForm', petId: pet.id },
        });
      }
    }

    if (pet.adoptionDate) {
      const next = nextAnniversary(pet.adoptionDate, data.todayISO);
      const days = next ? daysFromToday(next, data.todayISO) : null;
      if (next && days !== null) {
        const together = anniversaryYears(pet.adoptionDate, next);
        push({
          id: `adoption-${pet.id}-${next}`,
          emoji: '🏡',
          dateISO: next,
          title: `${pet.name}'s adoption day`,
          detail: together ? `${together} year${together === 1 ? '' : 's'} together ❤️` : 'Happy gotcha day',
          petName: pet.name,
          tone: 'leaf',
          days,
          fix: { to: 'petForm', petId: pet.id },
        });
      }
    }
  }

  return items.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
}

/* -------------------------------------------------------- health snapshot -- */

/** One line of the Health Snapshot card. */
export interface HealthRow {
  id: string;
  emoji: string;
  label: string;
  value: string;
  hint?: string;
  tone: ToneName;
}

/** One pet's health picture, as the stores actually hold it. */
export interface HealthSnapshot {
  petId: string;
  rows: HealthRow[];
  /** Short vaccination status for the card's pill. */
  vaccineStatus: string;
  vaccineTone: ToneName;
}

/**
 * One pet's Health Snapshot: the latest weight and when it was taken, the
 * vaccination picture, what medication is on board, the last vet visit, and the
 * newest wellbeing note from the journal.
 *
 * There is no separate vitals/measurement store in the app yet, so nothing here
 * pretends to be a clinical reading: each row is a record the owner created, and
 * an absent one says so plainly.
 */
export function buildHealthSnapshot(pet: Pet | null, data: HomeData): HealthSnapshot {
  if (!pet) return { petId: '', rows: [], vaccineStatus: 'No records', vaccineTone: 'neutral' };

  const own = data.vaccines
    .filter((vaccine) => vaccine.petId === pet.id)
    .sort((a, b) => (b.dueDate ?? b.dateGiven).localeCompare(a.dueDate ?? a.dateGiven));
  const visits = data.vetRecords
    .filter((record) => record.petId === pet.id && isVetVisitLike(record))
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  const meds = data.medications.filter(
    (medication) => medication.petId === pet.id && medication.active,
  );
  const moods = data.journal
    .filter((entry) => entry.petId === pet.id && entry.mood)
    .sort(
      (a, b) =>
        b.entryDate.localeCompare(a.entryDate) || b.createdAt.localeCompare(a.createdAt),
    );

  const rows: HealthRow[] = [];

  // Latest weight + the day it was recorded.
  const weight = petWeightLabel(pet);
  if (weight) {
    const days = pet.weightUpdatedAt ? daysFromToday(pet.weightUpdatedAt, data.todayISO) : null;
    rows.push({
      id: 'weight',
      emoji: '⚖️',
      label: 'Latest weight',
      value: weight,
      hint:
        days === null
          ? 'No weigh-in date on file yet'
          : `Last weigh-in ${relativeDayLabel(days)} · ${shortDate(pet.weightUpdatedAt as string)}`,
      tone: days !== null && days <= -WEIGH_IN_PROMPT_DAYS ? 'tangerine' : 'leaf',
    });
  } else {
    rows.push({
      id: 'weight',
      emoji: '⚖️',
      label: 'Latest weight',
      value: 'Not on file yet',
      hint: 'Add it on the pet page — any rough number works',
      tone: 'neutral',
    });
  }

  // Vaccinations.
  const overdue = own.find((vaccine) => vaccine.dueDate && vaccine.dueDate < data.todayISO);
  const dueSoon = own.find(
    (vaccine) =>
      vaccine.dueDate &&
      vaccine.dueDate >= data.todayISO &&
      (daysFromToday(vaccine.dueDate, data.todayISO) ?? 999) <= VACCINE_DUE_SOON_DAYS,
  );
  let vaccineStatus = 'No records yet';
  let vaccineTone: ToneName = 'neutral';
  let vaccineValue = 'Nothing on file yet';
  let vaccineHint = 'Add the last shot and the dates look after themselves';
  if (overdue?.dueDate) {
    vaccineStatus = 'Past due';
    vaccineTone = 'coral';
    vaccineValue = `${overdue.name} overdue`;
    vaccineHint = `Due ${shortDate(overdue.dueDate)}`;
  } else if (dueSoon?.dueDate) {
    vaccineStatus = 'Due soon';
    vaccineTone = 'sunshine';
    vaccineValue = `${dueSoon.name} due soon`;
    vaccineHint = `Due ${shortDate(dueSoon.dueDate)}`;
  } else if (own.length > 0) {
    vaccineStatus = 'Up to date';
    vaccineTone = 'leaf';
    vaccineValue = `${own.length} record${own.length === 1 ? '' : 's'}, all in date`;
    vaccineHint = own[0]?.dueDate
      ? `Next due ${shortDate(own[0].dueDate)}`
      : 'None have a due date set';
  }
  rows.push({
    id: 'vaccines',
    emoji: '💉',
    label: 'Vaccinations',
    value: vaccineValue,
    hint: vaccineHint,
    tone: vaccineTone,
  });

  // Medication on board.
  rows.push({
    id: 'meds',
    emoji: '💊',
    label: 'Medication',
    value:
      meds.length === 0
        ? 'None active'
        : `${meds.length} active course${meds.length === 1 ? '' : 's'}`,
    hint:
      meds.length === 0
        ? 'Nothing on the meds shelf'
        : meds
            .slice(0, 2)
            .map((medication) => medication.name)
            .join(' · '),
    tone: meds.length === 0 ? 'neutral' : 'coral',
  });

  // Last vet visit.
  const last = visits[0];
  rows.push({
    id: 'visit',
    emoji: '🩺',
    label: 'Last vet visit',
    value: last ? last.visitTitle : 'No visits logged',
    hint: last
      ? `${shortDate(last.visitDate)}${last.clinicName ? ` · ${last.clinicName}` : ''}`
      : 'Log a visit and it shows here',
    tone: last ? 'blue' : 'neutral',
  });

  // The newest mood the owner journaled — the closest thing to "how are they
  // doing" the app honestly holds.
  const mood = moods[0];
  rows.push({
    id: 'mood',
    emoji: mood?.mood ? journalMoodEmoji(mood.mood) : '📝',
    label: 'Latest observation',
    value: mood?.mood ? `${mood.mood}` : 'Nothing journaled yet',
    hint: mood ? `From their story · ${shortDate(mood.entryDate)}` : 'A line in the journal fills this in',
    tone: mood?.mood === 'Sick' ? 'coral' : mood ? 'lavender' : 'neutral',
  });

  return { petId: pet.id, rows, vaccineStatus, vaccineTone };
}

/* ------------------------------------------------------------- spending -- */

/** One category's share of a month's spending. */
export interface SpendSlice {
  category: ExpenseCategory;
  amount: number;
  /** 0–1 of the month's total. */
  share: number;
}

/** A month of spending for one pet (or the household). */
export interface SpendSummary {
  total: number;
  count: number;
  slices: SpendSlice[];
  top?: SpendSlice;
}

/** The month's spend, by category, from the real expense store. */
export function buildSpend(
  expenses: Expense[],
  petId: string | null,
  monthKey: string,
): SpendSummary {
  const inMonth = expenses.filter(
    (expense) =>
      monthKeyOf(expense.date) === monthKey && (petId === null || expense.petId === petId),
  );
  const total = inMonth.reduce(
    (sum, expense) => sum + (Number.isFinite(expense.amount) ? expense.amount : 0),
    0,
  );
  const byCategory = new Map<ExpenseCategory, number>();
  for (const expense of inMonth) {
    const amount = Number.isFinite(expense.amount) ? expense.amount : 0;
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + amount);
  }
  const slices: SpendSlice[] = [...byCategory.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: total > 0 ? amount / total : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { total, count: inMonth.length, slices, top: slices[0] };
}

/** The command-center copy for a month's total. Never judgemental about it. */
export function spendPraise(petName: string, total: number): string {
  if (total <= 0) return `${petName} had a free month. Suspicious.`;
  if (total < 25) return `A modest month for ${petName} — well played.`;
  if (total < 100) return `${petName} is worth every penny, and the receipts agree.`;
  if (total < 400) return `Someone has been living their best life at ${petName}'s house.`;
  return `Spoiled, adored, and entirely unrepentant.`;
}

/* ---------------------------------------------------- blueprint progress -- */

/** One thing a complete pet profile/record set has. */
export interface BlueprintItem {
  id: string;
  label: string;
  done: boolean;
  /** Where "Fix Now" would take you for this item. */
  fix: FixAction;
}

/** One pet's completion strip. */
export interface BlueprintProgress {
  petId: string;
  petName: string;
  items: BlueprintItem[];
  doneCount: number;
  total: number;
  percent: number;
  /** The first thing still missing, if any — the gentle "next" hint. */
  next?: BlueprintItem;
}

/**
 * How complete one pet's blueprint is: a photo, the profile basics, a weigh-in,
 * a vaccine record, the first vet visit and care instructions for whoever steps
 * in. It is a map of what is in place — never a score, never a grade.
 */
export function buildBlueprint(pet: Pet, data: HomeData): BlueprintProgress {
  const items: BlueprintItem[] = [
    { id: 'photo', label: 'A photo', done: !!pet.photoUri, fix: { to: 'petForm', petId: pet.id } },
    {
      id: 'breed',
      label: 'Breed on the profile',
      done: !!pet.breed?.trim(),
      fix: { to: 'petForm', petId: pet.id },
    },
    {
      id: 'birthday',
      label: 'A birthday',
      done: !!pet.birthdate,
      fix: { to: 'petForm', petId: pet.id },
    },
    {
      id: 'weight',
      label: 'A weigh-in',
      done: typeof pet.weight === 'number',
      fix: { to: 'petForm', petId: pet.id },
    },
    {
      id: 'vaccines',
      label: 'A vaccine record',
      done: data.vaccines.some((vaccine) => vaccine.petId === pet.id),
      fix: { to: 'petModule', petId: pet.id, module: 'Vaccines' },
    },
    {
      id: 'visit',
      label: 'Their first vet visit',
      done: data.vetRecords.some(
        (record) => record.petId === pet.id && isVetVisitLike(record),
      ),
      fix: { to: 'addRecord' },
    },
    {
      id: 'care',
      label: 'Care instructions for sitters',
      done: data.careInstructionPetIds.includes(pet.id),
      fix: { to: 'petModule', petId: pet.id, module: 'CareInstructionsEditor' },
    },
  ];
  const doneCount = items.filter((item) => item.done).length;
  return {
    petId: pet.id,
    petName: pet.name,
    items,
    doneCount,
    total: items.length,
    percent: Math.round((doneCount / items.length) * 100),
    next: items.find((item) => !item.done),
  };
}

/* -------------------------------------------------------------- memories -- */

/**
 * A pet's newest journal entries, newest first, capped for the Home card. The
 * store's own per-pet selector already sorts them, so this only trims.
 */
export function recentMemories(entries: JournalEntry[], max = 3): JournalEntry[] {
  return entries.slice(0, max);
}
