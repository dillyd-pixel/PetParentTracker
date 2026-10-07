/**
 * Printable Pet Planner — the document model and its builder.
 *
 * `buildPlannerDocument()` is a PURE function: it takes the owner's already
 * loaded on-device records (the very same stores the rest of the app reads),
 * the chosen pets, the chosen sections and the paper size, and returns a
 * `PlannerDocument` — a structured description of the printed planner.
 *
 * Two renderers consume that model, so the printed PDF and the on-device
 * preview can never drift apart:
 *  - `./html` turns it into the self-contained print HTML that `expo-print`
 *    renders to a PDF (and the browser prints directly).
 *  - `../../components/PlannerPaperView` renders it natively for the preview
 *    screen on a device, where no WebView is available.
 *
 * Honesty rules baked in here:
 *  - Nothing is invented. Every line comes from a stored record, or from the
 *    owner's own name. A section with no data prints a friendly empty note
 *    ("No vaccinations logged yet.") — never a demo value, never a zero.
 *  - Ruled blank tables are TEMPLATE FURNITURE, not data: the calendar grid,
 *    and the write-in logs a printed planner is for. They carry no values.
 *  - Local photos cannot be embedded in an offline print document, so they are
 *    noted as being on the device ("photo on this device").
 *
 * 100% offline: pure computation over local arrays — no fetch, no URLs.
 */
import type {
  CareCheckInEvent,
  CareInstructions,
  Expense,
  FeedingSchedule,
  JournalEntry,
  Medication,
  Pet,
  Vaccine,
  VetRecord,
} from '../../types';
import {
  CARE_CHECK_IN_LABELS,
  VACCINE_DUE_SOON_DAYS,
  careInstructionsGroupsWithContent,
  careInstructionValue,
  feedingDaysLabel,
  feedingScheduleLabel,
  isVetVisitLike,
  medicationScheduleLabel,
  vetRecordKind,
} from '../../types';
import { petAgeLabel, petEmojiFor, petMetaLine, petSpeciesLabel } from '../../utils/petDisplay';
import { formatTimestampInTimeZone } from '../../utils/datetime';
import {
  PLANNER_SECTIONS,
  type PaperSize,
  type PlannerSectionDef,
  type PlannerSectionId,
  normalizeSectionIds,
} from './sections';

/* ------------------------------------------------------------------ model ---- */

/** One label/value line (the profile table, a clinic's details, a total). */
export interface PlannerKeyValue {
  label: string;
  value: string;
}

/** One entry in a bulleted block: a bold title, a small meta line, a note. */
export interface PlannerListItem {
  title: string;
  meta?: string;
  note?: string;
}

/** A day's marks inside one printed month: day-of-month → glyphs. */
export interface PlannerMonth {
  /** e.g. "October 2026". */
  label: string;
  year: number;
  /** 1-based month (1 = January) — how the grid is drawn, not a Date. */
  month: number;
  /** Weekday of day 1, 0 = Sunday (mirrors `Date.getDay()`). */
  firstWeekday: number;
  /** Days in this month. */
  daysInMonth: number;
  /** Glyphs per day-of-month, in the order they were added. */
  marks: Record<number, string[]>;
}

/** What one glyph in the calendar means — printed as the month legend. */
export interface PlannerLegend {
  emoji: string;
  label: string;
}

/**
 * One block of a printed section. The renderers switch on `kind`, so a new kind
 * is a compile error in both of them until it is handled.
 */
export type PlannerBlock =
  | {
      /** A paragraph. `muted` marks a friendly empty note (printed italic). */
      kind: 'text';
      text: string;
      muted?: boolean;
    }
  /** A quiet sub-heading inside a section, e.g. "Booked appointments". */
  | { kind: 'subheading'; text: string }
  /** A label/value table (pet profile, contact card, spend totals). */
  | { kind: 'kv'; rows: PlannerKeyValue[] }
  /** A bulleted list of records. */
  | { kind: 'list'; items: PlannerListItem[] }
  /**
   * A write-in table: fixed column headers, rows that are either real values or
   * blank ruled lines for the owner to fill in with a pen.
   */
  | { kind: 'log'; columns: string[]; rows: string[][]; hint?: string }
  /** The 12-month planning grid with the pet's known dates marked. */
  | { kind: 'calendar'; months: PlannerMonth[]; legend: PlannerLegend[] }
  /** A dashed photo frame — template furniture for a printed keepsake. */
  | { kind: 'frame'; text: string };

/** One printed section: its heading and its blocks. */
export interface PlannerSectionContent {
  id: PlannerSectionId;
  title: string;
  emoji: string;
  blocks: PlannerBlock[];
}

