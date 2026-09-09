/**
 * Shared domain types for Pet Parent Tracker.
 *
 * `BaseEntity` provides the common fields every persisted collection shares
 * (id + createdAt). Future modules (vaccines, meds, feeding, vet records,
 * expenses, journal, upsell products) extend `BaseEntity` and add their own
 * `CollectionStore<T>`.
 */

/** Common fields for every persisted entity. */
export interface BaseEntity {
  id: string;
  createdAt: string; // ISO timestamp
}

/** Supported pet species (small fixed set). */
export type Species = 'Dog' | 'Cat' | 'Other';

/** Weight units a pet's weight is recorded in. */
export type WeightUnit = 'kg' | 'lb';

/** The Pet entity — stored on-device via AsyncStorage. */
export interface Pet extends BaseEntity {
  name: string;
  species: Species;
  breed?: string;
  birthdate?: string; // ISO date (YYYY-MM-DD)
  weight?: number;
  weightUnit?: WeightUnit;
  photoUri?: string; // local file URI copied into the app's own storage
}

/** Input type for creating/updating a pet (id/createdAt auto-assigned). */
export type PetInput = Omit<Pet, keyof BaseEntity> & Partial<BaseEntity>;

/** Species options exposed for the create/edit form. */
export const SPECIES_OPTIONS: Species[] = ['Dog', 'Cat', 'Other'];

/** Weight unit options exposed for the create/edit form. */
export const WEIGHT_UNIT_OPTIONS: WeightUnit[] = ['kg', 'lb'];

/**
 * The Vaccine entity — stored on-device via AsyncStorage. One record per shot
 * (or per course), bound to a pet via `petId`.
 */
