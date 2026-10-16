/**
 * Vet Mode — the pure core (HANDOFF, unit 2 of 3).
 *
 * Vet Mode is the pet parent's *vet-visit* layer, and it sits between two things
 * that already exist: the vet records file (the app's own `VetRecord` store, the
 * same one the Records tab, the Home Upcoming rail and the emergency card read)
 * and the pet's own medication records. This module never invents a fact and
 * never writes to a second store: it prepares the visit, reads the last visit
 * back out of the real records, and files what happened as one more record in
 * that same file.
 *
 * What it does, in three parts:
 *
 *  1. **Prep.** A visit the owner is preparing for: the date (a real calendar
 *     day, today or later — a past day is refused, honestly), a reason, and the
 *     questions to ask. The questions are the owner's own words, capped and
 *     flattened; nothing about them is scored or counted as progress.
 *  2. **The record.** "Save the visit" turns the prep into ONE `VetRecord`
 *     through `vetVisitRecordInput` — the same entity the Records tab creates,
 *     with the reason as the visit's title and the questions + what the vet said
 *     as its notes. Nothing is typed twice and nothing is guessed: a field the
 *     owner left blank stays blank.
 *  3. **The recheck.** A recheck date captured on the visit becomes a follow-up
 *     *appointment* record (`kind: 'appointment'`) in the same file, which is
 *     why it appears on Home's Upcoming rail and Today with no new reminder
 *     path: the app's existing Upcoming sourcing reads exactly this record. No
 *     notification is scheduled here — push reminders stay the premium feature
 *     they already are, and this module never touches that gate.
 *
 * Two rules the copy and the code keep:
 *
 *  - **Nothing is invented.** The last-visit summary and the medication list are
 *    read from stores that already exist (`VetRecord`, `Medication`), and a
 *    field with nothing stored reads `VET_BLANK` — the app's one placeholder,
 *    "Not on file" — never "undefined", never "NaN", never "[object Object]".
 *    A pet with no records at all produces honest empty states, not filler.
 *  - **Hostile storage cannot throw.** Every read goes through `emergencyText`
 *    (the app's one text sanitiser) or an explicit `Array.isArray` guard, so a
 *    hand-edited store holding a number where a string belongs, junk JSON, or a
 *    record missing its fields is simply read as "nothing stored". Renders put
 *    values in `<Text>` children only, so a stored `<script>` is visible text.
 *
 * Everything here is pure (no React, no storage, no platform module) so the whole
 * thing can be exercised in Node against fixtures — see
 * /home/team/shared/vet-mode-verification/. 100% offline: pure functions over
 * in-memory records, and the dates are plain calendar days so nothing shifts
 * with a time zone.
 */
import type { Medication, Pet, VetRecord, VetRecordInput, VetRecordKind } from '../types';
import { isValidISODate } from '../types';
import { medicationSummary } from './carePassWizard';
import { EMERGENCY_BLANK, emergencyText } from './emergencyMode';
import { petEmojiFor, shortDate } from './petDisplay';

/** What a missing value looks like everywhere in Vet Mode. */
export const VET_BLANK = EMERGENCY_BLANK;

/** The longest a visit's reason may be (it becomes the record's title). */
export const VET_REASON_MAX = 80;

/** The longest one question may be. */
export const VET_QUESTION_MAX = 160;

/** How many questions one visit may carry (a cap on hand-edited storage too). */
export const VET_MAX_QUESTIONS = 12;

/** The longest "what the vet said" note. */
export const VET_OUTCOME_MAX = 500;

/** The longest the composed record notes may be. */
export const VET_NOTES_MAX = 600;

/** The longest a pet id may be when it is read back out of storage. */
export const VET_PET_ID_MAX = 60;

/** How many prepared visits one pet may hold (a sanity cap on storage). */
export const VET_MAX_DRAFTS = 50;

/** The title a saved visit gets when the owner typed no reason. */
export const VET_DEFAULT_TITLE = 'Vet visit';

/* -------------------------------------------------------------- test ids -- */

/** The back link on the Vet Mode screen. */
export const VET_BACK_TESTID = 'vet-back';

/** The pet picker entry for one pet, e.g. `vet-pet-pet-bella`. */
export function vetPetTestId(petId: string): string {
  return `vet-pet-${petId}`;
}

/** One prepared visit's row, e.g. `vet-draft-<id>`. */
export function vetDraftTestId(draftId: string): string {
  return `vet-draft-${draftId}`;
}

/** One follow-up row, e.g. `vet-followup-<id>`. */
export function vetFollowUpTestId(draftId: string): string {
  return `vet-followup-${draftId}`;
}

/* ------------------------------------------------------------------ text -- */