/** One pet's chapter of the planner (one pet, or one of several). */
export interface PlannerChapter {
  petId: string;
  petName: string;
  petEmoji: string;
  /** Species · breed · age line under the pet's name. */
  meta: string;
  sections: PlannerSectionContent[];
}

/** The whole planner, ready to render to HTML or to native views. */
export interface PlannerDocument {
  /** Document title, e.g. "Bella's pet planner". */
  title: string;
  /** Kicker above the title (the brand line). */
  kicker: string;
  /** Generated-on + paper + offline line under the title. */
  subtitle: string;
  /** The pet names on the cover, in order. */
  petNames: string[];
  /** The sections included, in print order (the cover's "what's inside"). */
  sectionTitles: string[];
  paper: PaperSize;
  chapters: PlannerChapter[];
}

/** Everything the builder reads — the owner's own stores, already loaded. */
export interface PlannerSource {
  pets: Pet[];
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  journal: JournalEntry[];
  checkIns: CareCheckInEvent[];
  /** Care-instruction records (one per pet, however many exist). */
  careInstructions: CareInstructions[];
  /** The owner's name as set in Settings — the only "contact" the app stores. */
  ownerName: string;
  /** The chosen display time zone (`auto` = this device's own). */
  timeZone?: string;
}

/** What the owner chose on the Customize screen. */
export interface PlannerConfig {
  /** The pets to print: one, several, or every pet in the household. */
  petIds: string[];
  /** The sections to include, in any order (normalized to print order). */
  sectionIds: readonly PlannerSectionId[];
  paper: PaperSize;
}

/* --------------------------------------------------------------- helpers ---- */

/** A friendly, honest empty note — never a fabricated value. */
function empty(text: string): PlannerBlock {
  return { kind: 'text', text, muted: true };
}

/** A real summary line (not an empty note). */
function line(text: string): PlannerBlock {
  return { kind: 'text', text };
}

function subheading(text: string): PlannerBlock {
  return { kind: 'subheading', text };
}

/** Parse "YYYY-MM-DD" into its parts without touching the device time zone. */
function parseISODate(iso?: string): { year: number; month: number; day: number } | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * ISO date (YYYY-MM-DD) → "9 Aug 2026"; falls back to the raw value.
 *
 * A stored date is a calendar fact, not a moment in time: it is printed as the
 * owner typed it, so no time zone can ever shuffle it onto the next day.
 */
