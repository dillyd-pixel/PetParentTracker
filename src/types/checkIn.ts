/**
 * Daily care check-ins — the Command Center's "one tap says it happened" record.
 *
 * The Daily Care Ring on Home (design Phase B1) gives every pet five one-tap
 * checkoffs: Food, Water, Medication, Exercise and Care. A tap writes a real
 * event here, on the device, so the day's ring state is a persisted fact that
 * survives a restart — not a UI toggle (which is what the old Today tab's
 * `todayCheckoff` list was, and why this is its own collection).
 *
 * Deliberate limits, so nothing in this model can ever shame the owner:
 *  - A check-in records that a care act HAPPENED, as observed by the person who
 *    ticked it. The app never infers completion from a feeding or medication
 *    schedule, and an unticked item is simply "not yet" — never missed, never
 *    failed. There is no score, no streak penalty and no negative copy.
 *  - `source` names who recorded it. Today only 'owner' exists; Sitter Mode's
 *    caregiver check-ins (a later stage) reuse this same collection, so the log
 *    stays one honest timeline per pet.
 *  - `at` is a full ISO timestamp (a moment in time), not a calendar date. The
 *    ring decides which events count as "today" by rendering that instant in the
 *    owner's chosen display time zone — see `careCheckInIsOn` below and
 *    `todayISOInTimeZone` in utils/datetime.
 *
 * 100% offline: types and pure helpers only — no storage, no network.
 */
import type { BaseEntity } from './index';
import { todayISOInTimeZone } from '../utils/datetime';

/** The five care acts the Daily Care Ring can record. */
export type CareCheckInType = 'food' | 'water' | 'medication' | 'exercise' | 'care';

/**
 * The canonical order of the five acts. The ring draws its tiles in exactly
 * this order everywhere, so the row never reshuffles between renders or pets.
 */
export const CARE_CHECK_IN_TYPES: CareCheckInType[] = [
  'food',
  'water',
  'medication',
  'exercise',
  'care',
];

/** Who recorded a check-in. The owner today; a sitter in a later stage. */
export type CareCheckInSource = 'owner';

/** One recorded care act, for one pet. */
export interface CareCheckInEvent extends BaseEntity {
  /** The pet the act was done for. */
  petId: string;
  /** Which of the five acts it was. */
  type: CareCheckInType;
  /** ISO timestamp of the moment it was recorded. */
  at: string;
  /** Who ticked it — the value the log is honest about. */
  source: CareCheckInSource;
}

/** Input for recording a check-in (id/createdAt come from the storage layer). */
export type CareCheckInInput = Omit<CareCheckInEvent, keyof BaseEntity> &
  Partial<BaseEntity>;

/** Human label for one act — the ring's tile captions and any later export. */
export const CARE_CHECK_IN_LABELS: Record<CareCheckInType, string> = {
  food: 'Food',
  water: 'Water',
  medication: 'Medication',
  exercise: 'Exercise',
  care: 'Care',
};

/** Emoji for one act — the ring's tile glyph. */
export const CARE_CHECK_IN_EMOJI: Record<CareCheckInType, string> = {
  food: '🍽️',
  water: '💧',
  medication: '💊',
  exercise: '🐾',
  care: '🩺',
};

/**
 * The playful line a checkoff earns, rotated one per tap. Every line is
 * celebratory and none of them comment on what is *not* ticked — an incomplete
 * ring is silent, never scolded.
 */
export const CARE_ENCOURAGEMENTS: string[] = [
  'Dinner successfully negotiated.',
  'Responsible pet-parent behavior detected.',
  'Being adorable is apparently not free.',
  'Hydration: achieved.',
  "World's best pet parent — today, again.",
  'One paw up for you.',
];

/** Is `value` one of the five acts? Guards stored or imported data. */
export function isCareCheckInType(value: unknown): value is CareCheckInType {
  return (
    typeof value === 'string' &&
    (CARE_CHECK_IN_TYPES as string[]).includes(value)
  );
}

/**
 * Was this check-in recorded on the given local calendar day (`YYYY-MM-DD`),
 * as the chosen display time zone sees it?
 *
 * `zn` is the zone to render in (`undefined` or 'auto' = this device's own).
 * An unparseable timestamp is never "today" — a corrupt record must not make a
 * tile read as done.
 */
export function careCheckInIsOn(
  event: Pick<CareCheckInEvent, 'at'>,
  dayKey: string,
  zone?: string,
): boolean {
  const when = new Date(event.at);
  if (Number.isNaN(when.getTime())) return false;
  return todayISOInTimeZone(when, zone) === dayKey;
}