/** Tidy an owner-typed value for storage — the app's one sanitiser, capped. */
export function vetText(value: unknown, max: number = VET_REASON_MAX): string {
  return emergencyText(value, max);
}

/* --------------------------------------------------------- prepared visit -- */

/**
 * A visit the owner is preparing for, held on this device until it happens.
 *
 * It is deliberately NOT a vet record: nothing has happened yet. The record is
 * created by "Save the visit", and until then the prep is only the owner's own
 * notes — which is why a prepared visit never appears in the pet's records, and
 * why the recheck (a real date) is the one thing that does.
 */
export interface VetVisitDraft {
  id: string;
  createdAt: string;
  petId: string;
  /** The day of the visit (ISO `YYYY-MM-DD`). */
  visitDate: string;
  /** Why the visit is happening — becomes the record's title when saved. */
  reason: string;
  /** The questions to ask, in the owner's own words and order. */
  questions: string[];
  /** What the vet said, filled in during or after the visit (optional). */
  outcome: string;
  /** The day the vet asked to see the pet again (ISO), or '' for none. */
  recheckDate: string;
  /** The vet record this prep was filed as — '' until "Save the visit". */
  savedVisitId: string;
  /** ISO timestamp of that save — '' until then. */
  savedAt: string;
  /** The follow-up appointment record the recheck created, or ''. */
  recheckRecordId: string;
}

/** What the screen collects; the store assigns the id and the timestamp. */
export interface VetVisitDraftInput {
  petId: string;
  visitDate: string;
  reason: string;
  questions: string[];
  outcome: string;
  recheckDate: string;
  savedVisitId: string;
  savedAt: string;
  recheckRecordId: string;
}

/** A fresh prep: today, nothing typed, no recheck. */
export function vetInitDraft(petId: string, todayKey: string): VetVisitDraft {
  return {
    id: '',
    createdAt: '',
    petId: emergencyText(petId, VET_PET_ID_MAX),
    visitDate: isValidISODate(emergencyText(todayKey, 10)) ? todayKey : '',
    reason: '',
    questions: [],
    outcome: '',
    recheckDate: '',
    savedVisitId: '',
    savedAt: '',
    recheckRecordId: '',
  };
}

/**
 * A stored list of questions, kept honest: only strings survive, each is
 * flattened and capped, empties drop, and the list is capped. A missing or
 * non-array value is simply no questions — never a throw.
 */
export function vetQuestions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const question = emergencyText(item, VET_QUESTION_MAX);
    if (question.length === 0) continue;
    out.push(question);
    if (out.length >= VET_MAX_QUESTIONS) break;
  }
  return out;
}

/**
 * Add one question (pure). A blank question, a duplicate or a list already at
 * the cap leaves the list exactly as it was — the screen says so instead.
 */
export function addVetQuestion(list: unknown, text: unknown): string[] {
  const current = vetQuestions(list);
  const question = emergencyText(text, VET_QUESTION_MAX);
  if (question.length === 0) return current;
  if (current.length >= VET_MAX_QUESTIONS) return current;
  if (current.includes(question)) return current;
  return [...current, question];
}

/** Remove the question at `index` (pure). An out-of-range index changes nothing. */
export function removeVetQuestion(list: unknown, index: number): string[] {
  const current = vetQuestions(list);
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return current;
  return current.filter((_, i) => i !== index);
}

/** Whether one more question still fits. */
export function vetQuestionsFull(list: unknown): boolean {
  return vetQuestions(list).length >= VET_MAX_QUESTIONS;
}

/** "3 questions to ask", "1 question to ask", "No questions written yet". */
export function vetQuestionsLabel(list: unknown): string {
  const count = vetQuestions(list).length;
  if (count === 0) return 'No questions written yet';
  return `${count} question${count === 1 ? '' : 's'} to ask`;
}

/* ----------------------------------------------------------------- dates -- */

/**
 * The blocking problem with a prepared visit's date ('' when it is usable).
 *
 * Two rules only: it has to be a real calendar day, and it cannot be in the
 * past. A visit that already happened belongs in the records file (the pet's
 * Vet records screen dates a record in the past happily) — this screen is for a
 * visit still to come, and saying so is kinder than accepting a date the app
 * would then have to explain away.
 */
export function vetVisitDateError(date: unknown, todayKey: unknown): string {
  const day = emergencyText(date, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day)) {
    return 'That is not a calendar day yet — write it as YYYY-MM-DD, e.g. 2026-11-03.';
  }
  if (!isValidISODate(today)) return '';
  if (day < today) {
    return 'That day has already passed. A visit that happened goes into the pet’s vet records — this screen is for a visit still to come.';
  }
  return '';
}