function dateText(iso?: string): string {
  if (!iso) return '—';
  const parts = parseISODate(iso);
  if (!parts) return iso;
  const months = [
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
  return `${parts.day} ${months[parts.month - 1]} ${parts.year}`;
}

/** "due in 12 days" / "overdue by 3 days" / "due today" / "no due date". */
function vaccineDueText(v: Vaccine, today: Date): string {
  const due = parseISODate(v.dueDate);
  if (!due) return 'no due date set';
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDate = new Date(due.year, due.month - 1, due.day);
  const days = Math.round((dueDate.getTime() - startOfToday.getTime()) / 86400000);
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'due today';
  if (days <= VACCINE_DUE_SOON_DAYS) return `due in ${days} day${days === 1 ? '' : 's'}`;
  return `next due in ${days} day${days === 1 ? '' : 's'}`;
}

/** Local photos never embed in an offline print document — say so, honestly. */
function photoNote(photoUri?: string): string | undefined {
  return photoUri ? 'photo on this device' : undefined;
}

/** Join the parts of a meta line, dropping the empty ones. */
function metaLine(parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((part): part is string => Boolean(part && part.trim()));
  return kept.length > 0 ? kept.join(' · ') : undefined;
}

/** Sort newest first by an ISO date field (stable for equal dates). */
function byDateDesc<T>(rows: T[], pick: (row: T) => string): T[] {
  return [...rows].sort((a, b) => pick(b).localeCompare(pick(a)));
}

/** Sort oldest first by an ISO date field. */
function byDateAsc<T>(rows: T[], pick: (row: T) => string): T[] {
  return [...rows].sort((a, b) => pick(a).localeCompare(pick(b)));
}

/** The calendar glyphs and the legend line they print with. */
const MARK = {
  vaccine: '💉',
  vet: '🏥',
  medStart: '💊',
  medEnd: '🏁',
  birthday: '🎂',
  adoption: '🏡',
} as const;

const MARK_LEGEND: Record<string, string> = {
  [MARK.vaccine]: 'vaccination due',
  [MARK.vet]: 'vet visit or appointment',
  [MARK.medStart]: 'medication starts',
  [MARK.medEnd]: 'medication ends',
  [MARK.birthday]: 'birthday',
  [MARK.adoption]: 'gotcha day',
};

/* -------------------------------------------------------------- calendar ---- */

/**
 * The 12 months the planner covers: the current month and the eleven after it,
 * as plain year/month pairs (no Date arithmetic across time zones).
 */
export function plannerMonths(today: Date, count = 12): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  for (let i = 0; i < count; i += 1) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Days in a month, from the device's own calendar maths. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Weekday of day 1 (0 = Sunday). */
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** The pet's own dates, keyed "YYYY-M-D" for the months on the grid. */
function marksForPet(
  pet: Pet,
  vaccines: Vaccine[],
  medications: Medication[],
  vetRecords: VetRecord[],
  months: Array<{ year: number; month: number }>,
): PlannerMonth[] {
  const byDay = new Map<string, string[]>();
  const add = (year: number, month: number, day: number, glyph: string): void => {
    const key = `${year}-${month}-${day}`;
    const list = byDay.get(key) ?? [];
    if (!list.includes(glyph)) list.push(glyph);
    byDay.set(key, list);
  };

  for (const v of vaccines) {
    const due = parseISODate(v.dueDate);
    if (due) add(due.year, due.month, due.day, MARK.vaccine);
  }
  for (const r of vetRecords) {
    if (!isVetVisitLike(r)) continue;
    const when = parseISODate(r.visitDate);
    if (when) add(when.year, when.month, when.day, MARK.vet);
  }
  for (const m of medications) {
    const start = parseISODate(m.startDate);
    if (start) add(start.year, start.month, start.day, MARK.medStart);
    const end = parseISODate(m.endDate);
    if (end) add(end.year, end.month, end.day, MARK.medEnd);
  }
  // Birthdays and gotcha days repeat every year — mark them in every month of
  // the planner that matches, exactly as they recur in real life.
  const birthday = parseISODate(pet.birthdate);
  const gotcha = parseISODate(pet.adoptionDate);

  return months.map(({ year, month }) => {
    const marks: Record<number, string[]> = {};
    const days = daysInMonth(year, month);
    for (let day = 1; day <= days; day += 1) {
      const glyphs = [...(byDay.get(`${year}-${month}-${day}`) ?? [])];
      if (birthday && birthday.month === month && birthday.day === day) glyphs.push(MARK.birthday);
      if (gotcha && gotcha.month === month && gotcha.day === day) glyphs.push(MARK.adoption);
      if (glyphs.length > 0) marks[day] = glyphs;
    }
    return {
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      year,
      month,
      firstWeekday: firstWeekday(year, month),
      daysInMonth: days,
      marks,
    };
  });
}

/** The legend lines for the glyphs actually used on the grid, in MARK order. */
function legendFor(months: PlannerMonth[]): PlannerLegend[] {
  const used = new Set<string>();
  for (const month of months) {
    for (const glyphs of Object.values(month.marks)) glyphs.forEach((g) => used.add(g));
  }
  return Object.keys(MARK_LEGEND)
    .filter((glyph) => used.has(glyph))
    .map((glyph) => ({ emoji: glyph, label: MARK_LEGEND[glyph] }));
}

/* -------------------------------------------------------------- sections ---- */

/** The data one pet's sections read, already filtered to that pet. */
interface PetRecords {
  pet: Pet;
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  journal: JournalEntry[];
  checkIns: CareCheckInEvent[];
  instructions?: CareInstructions;
}

/** 🐾 Pet profile — the pet's own fields, plus a photo frame. */
function profileBlocks(rec: PetRecords): PlannerBlock[] {
  const { pet } = rec;
  const age = petAgeLabel(pet);
  const rows: PlannerKeyValue[] = [
    { label: 'Name', value: pet.name },
    { label: 'Species', value: petSpeciesLabel(pet) },
    { label: 'Breed', value: pet.breed?.trim() ? pet.breed.trim() : '—' },
    { label: 'Date of birth', value: dateText(pet.birthdate) },
    { label: 'Age', value: age || '—' },
    { label: 'Gotcha day', value: dateText(pet.adoptionDate) },
    {
      label: 'Weight',
      value:
        typeof pet.weight === 'number'
          ? `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`
          : '—',
    },
    {
      label: 'Last weigh-in',
      value: dateText(pet.weightUpdatedAt),
    },
  ];
  const blocks: PlannerBlock[] = [
    { kind: 'kv', rows },
    {
      kind: 'frame',
      text: pet.photoUri
        ? `📷 ${pet.name}'s photo is on this device — print it and stick it here.`
        : `Affix a photo of ${pet.name} here.`,
    },
  ];
  if (!pet.birthdate && !pet.breed && typeof pet.weight !== 'number') {
    blocks.push(
      empty(
        `Only the basics are on file for ${pet.name} yet — fill in the blanks above and they print next time.`,
      ),
    );
  }
  return blocks;
}

/** 📞 Important contacts — the owner, plus every clinic/vet on file. */
function contactBlocks(rec: PetRecords, ownerName: string): PlannerBlock[] {
  const seen = new Set<string>();
  const items: PlannerListItem[] = [];
  for (const record of byDateDesc(rec.vetRecords, (r) => r.visitDate)) {
    const clinic = record.clinicName?.trim();
    const vet = record.veterinarian?.trim();
    if (!clinic && !vet) continue;
    const key = `${clinic ?? ''}|${vet ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      title: clinic || vet || 'Vet on file',
      meta: metaLine([
        clinic && vet ? vet : undefined,
        `from ${record.visitTitle} · ${dateText(record.visitDate)}`,
      ]),
    });
  }

  const blocks: PlannerBlock[] = [
    subheading('Your vet & clinic'),
    items.length > 0
      ? { kind: 'list', items }
      : empty('No clinic or vet on file yet — add a vet visit and those details print here.'),
    subheading('Pet parent'),
    { kind: 'kv', rows: [{ label: 'Pet parent', value: ownerName }] },
  ];
  blocks.push(
    { kind: 'log', columns: ['Name', 'Role', 'Phone'], rows: blankRows(4, 3) },
    empty(
      'No sitter, family or emergency contacts are stored yet — write them in above, on the fridge list.',
    ),
  );
  return blocks;
}

/** Blank write-in rows for a printed table (`rows` × `columns`). */
function blankRows(rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
}

/** 🍽️ Feeding schedule — the stored meals, exactly as the app shows them. */
function feedingBlocks(rec: PetRecords): PlannerBlock[] {
  if (rec.feeding.length === 0) {
    return [
      empty(
        `No feeding schedule stored for ${rec.pet.name} yet — add meals on the Feeding screen and they print here.`,
      ),
    ];
  }
  const meals = byDateAsc(rec.feeding, (f) => f.time);
  return [
    line(
      `${meals.length} meal${meals.length === 1 ? '' : 's'} a day on file for ${rec.pet.name}.`,
    ),
    {
      kind: 'log',
      columns: ['Meal', 'Time', 'Portion', 'Days', 'Notes'],
      rows: meals.map((f) => [
        f.mealType,
        f.time,
        `${f.portionAmount} ${f.portionUnit}`,
        feedingDaysLabel(f.daysOfWeek),
        f.notes?.trim() ?? '',
      ]),
    },
  ];
}

/** 💊 Medication schedule — active courses first, ended ones kept for history. */
function medicationBlocks(rec: PetRecords): PlannerBlock[] {
  const meds = rec.medications;
  const active = byDateAsc(
    meds.filter((m) => m.active),
    (m) => m.startDate ?? '',
  );
  const ended = byDateAsc(
    meds.filter((m) => !m.active),
    (m) => m.startDate ?? '',
  );
  const blocks: PlannerBlock[] = [];
  blocks.push(subheading('Currently on'));
  blocks.push(
    active.length > 0
      ? {
          kind: 'list',
          items: active.map((m) => ({
            title: `${m.name} · ${m.dosage}`,
            meta: metaLine([
              medicationScheduleLabel(m),
              m.startDate ? `started ${dateText(m.startDate)}` : undefined,
              m.endDate ? `ends ${dateText(m.endDate)}` : undefined,
              photoNote(m.photoUri),
            ]),
            note: m.notes,
          })),
        }
      : empty(`No medications are on file for ${rec.pet.name} yet.`),
  );
  if (ended.length > 0) {
    blocks.push(subheading('Finished courses'));
    blocks.push({
      kind: 'list',
      items: ended.map((m) => ({
        title: `${m.name} · ${m.dosage}`,
        meta: metaLine([
          medicationScheduleLabel(m),
          m.startDate ? dateText(m.startDate) : undefined,
          m.endDate ? `to ${dateText(m.endDate)}` : undefined,
          'course ended',
        ]),
      })),
    });
  }
  return blocks;
}

/** 💉 Vaccination records — every shot with its due status. */
function vaccinationBlocks(rec: PetRecords, today: Date): PlannerBlock[] {
  if (rec.vaccines.length === 0) {
    return [empty(`No vaccinations logged yet for ${rec.pet.name}.`)];
  }
  const shots = byDateDesc(rec.vaccines, (v) => v.dateGiven);
  const due = shots.filter((v) => {
    const parsed = parseISODate(v.dueDate);
    if (!parsed) return false;
    const dueDate = new Date(parsed.year, parsed.month - 1, parsed.day);
    const inDays =
      (dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86400000;
    return inDays <= VACCINE_DUE_SOON_DAYS;
  });
  const blocks: PlannerBlock[] = [
    line(
      `${shots.length} vaccination record${shots.length === 1 ? '' : 's'} on file · ${due.length} due or overdue.`,
    ),
    {
      kind: 'list',
      items: shots.map((v) => ({
        title: v.name,
        meta: metaLine([
          `given ${dateText(v.dateGiven)}`,
          v.dueDate ? `next due ${dateText(v.dueDate)}` : 'no due date set',
          vaccineDueText(v, today),
          photoNote(v.photoUri),
        ]),
        note: v.notes,
      })),
    },
  ];
  return blocks;
}

/** 🏥 Vet appointments — booked dates first, then the visit history. */
function vetBlocks(rec: PetRecords, today: Date): PlannerBlock[] {
  const appointments = byDateAsc(
    rec.vetRecords.filter((r) => vetRecordKind(r) === 'appointment'),
    (r) => r.visitDate,
  );
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  const upcoming = appointments.filter((r) => r.visitDate >= todayISO);
  const pastAppointments = appointments.filter((r) => r.visitDate < todayISO);
  const visits = byDateDesc(
    rec.vetRecords.filter((r) => isVetVisitLike(r) && vetRecordKind(r) === 'visit'),
    (r) => r.visitDate,
  );

  const visitItem = (r: VetRecord): PlannerListItem => ({
    title: r.visitTitle,
    meta: metaLine([
      `${dateText(r.visitDate)}${r.visitTime ? ` · ${r.visitTime}` : ''}`,
      r.clinicName?.trim(),
      r.veterinarian?.trim(),
      typeof r.cost === 'number' && Number.isFinite(r.cost) ? `cost ${r.cost.toFixed(2)}` : undefined,
      photoNote(r.photoUri),
    ]),
    note: r.notes,
  });

  const blocks: PlannerBlock[] = [subheading('Booked')];
  blocks.push(
    upcoming.length + pastAppointments.length > 0
      ? {
          kind: 'list',
          items: [...upcoming, ...[...pastAppointments].reverse()].map(visitItem),
        }
      : empty(`No vet appointments booked yet for ${rec.pet.name}.`),
  );
  blocks.push(subheading('Visit history'));
  blocks.push(
    visits.length > 0
      ? { kind: 'list', items: visits.slice(0, 12).map(visitItem) }
      : empty('No clinic visits logged yet.'),
  );
  return blocks;
}

/** ✂️ Grooming — grooming spend on file, plus a write-in log. */
function groomingBlocks(rec: PetRecords): PlannerBlock[] {
  const groomed = byDateDesc(
    rec.expenses.filter((e) => e.category === 'Grooming'),
    (e) => e.date,
  );
  const blocks: PlannerBlock[] = [];
  if (groomed.length > 0) {
    blocks.push(
      line(
        `${groomed.length} grooming visit${groomed.length === 1 ? '' : 's'} on file for ${rec.pet.name}.`,
      ),
      {
        kind: 'list',
        items: groomed.slice(0, 12).map((e) => ({
          title: e.title,
          meta: metaLine([dateText(e.date), `cost ${e.amount.toFixed(2)}`, photoNote(e.photoUri)]),
          note: e.notes,
        })),
      },
    );
  } else {
    blocks.push(
      empty(
        `No grooming logged yet for ${rec.pet.name} — file grooming spend under the Grooming category and it prints here.`,
      ),
    );
  }
  blocks.push({
    kind: 'log',
    columns: ['Date', 'What was done', 'Next due'],
    rows: blankRows(6, 3),
    hint: 'Write-in log — next groom, nails, bath, coat.',
  });
  return blocks;
}

/** ⚖️ Weight tracker — the one weigh-in the app stores, plus a write-in log. */
function weightBlocks(rec: PetRecords): PlannerBlock[] {
  const { pet } = rec;
  const blocks: PlannerBlock[] = [];
  if (typeof pet.weight === 'number') {
    blocks.push({
      kind: 'kv',
      rows: [
        { label: 'Recorded weight', value: `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}` },
        { label: 'Weighed on', value: dateText(pet.weightUpdatedAt) },
      ],
    });
  } else {
    blocks.push(
      empty(
        `No weight on file for ${pet.name} yet — save one on the pet profile and it prints here.`,
      ),
    );
  }
  const firstRow =
    typeof pet.weight === 'number'
      ? [dateText(pet.weightUpdatedAt), `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`, 'on file']
      : null;
  blocks.push({
    kind: 'log',
    columns: ['Date', 'Weight', 'Notes'],
    rows: [...(firstRow ? [firstRow] : []), ...blankRows(firstRow ? 6 : 7, 3)],
    hint: 'The app keeps the latest weigh-in; keep the running record on paper here.',
  });
  return blocks;
}

/** 🎾 Exercise & activity — real Daily Care Ring check-ins, plus a week plan. */
function exerciseBlocks(rec: PetRecords, timeZone?: string): PlannerBlock[] {
  const exercise = byDateDesc(
    rec.checkIns.filter((c) => c.type === 'exercise'),
    (c) => c.at,
  );
  const blocks: PlannerBlock[] = [];
  const anyCheckIns = rec.checkIns.length > 0;
  if (exercise.length > 0) {
    blocks.push(
      line(
        `${exercise.length} exercise check-in${exercise.length === 1 ? '' : 's'} recorded on this device.`,
      ),
      {
        kind: 'list',
        items: exercise.slice(0, 12).map((c) => ({
          title: CARE_CHECK_IN_LABELS.exercise,
          meta: formatTimestampInTimeZone(c.at, timeZone) || c.at,
        })),
      },
    );
  } else if (anyCheckIns) {
    blocks.push(
      empty(
        `No exercise check-ins yet for ${rec.pet.name} — other care check-ins are on file, this one isn't.`,
      ),
    );
  } else {
    blocks.push(
      empty(
        `No activity logged yet for ${rec.pet.name} — tick 🐾 on the Daily Care Ring and the log fills in.`,
      ),
    );
  }
  blocks.push({
    kind: 'log',
    columns: ['Day', 'Walk / play', 'How long'],
    rows: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => [
      d,
      '',
      '',
    ]),
    hint: 'Weekly plan — the app counts what you tick; the plan lives here.',
  });
  return blocks;
}

