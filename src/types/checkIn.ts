/**
 * Daily care check-ins — the Command Center's "one tap says it happened" record.
 *
 * The Daily Care Ring on Home (design Phase B1) gives every pet five one-tap
 * checkoffs: Food, Water, Medication, Exercise and Care. A tap writes a real
 * event here, on the device, so the day's ring state is a persisted fact that
 * survives a restart — not a UI toggle (which is what the old Today tab's
 * `todayCheckoff` list was, and why this is its own collection).
 *
 * Sitter Mode's Caregiver Check-In engine (a later stage) writes to this exact
 * collection too, so a pet has one honest timeline whoever did the caring. It
 * adds three things to the model, all backward compatible:
 *  - `byName` + `mood` on the event (both optional: an event recorded before
 *    these fields existed still parses and still renders).
 *  - `passId` — the care pass an act was recorded under, so the owner's pass
 *    detail can show how the sit went (see `utils/passCheckIns`). Optional:
 *    every event written with no pass running carries none, and everything
 *    reads back exactly as before.
 *  - two more `CareCheckInType` values — `litter` (a sitter's act the five-tile
 *    ring does not draw) and `mood` (a caregiver's read of how the pet is doing,
 *    which is an observation rather than a care act). `CARE_CHECK_IN_TYPES`
 *    keeps meaning exactly what it always meant — the ring's five tiles, in
 *    order — so the ring's row and its "N of 5" count never change. The storage
 *    layer accepts the wider set; see `CARE_CHECK_IN_ALL_TYPES`.
 *
 * Deliberate limits, so nothing in this model can ever shame the owner:
 *  - A check-in records that a care act HAPPENED, as observed by the person who
 *    ticked it. The app never infers completion from a feeding or medication
 *    schedule, and an unticked item is simply "not yet" — never missed, never
 *    failed. There is no score, no streak penalty and no negative copy.
 *  - A mood is a neutral reading ("Tired", "Ate normally"), never a grade: it
 *    carries no consequence, no streak credit and no advice.
 *  - `source` names who recorded it: `owner` for the ring's own taps, `sitter`
 *    for a record written through the caregiver check-in screen (by whoever was
 *    holding the phone — the app never guesses which human that was, which is
 *    exactly why `byName` exists).
 *  - `at` is a full ISO timestamp (a moment in time), not a calendar date. The
 *    ring decides which events count as "today" by rendering that instant in the
 *    owner's chosen display time zone — see `careCheckInIsOn` below and
 *    `todayISOInTimeZone` in utils/datetime.
 *
 * 100% offline: types and pure helpers only — no storage, no network.
 */
import type { BaseEntity } from './index';
import { todayISOInTimeZone } from '../utils/datetime';

/**
 * Everything a check-in can be. The first five are the Daily Care Ring's acts
 * (see `CARE_CHECK_IN_TYPES`); `litter` is the sitter-side act the ring's five
 * tiles do not draw, and `mood` is an observation rather than an act.
 */
export type CareCheckInType =
  | 'food'
  | 'water'
  | 'medication'
  | 'exercise'
  | 'care'
  | 'litter'
  | 'mood';

/**
 * The five acts the Daily Care Ring draws, in its canonical order. The ring
 * builds its tiles and its "N of 5" count from exactly this list everywhere, so
 * the row never reshuffles — and never grows a sixth tile.
 */
export const CARE_CHECK_IN_TYPES: CareCheckInType[] = [
  'food',
  'water',
  'medication',
  'exercise',
  'care',
];

/**
 * The acts the Caregiver Check-In engine offers as one-tap buttons, in render
 * order, with the backlog's wording (see `CARE_ACT_LABELS`): Fed, Water
 * refreshed, Medication given, Walk completed, Litter cleaned.
 */
export const SITTER_ACT_TYPES: CareCheckInType[] = [
  'food',
  'water',
  'medication',
  'exercise',
  'litter',
];

/**
 * Every value the storage layer accepts — the ring's five acts plus the two
 * the check-in engine adds. Used for validation of stored/typed data; the ring
 * deliberately keeps using `CARE_CHECK_IN_TYPES`.
 */
export const CARE_CHECK_IN_ALL_TYPES: CareCheckInType[] = [
  ...CARE_CHECK_IN_TYPES,
  'litter',
  'mood',
];

/** Who recorded a check-in: the owner's ring, or the caregiver check-in screen. */
export type CareCheckInSource = 'owner' | 'sitter';

/**
 * A caregiver's neutral read of how a pet is doing, chosen from the mood row.
 * Every value is a plain description — never a score, never a diagnosis.
 */
export type PetMood =
  | 'normal'
  | 'tired'
  | 'sick'
  | 'ate-normally'
  | 'bathroom-normal';