/**
 * The honest aside under a usable date, or ''. Two facts are worth saying out
 * loud and neither is an error: the day is today (so nothing is "upcoming"
 * about it), and a record already exists for that day — filing a second one is
 * allowed, but the owner should not be surprised by it.
 */
export function vetVisitDateNote(
  date: unknown,
  todayKey: unknown,
  records: readonly VetRecord[] | null | undefined,
  petId: unknown,
): string {
  const day = emergencyText(date, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day)) return '';
  const sameDay = vetRecordsOnDay(records, petId, day);
  if (sameDay.length > 0) {
    const first = sameDay[0];
    const what = emergencyText(first.visitTitle, 60) || 'a record with no title';
    const kind = vetKindLabel(vetRecordKindOf(first));
    return `You already have ${kind.toLowerCase() === 'visit' ? 'a visit' : `an ${kind.toLowerCase()}`} filed for that day — “${what}”. Saving this one too simply adds a second record for the same day.`;
  }
  if (day === today) {
    return 'That is today — the visit is happening, so this is the day to save it.';
  }
  return `That is ${shortDate(day)} — ${vetDaysAwayLabel(day, today)}.`;
}

/** "in 6 days", "tomorrow" — a plain relative line, never a promise. */
export function vetDaysAwayLabel(date: unknown, todayKey: unknown): string {
  const day = emergencyText(date, 10);
  const today = emergencyText(todayKey, 10);
  const days = vetDaysBetween(today, day);
  if (days === null) return 'a day this device can read';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 0) {
    const ago = -days;
    return `${ago} day${ago === 1 ? '' : 's'} ago`;
  }
  return `in ${days} days`;
}

/**
 * Whole days from one ISO day to another (negative when the second is earlier).
 * Always null for anything that is not a real calendar day — never NaN.
 */
export function vetDaysBetween(fromISO: unknown, toISO: unknown): number | null {
  const from = isoToUTC(emergencyText(fromISO, 10));
  const to = isoToUTC(emergencyText(toISO, 10));
  if (from === null || to === null) return null;
  return Math.round((to - from) / 86_400_000);
}

/** "YYYY-MM-DD" to UTC midnight ms, or null when it is not a real day. */
function isoToUTC(iso: string): number | null {
  if (!isValidISODate(iso)) return null;
  const at = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  return Number.isNaN(at) ? null : at;
}

/* ---------------------------------------------------------------- records -- */

/** The kind a record actually is (`visit` when the field is absent). */
export function vetRecordKindOf(record: Pick<VetRecord, 'kind'> | null | undefined): VetRecordKind {
  const kind = record?.kind;
  return kind === 'appointment' || kind === 'document' ? kind : 'visit';
}

/** The screen's word for each kind — the same words the records tab uses. */
export function vetKindLabel(kind: VetRecordKind): string {
  switch (kind) {
    case 'appointment':
      return 'Appointment';
    case 'document':
      return 'Document';
    default:
      return 'Visit';
  }
}

/** Every record of this pet dated on `day`, junk dates excluded. */
export function vetRecordsOnDay(
  records: readonly VetRecord[] | null | undefined,
  petId: unknown,
  day: unknown,
): VetRecord[] {
  const wanted = emergencyText(petId, VET_PET_ID_MAX);
  const date = emergencyText(day, 10);
  if (wanted.length === 0 || !isValidISODate(date)) return [];
  const list = Array.isArray(records) ? records : [];
  return list.filter(
    (record) =>
      record != null &&
      emergencyText(record.petId, VET_PET_ID_MAX) === wanted &&
      emergencyText(record.visitDate, 10) === date,
  );
}

/**
 * The pet's most recent visit that actually HAPPENED — dated today or earlier —
 * read from the same `VetRecord` records the Records tab, the Home Upcoming rail
 * and the emergency card use. Appointments and documents are not visits (a
 * booked day is not a day that happened), and a record dated in the future is
 * not the last visit either. Null when there is none.
 */
export function vetLastVisitRecord(
  records: readonly VetRecord[] | null | undefined,
  petId: unknown,
  todayKey: unknown,
): VetRecord | null {
  const wanted = emergencyText(petId, VET_PET_ID_MAX);
  const today = emergencyText(todayKey, 10);
  if (wanted.length === 0) return null;
  const list = Array.isArray(records) ? records : [];
  const visits = list.filter((record) => {
    if (record == null) return false;
    if (emergencyText(record.petId, VET_PET_ID_MAX) !== wanted) return false;
    if (vetRecordKindOf(record) !== 'visit') return false;
    const date = emergencyText(record.visitDate, 10);
    if (!isValidISODate(date)) return false;
    if (isValidISODate(today) && date > today) return false;
    return true;
  });
  if (visits.length === 0) return null;
  return visits.reduce((best, record) =>
    emergencyText(record.visitDate, 10) > emergencyText(best.visitDate, 10) ||
    (emergencyText(record.visitDate, 10) === emergencyText(best.visitDate, 10) &&
      emergencyText(record.createdAt, 40) > emergencyText(best.createdAt, 40))
      ? record
      : best,
  );
}