/** 📅 12-month calendar — a blank grid with the pet's known dates marked. */
function calendarBlocks(rec: PetRecords, today: Date): PlannerBlock[] {
  const months = plannerMonths(today, 12);
  const grid = marksForPet(rec.pet, rec.vaccines, rec.medications, rec.vetRecords, months);
  const legend = legendFor(grid);
  const first = months[0];
  const last = months[months.length - 1];
  const blocks: PlannerBlock[] = [
    line(
      `${MONTH_NAMES[first.month - 1]} ${first.year} to ${MONTH_NAMES[last.month - 1]} ${last.year} — blank for planning, with ${rec.pet.name}'s known dates already marked.`,
    ),
  ];
  if (legend.length === 0) {
    blocks.push(
      empty(
        `No dated records on file for ${rec.pet.name} yet, so the grid starts empty — appointments, vaccinations and birthdays appear here once you add them.`,
      ),
    );
  }
  blocks.push({ kind: 'calendar', months: grid, legend });
  return blocks;
}

/** 💰 Expense tracker — totals by category plus the recent entries. */
function expenseBlocks(rec: PetRecords): PlannerBlock[] {
  const expenses = rec.expenses;
  if (expenses.length === 0) {
    return [empty(`No expenses logged yet for ${rec.pet.name}.`)];
  }
  const total = expenses.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + (Number.isFinite(e.amount) ? e.amount : 0));
  }
  const blocks: PlannerBlock[] = [
    line(
      `Total on file: ${total.toFixed(2)} across ${expenses.length} entr${expenses.length === 1 ? 'y' : 'ies'}.`,
    ),
    {
      kind: 'kv',
      rows: [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, sum]) => ({ label: category, value: `${sum.toFixed(2)} (${percent(sum, total)}%)` })),
    },
    {
      kind: 'list',
      items: byDateDesc(expenses, (e) => e.date)
        .slice(0, 20)
        .map((e) => ({
          title: e.title,
          meta: metaLine([
            dateText(e.date),
            e.amount.toFixed(2),
            e.category,
            e.description?.trim(),
            photoNote(e.photoUri),
          ]),
          note: e.notes,
        })),
    },
  ];
  return blocks;
}