/** The five moods, in the order the mood row renders them. */
export const PET_MOODS: PetMood[] = [
  'normal',
  'tired',
  'sick',
  'ate-normally',
  'bathroom-normal',
];

/** The label each mood shows, in the backlog's own wording. */
export const PET_MOOD_LABELS: Record<PetMood, string> = {
  normal: 'Normal',
  tired: 'Tired',
  sick: 'Sick',
  'ate-normally': 'Ate normally',
  'bathroom-normal': 'Bathroom normal',
};

/** A glyph for each mood — used on the mood chips and in the log rows. */
export const PET_MOOD_EMOJI: Record<PetMood, string> = {
  normal: '🐾',
  tired: '😴',
  sick: '🤒',
  'ate-normally': '🍽️',
  'bathroom-normal': '💧',
};

/** One recorded care act (or mood), for one pet. */
export interface CareCheckInEvent extends BaseEntity {
  /** The pet the act was done for. */
  petId: string;
  /** Which act it was — or `mood` for an observation (see `PetMood`). */
  type: CareCheckInType;
  /** ISO timestamp of the moment it was recorded. */
  at: string;
  /** Who ticked it — the value the log is honest about. */
  source: CareCheckInSource;
  /**
   * The caregiver's name, as the check-in screen captured it ("Fed by Sarah").
   *
   * Optional, and absent on every event the owner's own ring wrote — an event
   * from before this field existed reads back with no name, and its log line
   * simply omits the "by …" part.
   */
  byName?: string;
  /**
   * The caregiver's read of the pet, recorded by a `mood` check-in. Optional,
   * and only ever set on a mood event.
   */
  mood?: PetMood;
  /**
   * The care pass this record was made under, when an ACTIVE pass covered this
   * pet on the day the act was recorded (see `utils/passCheckIns`).
   *
   * Optional and deliberately soft: an event recorded with no pass running —
   * every ring tap, and every record from before this field existed — simply
   * carries none, and the pass detail then falls back to the pass's own date
   * window. The Daily Care Ring neither reads nor cares about it: a pass id
   * never changes what is done today, only whose sit it is filed under.
   */
  passId?: string;
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
  litter: 'Litter',
  mood: 'Mood',
};

/** Emoji for one act — the ring's tile glyph. */
export const CARE_CHECK_IN_EMOJI: Record<CareCheckInType, string> = {
  food: '🍽️',
  water: '💧',
  medication: '💊',
  exercise: '🐾',
  care: '🩺',
  litter: '🧹',
  mood: '💭',
};

/**
 * The sitter-facing wording for each act, exactly as the backlog names them:
 * "Fed", "Medication given", "Water refreshed", "Walk completed", "Litter
 * cleaned". The log lines read from this too ("Fed by Sarah — 8:03 AM").
 */
export const CARE_ACT_LABELS: Record<CareCheckInType, string> = {
  food: 'Fed',
  water: 'Water refreshed',
  medication: 'Medication given',
  exercise: 'Walk completed',
  care: 'Care check-in',
  litter: 'Litter cleaned',
  mood: 'Mood check-in',
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

/**
 * The cheerful line a caregiver's tap earns. Same rule as the ring's: it says
 * thank you for what happened and never mentions what did not.
 */
export const CAREGIVER_THANKS: string[] = [
  'Logged — thank you for keeping the day straight.',
  'Noted. The pets would say thank you if they could type.',
  'That is one more true line in the day.',
  'Recorded. Somebody is going to be very pleased later.',
  'Logged with the time on it — no memory required.',
];

/** Is `value` one of the acts or observations the app stores? */
export function isCareCheckInType(value: unknown): value is CareCheckInType {
  return (
    typeof value === 'string' &&
    (CARE_CHECK_IN_ALL_TYPES as string[]).includes(value)
  );
}

/** Is this stored value a mood observation rather than a care act? */
export function isMoodCheckIn(type: unknown): boolean {
  return type === 'mood';
}

/** The mood a stored value names, or null when it isn't one of the five. */
export function petMoodOrNull(value: unknown): PetMood | null {
  return typeof value === 'string' && (PET_MOODS as string[]).includes(value)
    ? (value as PetMood)
    : null;
}

/**
 * The caregiver's name on an event, trimmed, or null when the event carries
 * none (every ring-written event, and any record from before the field).
 */
export function careCheckInByName(
  event: Pick<CareCheckInEvent, 'byName'>,
): string | null {
  const name = typeof event.byName === 'string' ? event.byName.trim() : '';
  return name.length > 0 ? name : null;
}

/**
 * The pass an event was filed under, trimmed, or null when it carries none
 * (an event made with no pass running, or one from before the field existed).
 */
export function careCheckInPassId(
  event: Pick<CareCheckInEvent, 'passId'>,
): string | null {
  const id = typeof event.passId === 'string' ? event.passId.trim() : '';
  return id.length > 0 ? id : null;
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