/**
 * A booked appointment whose day has already gone with no visit filed on or
 * after it — worth saying plainly, because the records file does not know
 * whether that appointment happened. '' when there is nothing to say.
 */
export function vetPendingAppointmentLine(
  records: readonly VetRecord[] | null | undefined,
  petId: unknown,
  todayKey: unknown,
): string {
  const wanted = emergencyText(petId, VET_PET_ID_MAX);
  const today = emergencyText(todayKey, 10);
  if (wanted.length === 0 || !isValidISODate(today)) return '';
  const list = Array.isArray(records) ? records : [];
  const past = list.filter((record) => {
    if (record == null) return false;
    if (emergencyText(record.petId, VET_PET_ID_MAX) !== wanted) return false;
    if (vetRecordKindOf(record) !== 'appointment') return false;
    const date = emergencyText(record.visitDate, 10);
    return isValidISODate(date) && date <= today;
  });
  if (past.length === 0) return '';
  const newest = past.reduce((best, record) =>
    emergencyText(record.visitDate, 10) > emergencyText(best.visitDate, 10) ? record : best,
  );
  const day = emergencyText(newest.visitDate, 10);
  const last = vetLastVisitRecord(records, wanted, today);
  const lastDay = last ? emergencyText(last.visitDate, 10) : '';
  if (lastDay !== '' && lastDay >= day) return '';
  const what = emergencyText(newest.visitTitle, 60) || 'an untitled appointment';
  return `The last date on file is an appointment for ${shortDate(day)} (“${what}”) with no visit recorded for it — the app cannot know whether that day happened.`;
}

/* ------------------------------------------------- the last visit summary -- */

/** One "Label … value" line of the last-visit summary. */
export interface VetSummaryLine {
  key: string;
  label: string;
  /** The value, or `VET_BLANK` ("Not on file") when nothing is stored. */
  value: string;
  blank: boolean;
  testID: string;
}

/** What the pet's last filed visit looks like, read-only. */
export interface VetLastVisitSummary {
  petId: string;
  /** True when a real visit is on file (the lines below are then all its own). */
  hasVisit: boolean;
  title: string;
  dateISO: string;
  /** "3 Aug 2026", or '' when there is no usable date. */
  dateLabel: string;
  /** Every line, blanks included and labelled as blanks ([] when no visit). */
  lines: VetSummaryLine[];
  /** How many lines actually have something on file. */
  onFile: number;
  total: number;
  /** "4 of 5 lines on file · 1 says “Not on file”." */
  readyLine: string;
  /** The honest empty state when no visit has been filed yet. */
  emptyLine: string;
  /** The passed-appointment aside, or '' — see `vetPendingAppointmentLine`. */
  pendingLine: string;
}

/** One line from a stored value: the text, or the honest placeholder. */
function summaryLine(
  petId: string,
  key: string,
  label: string,
  raw: unknown,
  max: number,
): VetSummaryLine {
  const value = emergencyText(raw, max);
  return {
    key,
    label,
    value: value.length > 0 ? value : VET_BLANK,
    blank: value.length === 0,
    testID: `vet-last-${petId}-${key}`,
  };
}

/**
 * The last visit on file for one pet, in the screen's own reading order: what it
 * was for, when, where, who saw them and what was written down. Every value is
 * read off a real record — a record with an empty clinic field says "Not on
 * file", and a pet with no visit at all gets `emptyLine` instead of invented
 * history.
 */