/** A whole-number share of the total, e.g. 42 → "42". */
function percent(part: number, total: number): number {
  if (!Number.isFinite(total) || total === 0) return 0;
  return Math.round((part / total) * 100);
}

/** 📔 Notes & memories — the pet's journal, newest first. */
function noteBlocks(rec: PetRecords): PlannerBlock[] {
  const entries = byDateDesc(rec.journal, (j) => j.entryDate);
  if (entries.length === 0) {
    return [
      empty(
        `No journal notes yet for ${rec.pet.name} — write one on the Journal screen and it prints here.`,
      ),
    ];
  }
  return [
    line(
      `${entries.length} journal entr${entries.length === 1 ? 'y' : 'ies'} on file — the 12 most recent print below.`,
    ),
    {
      kind: 'list',
      items: entries.slice(0, 12).map((j) => ({
        title: j.title?.trim() ? j.title.trim() : dateText(j.entryDate),
        meta: metaLine([dateText(j.entryDate), j.mood, photoNote(j.photoUri)]),
        note: j.body.length > 320 ? `${j.body.slice(0, 317)}…` : j.body,
      })),
    },
    {
      kind: 'log',
      columns: ['Date', 'What happened'],
      rows: blankRows(5, 2),
      hint: 'Space to add tonight’s memory by hand.',
    },
  ];
}