export interface Vaccine extends BaseEntity {
  petId: string;
  /** Vaccine name, e.g. "Rabies (3-year)". */
  name: string;
  /** Date the shot was given (ISO date YYYY-MM-DD). */
  dateGiven: string;
  /** Next due date (ISO date YYYY-MM-DD), optional. */
  dueDate?: string;
  /** Free-form notes, e.g. lot number, vet clinic, reaction. */
  notes?: string;
  /**
   * Whether a local due-date reminder is scheduled for this record (Blueprint
   * Premium). Missing/undefined means off — existing records stay free and
   * reminder-free.
   */
  reminderEnabled?: boolean;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating a vaccine (id/createdAt auto-assigned). */
export type VaccineInput = Omit<Vaccine, keyof BaseEntity> & Partial<BaseEntity>;

/** How soon a vaccine falls due, computed client-side relative to today. */
export type VaccineStatus =
  | 'overdue' // due date is in the past
  | 'dueSoon' // due date within VACCINE_DUE_SOON_DAYS
  | 'upToDate' // due date further out
  | 'noDueDate'; // no due date set

/** A vaccine whose due date is within this many days counts as "due soon". */
export const VACCINE_DUE_SOON_DAYS = 30;

/**
 * The Medication entity — stored on-device via AsyncStorage. One record per
 * medication a pet is on, bound to the pet via `petId`.
 *
 * Schedule model: a medication repeats either a fixed number of times per day
 * (`times: string[]` of "HH:mm", e.g. ["08:00", "20:00"]) or every N days
 * (`intervalDays: number`, e.g. 3 for "every 3 days"). Exactly one of the two
 * is set — whichever is non-empty drives the schedule and the reminder
 * notifications.
 */
export interface Medication extends BaseEntity {
  petId: string;
  /** Medication name, e.g. "Carprofen (Rimadyl)". */
  name: string;
  /** Human-friendly dosage, e.g. "1 tablet". */
  dosage: string;
  /** Extra instructions, e.g. "give with food". Optional. */
  notes?: string;
  /** Daily dose times as "HH:mm" (24h). Empty means "every N days" mode. */
  times: string[];
  /** Repeat every N days when the schedule is interval-based (0 = n/a). */
  intervalDays: number;
  /** ISO date (YYYY-MM-DD) the medication course starts; optional. */
  startDate?: string;
  /** ISO date (YYYY-MM-DD) the medication course ends; optional. */
  endDate?: string;
  /** Whether the record is still active (toggled off for ended courses). */
  active: boolean;
  /** Whether local reminder notifications are scheduled for this record. */
  remindersEnabled: boolean;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating a medication (id/createdAt auto-assigned). */
export type MedicationInput = Omit<Medication, keyof BaseEntity> & Partial<BaseEntity>;

/** Validate a 24h clock string "HH:mm" (exact format, minute in 0–59). */
export function isValidTime(s: string): boolean {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) return false;
  return true;
}

/** Validate an ISO date string "YYYY-MM-DD". */
export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Human summary of a medication's schedule, e.g. "2× daily · 08:00, 20:00". */
export function medicationScheduleLabel(m: Medication): string {
  if (m.times.length > 0) {
    const daily = m.times.length === 1 ? 'daily' : `${m.times.length}× daily`;
    return `${daily} · ${m.times.join(', ')}`;
  }
  if (m.intervalDays > 0) {
    return m.intervalDays === 1 ? 'every day' : `every ${m.intervalDays} days`;
  }
  return 'no schedule';
}

/**
 * The FeedingSchedule entity — stored on-device via AsyncStorage. One record
 * per recurring meal for a pet, bound to the pet via `petId`.
 *
 * Schedule model: each entry is a single daily meal (`mealType` + `time`).
 * An entry repeats every day unless `daysOfWeek` names specific days
 * (0 = Sunday … 6 = Saturday, mirroring `Date.getDay()`). An empty or
 * missing `daysOfWeek` means "every day".
 */
export interface FeedingSchedule extends BaseEntity {
  petId: string;
  /** Which meal this is, e.g. "Breakfast". */
  mealType: MealType;
  /** Meal time as "HH:mm" (24h), e.g. "08:00". */
  time: string;
  /** Portion amount, e.g. 150 (with `portionUnit`). */
  portionAmount: number;
  /** Unit the portion is measured in, e.g. "g". */
  portionUnit: PortionUnit;
  /** Free-form notes, e.g. "soak kibble in warm water". Optional. */
  notes?: string;
  /** Days this meal repeats (0 = Sunday … 6 = Saturday). Empty = every day. */
  daysOfWeek: number[];
  /**
   * Whether a local mealtime reminder is scheduled for this entry (Blueprint
   * Premium). Missing/undefined means off — existing entries stay free and
   * reminder-free.
   */
  reminderEnabled?: boolean;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating a feeding entry (id/createdAt auto-assigned). */
export type FeedingScheduleInput = Omit<FeedingSchedule, keyof BaseEntity> &
  Partial<BaseEntity>;

/** Meal types a feeding entry can be (small fixed set). */
export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

/** Meal type options exposed for the create/edit form. */
export const MEAL_TYPE_OPTIONS: MealType[] = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snack',
];

/** Portion units a feeding entry's amount is recorded in. */
export type PortionUnit = 'g' | 'cups' | 'tbsp' | 'cans' | 'ml';

/** Portion unit options exposed for the create/edit form. */
export const PORTION_UNIT_OPTIONS: PortionUnit[] = [
  'g',
  'cups',
  'tbsp',
  'cans',
  'ml',
];

/** Short day names indexed by `Date.getDay()` (0 = Sunday). */
export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Whether a days-of-week value means "every day" (empty or all 7 days). */
export function isEveryDay(daysOfWeek: number[]): boolean {
  return daysOfWeek.length === 0 || daysOfWeek.length === 7;
}

/** Human summary of which days a feeding entry repeats, e.g. "Every day". */
export function feedingDaysLabel(daysOfWeek: number[]): string {
  if (isEveryDay(daysOfWeek)) return 'Every day';
  const days = [...daysOfWeek].sort((a, b) => a - b);
  return days.map((d) => DAY_NAMES_SHORT[d] ?? `Day ${d}`).join(', ');
}

/** Human summary of a feeding entry, e.g. "Breakfast · 08:00 · 150 g". */
export function feedingScheduleLabel(f: FeedingSchedule): string {
  return `${f.mealType} · ${f.time} · ${f.portionAmount} ${f.portionUnit}`;
}

/**
 * The VetRecord entity — stored on-device via AsyncStorage. One record per
 * veterinary visit, bound to a pet via `petId`.
 */
export interface VetRecord extends BaseEntity {
  petId: string;
  /** Visit title, e.g. "Annual checkup". */
  visitTitle: string;
  /** Date of the visit (ISO date YYYY-MM-DD). */
  visitDate: string;
  /** Clinic name, e.g. "Main Street Animal Hospital". Optional. */
  clinicName?: string;
  /** Veterinarian's name, e.g. "Dr. Lee". Optional. */
  veterinarian?: string;
  /** Free-form notes: diagnosis, treatment, follow-up instructions. Optional. */
  notes?: string;
  /**
   * Visit cost in the user's own currency, as typed — no conversion, no
   * currency metadata, no server. Optional.
   */
  cost?: number;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating a vet record (id/createdAt auto-assigned). */
export type VetRecordInput = Omit<VetRecord, keyof BaseEntity> & Partial<BaseEntity>;

/** Human-readable cost for a vet record, e.g. "85.50" — null when unset. */
export function vetCostLabel(cost?: number): string | null {
  if (cost === undefined || !Number.isFinite(cost)) return null;
  return cost.toFixed(2);
}

/**
 * The Expense entity — stored on-device via AsyncStorage. One record per
 * payment (or purchase) for a pet, bound to the pet via `petId`.
 */
export interface Expense extends BaseEntity {
  petId: string;
  /** What was paid for, e.g. "Dog food (12 kg bag)". */
  title: string;
  /** Longer description (optional) — e.g. line-item detail. */
  description?: string;
  /** Amount paid, in the user's own currency, as a plain positive number. */
  amount: number;
  /** Date of the expense (ISO date YYYY-MM-DD). */
  date: string;
  /** Spending category from the fixed set `EXPENSE_CATEGORY_OPTIONS`. */
  category: ExpenseCategory;
  /** Free-form notes, e.g. store, receipt no. Optional. */
  notes?: string;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating an expense (id/createdAt auto-assigned). */
export type ExpenseInput = Omit<Expense, keyof BaseEntity> & Partial<BaseEntity>;

/** Spending categories an expense can have (small fixed set). */
export type ExpenseCategory =
  | 'Food'
  | 'Vet'
  | 'Grooming'
  | 'Supplies'
  | 'Medication'
  | 'Other';

/** Category options exposed for the create/edit form. */
export const EXPENSE_CATEGORY_OPTIONS: ExpenseCategory[] = [
  'Food',
  'Vet',
  'Grooming',
  'Supplies',
  'Medication',
  'Other',
];

/** Human-readable category name (already human; kept for symmetry + safety). */
export function expenseCategoryLabel(category: ExpenseCategory): string {
  return category;
}

/**
 * Human-readable amount for an expense, e.g. "42.50" as a plain number.
 * The user's currency is intentionally not prefixed (no currency metadata).
 */
export function expenseAmountLabel(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return amount.toFixed(2);
}

/**
 * The JournalEntry entity — stored on-device via AsyncStorage. One record per
 * personality-journal entry for a pet, bound to the pet via `petId`.
 */
export interface JournalEntry extends BaseEntity {
  petId: string;
  /** Short heading, e.g. "First day at the park". Optional. */
  title?: string;
  /** The journal entry text itself (required). */
  body: string;
  /** Date the entry is about (ISO date YYYY-MM-DD). */
  entryDate: string;
  /** Mood observed, from the fixed set `JOURNAL_MOOD_OPTIONS`. Optional. */
  mood?: JournalMood;
  /** Local file URI of an optional photo (picked on-device, stored directly). */
  photoUri?: string;
}

/** Input type for creating/updating a journal entry (id/createdAt auto-assigned). */
export type JournalEntryInput = Omit<JournalEntry, keyof BaseEntity> &
  Partial<BaseEntity>;

/** Moods a journal entry can record (small fixed set). */
export type JournalMood = 'Happy' | 'Playful' | 'Sleepy' | 'Grumpy' | 'Sick';

/** Mood options exposed for the create/edit form. */
export const JOURNAL_MOOD_OPTIONS: JournalMood[] = [
  'Happy',
  'Playful',
  'Sleepy',
  'Grumpy',
  'Sick',
];

/** Human-readable mood name (already human; kept for symmetry + safety). */
export function journalMoodLabel(mood: JournalMood): string {
  return mood;
}

/** Emoji for a mood, used on badges in the journal list. */
export function journalMoodEmoji(mood: JournalMood): string {
  switch (mood) {
    case 'Happy':
      return '🙂';
    case 'Playful':
      return '🎾';
    case 'Sleepy':
      return '😴';
    case 'Grumpy':
      return '😾';
    case 'Sick':
      return '🤒';
  }
}