export function buildVetLastVisitSummary(input: {
  petId: unknown;
  petName: unknown;
  records: readonly VetRecord[] | null | undefined;
  todayKey: unknown;
}): VetLastVisitSummary {
  const petId = emergencyText(input.petId, VET_PET_ID_MAX);
  const petName = emergencyText(input.petName, 60) || 'your pet';
  const record = vetLastVisitRecord(input.records, petId, input.todayKey);
  const pendingLine = vetPendingAppointmentLine(input.records, petId, input.todayKey);
  if (!record) {
    return {
      petId,
      hasVisit: false,
      title: '',
      dateISO: '',
      dateLabel: '',
      lines: [],
      onFile: 0,
      total: 0,
      readyLine: '',
      emptyLine: `No visit is filed for ${petName} yet — when one happens, “Save the visit” files it here on this device.`,
      pendingLine,
    };
  }
  const dateISO = emergencyText(record.visitDate, 10);
  const lines: VetSummaryLine[] = [
    summaryLine(petId, 'reason', 'What it was for', record.visitTitle, 80),
    summaryLine(petId, 'when', 'When', isValidISODate(dateISO) ? shortDate(dateISO) : '', 40),
    summaryLine(petId, 'clinic', 'Clinic', record.clinicName, 80),
    summaryLine(petId, 'vet', 'Who saw them', record.veterinarian, 80),
    summaryLine(petId, 'notes', 'Notes', record.notes, 240),
  ];
  const onFile = lines.filter((line) => !line.blank).length;
  const missing = lines.length - onFile;
  return {
    petId,
    hasVisit: true,
    title: emergencyText(record.visitTitle, 80) || VET_DEFAULT_TITLE,
    dateISO,
    dateLabel: isValidISODate(dateISO) ? shortDate(dateISO) : '',
    lines,
    onFile,
    total: lines.length,
    readyLine:
      missing === 0
        ? `${onFile} of ${lines.length} lines on file — the whole visit is written down.`
        : `${onFile} of ${lines.length} lines on file · ${missing} ${missing === 1 ? 'says' : 'say'} “${VET_BLANK}”.`,
    emptyLine: '',
    pendingLine,
  };
}

/* ------------------------------------------------------- current medication -- */

/** The medication the pet is on today, read with the care pass's own rule. */
export interface VetMedsSummary {
  petId: string;
  /** One line per active medication, in the same words a care pass carries. */
  lines: string[];
  count: number;
  /** The honest line shown instead of a list when there are none. */
  note: string;
}

/**
 * The pet's current medication, read through the Care Pass wizard's own
 * `medicationSummary` — so "active today" means exactly what it means on a pass
 * (started on or before today, not ended before today) and the two can never
 * drift apart. A pet with nothing active gets `note`, never an empty block.
 */
export function buildVetMedsSummary(input: {
  petId: unknown;
  petName: unknown;
  medications: readonly Medication[] | null | undefined;
  todayKey: unknown;
}): VetMedsSummary {
  const petId = emergencyText(input.petId, VET_PET_ID_MAX);
  const petName = emergencyText(input.petName, 60) || 'your pet';
  const todayKey = emergencyText(input.todayKey, 10);
  const list = Array.isArray(input.medications) ? input.medications : [];
  const theirs = list.filter(
    (med) => med != null && emergencyText(med.petId, VET_PET_ID_MAX) === petId,
  );
  const summary = medicationSummary(theirs, todayKey);
  const lines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return {
    petId,
    lines,
    count: lines.length,
    note:
      lines.length === 0
        ? `No current medication is listed for ${petName} — nothing appears here on purpose.`
        : `${lines.length} medication${lines.length === 1 ? '' : 's'} on file, from ${petName}’s own records.`,
  };
}

/* ------------------------------------------------------- writing the visit -- */

/** Whether a saved visit is a visit that happened, or still a booked day. */
export function vetVisitKind(visitDate: unknown, todayKey: unknown): VetRecordKind {
  const day = emergencyText(visitDate, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day) || !isValidISODate(today)) return 'visit';
  return day > today ? 'appointment' : 'visit';
}

/** The title the record gets: the owner's reason, or the honest default. */
export function vetVisitTitle(reason: unknown): string {
  return emergencyText(reason, VET_REASON_MAX) || VET_DEFAULT_TITLE;
}

/**
 * The record's notes, built only from what the owner actually typed: the
 * questions they brought and what the vet said. Nothing is filled in, and a
 * visit with neither gets no notes at all (`undefined`) rather than a sentence
 * that claims something.
 */
export function vetVisitNotes(draft: Pick<VetVisitDraft, 'questions' | 'outcome'>): string | undefined {
  const questions = vetQuestions(draft?.questions);
  const outcome = emergencyText(draft?.outcome, VET_OUTCOME_MAX);
  const parts: string[] = [];
  if (questions.length > 0) {
    parts.push(
      `Questions to ask: ${questions.map((q, i) => `${i + 1}) ${q}`).join(' ')}`,
    );
  }
  if (outcome.length > 0) parts.push(`What the vet said: ${outcome}`);
  if (parts.length === 0) return undefined;
  return emergencyText(parts.join('\n'), VET_NOTES_MAX);
}

/**
 * The `VetRecord` a prepared visit becomes — the app's own entity, written
 * through the app's own vet store, so the Records tab, the Home Upcoming rail
 * and the emergency card all see it at once. `kind` is honest about the date: a
 * visit dated today or earlier is a visit, one still ahead is an appointment.
 */