/**
 * 🧳 Pet sitter instructions — exactly the notes the owner wrote on the pet's
 * Care Instructions page, grouped the way the editor groups them.
 */
function sitterBlocks(rec: PetRecords): PlannerBlock[] {
  const groups = careInstructionsGroupsWithContent(rec.instructions);
  if (groups.length === 0) {
    return [
      empty(
        `No sitter instructions written yet — fill them in on ${rec.pet.name}'s care instructions page and the whole sheet prints here.`,
      ),
    ];
  }
  const blocks: PlannerBlock[] = [];
  for (const group of groups) {
    blocks.push(subheading(`${group.group.emoji} ${group.group.title}`));
    blocks.push({
      kind: 'kv',
      rows: group.entries.map((entry) => ({ label: entry.field.label, value: entry.value })),
    });
  }
  return blocks;
}

/** 🚨 Emergency information — the page a sitter or an e-vet reaches for. */
function emergencyBlocks(rec: PetRecords, today: Date, ownerName: string): PlannerBlock[] {
  const { pet } = rec;
  const lastVisit = byDateDesc(rec.vetRecords, (r) => r.visitDate)[0];
  const clinic = lastVisit?.clinicName?.trim();
  const vet = lastVisit?.veterinarian?.trim();
  const activeMeds = rec.medications.filter((m) => m.active);
  const dueShots = rec.vaccines.filter((v) => {
    const parsed = parseISODate(v.dueDate);
    if (!parsed) return false;
    const dueDate = new Date(parsed.year, parsed.month - 1, parsed.day);
    return (
      dueDate.getTime() <=
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() +
        VACCINE_DUE_SOON_DAYS * 86400000
    );
  });
  const fears = careInstructionValue(rec.instructions, 'fears');
  const triggers = careInstructionValue(rec.instructions, 'triggers');
  const escape = careInstructionValue(rec.instructions, 'escapeTendencies');
  const compatibility = careInstructionValue(rec.instructions, 'petCompatibility');

  const blocks: PlannerBlock[] = [
    subheading('If something goes wrong'),
    {
      kind: 'kv',
      rows: [
        { label: 'Pet', value: `${pet.name} · ${petSpeciesLabel(pet)}${pet.breed?.trim() ? ` · ${pet.breed.trim()}` : ''}` },
        { label: 'Pet parent', value: ownerName },
        { label: 'Vet clinic', value: clinic || '—' },
        { label: 'Veterinarian', value: vet || '—' },
        {
          label: 'Last visit on file',
          value: lastVisit ? `${lastVisit.visitTitle} · ${dateText(lastVisit.visitDate)}` : '—',
        },
        {
          label: 'Weight on file',
          value:
            typeof pet.weight === 'number'
              ? `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`
              : '—',
        },
      ],
    },
  ];

  blocks.push(subheading('Medications to mention'));
  blocks.push(
    activeMeds.length > 0
      ? {
          kind: 'list',
          items: activeMeds.map((m) => ({
            title: `${m.name} · ${m.dosage}`,
            meta: medicationScheduleLabel(m),
            note: m.notes,
          })),
        }
      : empty('No active medications on file.'),
  );

  blocks.push(subheading('Vaccinations due or overdue'));
  blocks.push(
    dueShots.length > 0
      ? {
          kind: 'list',
          items: dueShots.map((v) => ({
            title: v.name,
            meta: metaLine([`given ${dateText(v.dateGiven)}`, vaccineDueText(v, today)]),
          })),
        }
      : empty('No vaccinations are due right now.'),
  );

  blocks.push(subheading('Allergies & conditions'));
  blocks.push(
    empty(
      'No allergies or conditions are stored yet — this app keeps no medical-condition field, so nothing is guessed here. Write the real ones in below.',
    ),
  );
  blocks.push({ kind: 'log', columns: ['Allergy / condition', 'What to do'], rows: blankRows(3, 2) });

  blocks.push(subheading('Fears, triggers & handling'));
  const behaviourRows: PlannerKeyValue[] = [
    fears ? { label: 'Fears', value: fears } : null,
    triggers ? { label: 'Triggers', value: triggers } : null,
    escape ? { label: 'Escape tendencies', value: escape } : null,
    compatibility ? { label: 'Dogs and cats', value: compatibility } : null,
  ].filter((row): row is PlannerKeyValue => row !== null);
  blocks.push(
    behaviourRows.length > 0
      ? { kind: 'kv', rows: behaviourRows }
      : empty('Nothing written about fears or triggers yet — add it to the care instructions.'),
  );

  blocks.push(subheading('Emergency contacts'));
  blocks.push(
    empty(
      'No emergency contacts are stored yet — the care-circle roster is a later feature, so the lines below are for pen.',
    ),
  );
  blocks.push({ kind: 'log', columns: ['Name', 'Relationship', 'Phone'], rows: blankRows(3, 3) });

  return blocks;
}

