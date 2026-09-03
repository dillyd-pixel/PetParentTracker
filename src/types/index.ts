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