export function vetVisitRecordInput(
  draft: VetVisitDraft,
  todayKey: unknown,
): VetRecordInput {
  const visitDate = emergencyText(draft?.visitDate, 10);
  const input: VetRecordInput = {
    petId: emergencyText(draft?.petId, VET_PET_ID_MAX),
    visitTitle: vetVisitTitle(draft?.reason),
    visitDate,
    kind: vetVisitKind(visitDate, todayKey),
  };
  const notes = vetVisitNotes(draft ?? { questions: [], outcome: '' });
  if (notes !== undefined) input.notes = notes;
  return input;
}

/** The follow-up appointment's title: "Recheck — sore paw". */
export function vetRecheckTitle(reason: unknown): string {
  const why = emergencyText(reason, VET_REASON_MAX);
  return emergencyText(why.length > 0 ? `Recheck — ${why}` : 'Recheck — vet visit', 100);
}

/**
 * The follow-up appointment record a recheck date becomes. It is written into
 * the SAME vet store, which is exactly why it shows up on Home's Upcoming rail
 * and in Today: the app's existing sourcing already reads a visit-like record
 * with a future date. No notification is scheduled — that stays premium.
 */
export function vetRecheckRecordInput(
  draft: VetVisitDraft,
  todayKey: unknown,
): VetRecordInput {
  const recheckDate = emergencyText(draft?.recheckDate, 10);
  const visitDate = emergencyText(draft?.visitDate, 10);
  const when = isValidISODate(visitDate) ? shortDate(visitDate) : 'the visit';
  return {
    petId: emergencyText(draft?.petId, VET_PET_ID_MAX),
    visitTitle: vetRecheckTitle(draft?.reason),
    visitDate: recheckDate,
    // Always an appointment: a recheck is a day still to come, never a visit
    // that has happened — which is also what keeps it on the Upcoming rail.
    kind: 'appointment',
    notes: emergencyText(`Recheck recorded in Vet Mode after the visit on ${when}.`, 240),
  };
}

/**
 * Whether a recheck date can become a real follow-up record: a real day that is
 * today or later. A day that has already gone is never filed retroactively — the
 * app cannot know whether the recheck happened, and pretending it is booked
 * would be a lie.
 */
export function vetRecheckSchedulable(draft: VetVisitDraft, todayKey: unknown): boolean {
  const day = emergencyText(draft?.recheckDate, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day)) return false;
  if (!isValidISODate(today)) return true;
  return day >= today;
}

/**
 * The honest problem with a recheck date that is there but unusable, or ''.
 * A recheck before the visit itself is the one order rule worth stating.
 */
export function vetRecheckDateError(
  draft: Pick<VetVisitDraft, 'visitDate' | 'recheckDate'>,
  todayKey: unknown,
): string {
  const day = emergencyText(draft?.recheckDate, 10);
  if (day.length === 0) return '';
  if (!isValidISODate(day)) {
    return 'That recheck date is not a calendar day — write it as YYYY-MM-DD, or leave it blank.';
  }
  const visitDate = emergencyText(draft?.visitDate, 10);
  if (isValidISODate(visitDate) && day < visitDate) {
    return 'The recheck is dated before the visit itself — pick the visit’s day or a day after it.';
  }
  return vetVisitDateError(day, '');
}

/* ------------------------------------------------------------- rechecking -- */

/** Where a prepared visit's recheck sits, relative to today and the records. */
export type VetRecheckStatus = 'none' | 'scheduled' | 'today' | 'past' | 'removed';

/** What each recheck status is called on screen. */
export function vetRecheckStatusLabel(status: VetRecheckStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'today':
      return 'Today';
    case 'past':
      return 'Needs scheduling';
    case 'removed':
      return 'Not scheduled';
    default:
      return 'No recheck';
  }
}

/** The palette tone each recheck status badge uses (a `TONE` key). */
export function vetRecheckStatusTone(
  status: VetRecheckStatus,
): 'blue' | 'leaf' | 'coral' | 'neutral' | 'sunshine' {
  switch (status) {
    case 'scheduled':
      return 'blue';
    case 'today':
      return 'sunshine';
    case 'past':
      return 'coral';
    case 'removed':
      return 'coral';
    default:
      return 'neutral';
  }
}

/**
 * The recheck's real state, derived from the date AND the records it claims to
 * live in. This is why deleting the follow-up record in the records tab cannot
 * leave Vet Mode claiming a booking that no longer exists:
 *
 *  - `none`      — no recheck date was captured;
 *  - `scheduled` — a future day, and its appointment record is still on file;
 *  - `today`     — the recheck is today, and its record is still on file;
 *  - `past`      — the day has gone. Whether it happened is not something the
 *                  app can know: it says so and asks for a date, rather than
 *                  inventing a visit or a booking;
 *  - `removed`   — a future day whose appointment record is no longer in the
 *                  pet's records (deleted by hand), so nothing is booked.
 */