/* -------------------------------------------------------------- document ---- */

/** Build the blocks for one section id (the switch every section flows through). */
function sectionBlocks(
  id: PlannerSectionId,
  rec: PetRecords,
  source: PlannerSource,
  today: Date,
): PlannerBlock[] {
  switch (id) {
    case 'profile':
      return profileBlocks(rec);
    case 'contacts':
      return contactBlocks(rec, source.ownerName);
    case 'feeding':
      return feedingBlocks(rec);
    case 'medication':
      return medicationBlocks(rec);
    case 'vaccination':
      return vaccinationBlocks(rec, today);
    case 'vet':
      return vetBlocks(rec, today);
    case 'grooming':
      return groomingBlocks(rec);
    case 'weight':
      return weightBlocks(rec);
    case 'exercise':
      return exerciseBlocks(rec, source.timeZone);
    case 'calendar':
      return calendarBlocks(rec, today);
    case 'expenses':
      return expenseBlocks(rec);
    case 'notes':
      return noteBlocks(rec);
    case 'sitter':
      return sitterBlocks(rec);
    case 'emergency':
      return emergencyBlocks(rec, today, source.ownerName);
    default:
      return [empty('This section has nothing to print yet.')];
  }
}

/** One pet's records, filtered out of the whole-device collections. */
function petRecords(pet: Pet, source: PlannerSource): PetRecords {
  return {
    pet,
    vaccines: source.vaccines.filter((v) => v.petId === pet.id),
    medications: source.medications.filter((m) => m.petId === pet.id),
    feeding: source.feeding.filter((f) => f.petId === pet.id),
    vetRecords: source.vetRecords.filter((r) => r.petId === pet.id),
    expenses: source.expenses.filter((e) => e.petId === pet.id),
    journal: source.journal.filter((j) => j.petId === pet.id),
    checkIns: source.checkIns.filter((c) => c.petId === pet.id),
    instructions: source.careInstructions.find((i) => i.petId === pet.id),
  };
}