export function vetRecheckStatus(
  draft: Pick<VetVisitDraft, 'petId' | 'recheckDate' | 'recheckRecordId'> | null | undefined,
  todayKey: unknown,
  records: readonly VetRecord[] | null | undefined,
): VetRecheckStatus {
  const day = emergencyText(draft?.recheckDate, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day)) return 'none';
  if (isValidISODate(today) && day < today) return 'past';
  const petId = emergencyText(draft?.petId, VET_PET_ID_MAX);
  const wanted = emergencyText(draft?.recheckRecordId, 60);
  const list = Array.isArray(records) ? records : [];
  const found =
    wanted.length > 0 &&
    list.some(
      (record) =>
        record != null &&
        emergencyText(record.id, 60) === wanted &&
        emergencyText(record.petId, VET_PET_ID_MAX) === petId,
    );
  if (!found) return 'removed';
  return day === today ? 'today' : 'scheduled';
}

/** The plain sentence under a recheck badge — always true, never a promise. */
export function vetRecheckStatusLine(
  status: VetRecheckStatus,
  draft: Pick<VetVisitDraft, 'petId' | 'recheckDate'> | null | undefined,
  petName: unknown,
): string {
  const name = emergencyText(petName, 60) || 'your pet';
  const day = emergencyText(draft?.recheckDate, 10);
  const when = isValidISODate(day) ? shortDate(day) : '';
  switch (status) {
    case 'scheduled':
      return `Booked for ${when} — it is in ${name}’s records and on the Upcoming list. Nothing is sent; it is a date on this device.`;
    case 'today':
      return `The recheck is today (${when}) — it is in ${name}’s records, and it shows on Today until the day is over.`;
    case 'past':
      return `${when} has passed. If the recheck happened, file the visit and record the next date — if it did not, it needs scheduling. The app will not guess which.`;
    case 'removed':
      return `Nothing is booked for ${when} any more — the follow-up record is no longer in ${name}’s records. Book it in and save the visit again, or add it on the vet records screen.`;
    default:
      return 'No recheck date was recorded for this visit. If the vet asks for one, add it and it appears on the Upcoming list.';
  }
}

/* --------------------------------------------------------- prepared visits -- */

/** Where a prepared visit sits relative to today. */
export type VetDraftStatus = 'upcoming' | 'today' | 'passed' | 'undated';

/** What each prepared-visit status is called on screen. */
export function vetDraftStatusLabel(status: VetDraftStatus): string {
  switch (status) {
    case 'today':
      return 'Today';
    case 'passed':
      return 'Day has passed';
    case 'undated':
      return 'Date needed';
    default:
      return 'Upcoming';
  }
}

/** The palette tone each prepared-visit status uses (a `TONE` key). */
export function vetDraftStatusTone(
  status: VetDraftStatus,
): 'blue' | 'sunshine' | 'coral' | 'neutral' {
  switch (status) {
    case 'today':
      return 'sunshine';
    case 'passed':
      return 'coral';
    case 'undated':
      return 'neutral';
    default:
      return 'blue';
  }
}

/** Where a prepared visit sits relative to today. Never throws, never NaN. */
export function vetDraftStatus(
  draft: Pick<VetVisitDraft, 'visitDate'> | null | undefined,
  todayKey: unknown,
): VetDraftStatus {
  const day = emergencyText(draft?.visitDate, 10);
  const today = emergencyText(todayKey, 10);
  if (!isValidISODate(day) || !isValidISODate(today)) return 'undated';
  if (day < today) return 'passed';
  return day === today ? 'today' : 'upcoming';
}

/** A stored draft, every field made safe. Null when it cannot be one at all. */
export function vetDraftFromStored(raw: unknown): VetVisitDraft | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const petId = emergencyText(record.petId, VET_PET_ID_MAX);
  if (petId.length === 0) return null;
  return {
    id: emergencyText(record.id, 60),
    createdAt: emergencyText(record.createdAt, 40),
    petId,
    visitDate: emergencyText(record.visitDate, 10),
    reason: emergencyText(record.reason, VET_REASON_MAX),
    questions: vetQuestions(record.questions),
    outcome: emergencyText(record.outcome, VET_OUTCOME_MAX),
    recheckDate: emergencyText(record.recheckDate, 10),
    savedVisitId: emergencyText(record.savedVisitId, 60),
    savedAt: emergencyText(record.savedAt, 40),
    recheckRecordId: emergencyText(record.recheckRecordId, 60),
  };
}

/** A draft as the store wants it — every field cleaned on the way in. */
export function vetDraftToInput(draft: VetVisitDraft): VetVisitDraftInput {
  const clean = vetDraftFromStored({ ...draft, petId: draft?.petId ?? '' });
  const petId = clean?.petId ?? emergencyText(draft?.petId, VET_PET_ID_MAX);
  return {
    petId,
    visitDate: clean?.visitDate ?? '',
    reason: clean?.reason ?? '',
    questions: clean?.questions ?? [],
    outcome: clean?.outcome ?? '',
    recheckDate: clean?.recheckDate ?? '',
    savedVisitId: clean?.savedVisitId ?? '',
    savedAt: clean?.savedAt ?? '',
    recheckRecordId: clean?.recheckRecordId ?? '',
  };
}

/** Whether a prepared visit has already been filed as a record. */
export function vetDraftIsSaved(draft: Pick<VetVisitDraft, 'savedVisitId'> | null | undefined): boolean {
  return emergencyText(draft?.savedVisitId, 60).length > 0;
}

/** Every prepared visit for one pet, safe to render. */
export function vetDraftsForPet(
  drafts: readonly VetVisitDraft[] | null | undefined,
  petId: unknown,
): VetVisitDraft[] {
  const wanted = emergencyText(petId, VET_PET_ID_MAX);
  if (wanted.length === 0) return [];
  const list = Array.isArray(drafts) ? drafts : [];
  const out: VetVisitDraft[] = [];
  for (const item of list) {
    const clean = vetDraftFromStored(item);
    // A record with no id cannot be opened, updated or removed — it is dropped
    // rather than shown as a row that does nothing when tapped.
    if (!clean || clean.petId !== wanted || clean.id.length === 0) continue;
    out.push(clean);
    if (out.length >= VET_MAX_DRAFTS) break;
  }
  return out;
}

/** The visits still to come (not filed yet), soonest first. */
export function vetUpcomingDrafts(
  drafts: readonly VetVisitDraft[] | null | undefined,
  petId: unknown,
): VetVisitDraft[] {
  return vetDraftsForPet(drafts, petId)
    .filter((draft) => !vetDraftIsSaved(draft))
    .sort(
      (a, b) =>
        (a.visitDate === '' ? '9999' : a.visitDate).localeCompare(
          b.visitDate === '' ? '9999' : b.visitDate,
        ) || a.createdAt.localeCompare(b.createdAt),
    );
}

/** The visits already filed, most recently filed first. */
export function vetSavedDrafts(
  drafts: readonly VetVisitDraft[] | null | undefined,
  petId: unknown,
): VetVisitDraft[] {
  return vetDraftsForPet(drafts, petId)
    .filter(vetDraftIsSaved)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.visitDate.localeCompare(a.visitDate));
}

/** "2 visits you are preparing for", … or the honest empty line. */
export function vetUpcomingLabel(drafts: readonly VetVisitDraft[] | null | undefined): string {
  const count = Array.isArray(drafts) ? drafts.length : 0;
  if (count === 0) return 'Nothing in the pipeline';
  return `${count} visit${count === 1 ? '' : 's'} you are preparing for`;
}

/* ----------------------------------------------------------------- picking -- */

/**
 * Which pet the screen opens on: the one asked for when it is a real pet,
 * otherwise the first pet. Null only when there are no pets at all.
 */
export function resolveVetPet<T extends { id: string }>(
  pets: readonly T[],
  petId?: string | null,
): T | null {
  if (!Array.isArray(pets) || pets.length === 0) return null;
  const wanted = emergencyText(petId, 80);
  if (wanted.length > 0) {
    const match = pets.find((pet) => pet.id === wanted);
    if (match) return match;
  }
  return pets[0];
}

/** Whether the screen should show the picker at all (one pet needs no choosing). */
export function vetNeedsPicker(pets: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(pets) && pets.length > 1;
}

/** One selectable row in the pet picker. */
export interface VetPetOption {
  petId: string;
  name: string;
  emoji: string;
  selected: boolean;
  testID: string;
}

/** The picker rows for the given pets, with `selectedId` marked. */
export function vetPetOptions(
  pets: readonly Pick<Pet, 'id' | 'name' | 'species' | 'customSpecies'>[],
  selectedId: unknown,
): VetPetOption[] {
  const wanted = emergencyText(selectedId, 80);
  const list = Array.isArray(pets) ? pets : [];
  return list.map((pet) => ({
    petId: pet.id,
    name: emergencyText(pet.name, 60) || 'Your pet',
    emoji: petEmojiFor(pet),
    selected: pet.id === wanted,
    testID: vetPetTestId(pet.id),
  }));
}