/** "Bella's pet planner" / "Pet planner · Bella, Otis + 1 more". */
function documentTitle(pets: Pet[], household: boolean): string {
  if (pets.length === 1) return `${pets[0].name}'s pet planner`;
  if (household) return 'The whole household’s pet planner';
  const names = pets.slice(0, 3).map((p) => p.name);
  const extra = pets.length - names.length;
  return `Pet planner · ${names.join(', ')}${extra > 0 ? ` + ${extra} more` : ''}`;
}

/**
 * Build the complete planner document for the chosen pets, sections and paper.
 *
 * Pets are printed in the order they were selected (which is the app's own pet
 * order), sections in the canonical print order, and a section the owner turned
 * off is simply absent — never printed as a stub.
 */
export function buildPlannerDocument(
  source: PlannerSource,
  config: PlannerConfig,
  now: Date = new Date(),
): PlannerDocument {
  const chosenIds = config.petIds.length > 0 ? config.petIds : source.pets.map((p) => p.id);
  const chosenSet = new Set(chosenIds);
  const pets = source.pets.filter((pet) => chosenSet.has(pet.id));
  const sectionIds = normalizeSectionIds(config.sectionIds);
  const defs = sectionIds
    .map((id) => PLANNER_SECTIONS.find((section) => section.id === id))
    .filter((def): def is PlannerSectionDef => Boolean(def));

  const household = pets.length === source.pets.length && source.pets.length > 0;
  const chapters: PlannerChapter[] = pets.map((pet) => {
    const rec = petRecords(pet, source);
    return {
      petId: pet.id,
      petName: pet.name,
      petEmoji: petEmojiFor(pet),
      meta: metaLine([petMetaLine(pet), petAgeLabel(pet)]) ?? petSpeciesLabel(pet),
      sections: defs.map((def) => ({
        id: def.id,
        title: def.title,
        emoji: def.emoji,
        blocks: sectionBlocks(def.id, rec, source, now),
      })),
    };
  });

  const generatedOn = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const paperLabel = config.paper === 'a4' ? 'A4' : 'US Letter';

  return {
    title: documentTitle(pets, household),
    kicker: 'Pet Parent Tracker · The Blueprint',
    subtitle: `Generated on this device ${generatedOn} · ${paperLabel} · 100% offline — nothing left your phone.`,
    petNames: pets.map((pet) => pet.name),
    sectionTitles: defs.map((def) => def.title),
    paper: config.paper,
    chapters,
  };
}
