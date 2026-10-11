/**
 * Travel Mode — the pure core (HANDOFF, unit 1 of 3).
 *
 * Travel Mode is the pet parent's *trip-planning* layer, and the Care Pass is
 * what a trip hands to a sitter. So this module never creates a pass itself:
 * it plans the trip (who is coming, which days, which pets), keeps the owner's
 * "before you go" checklist, and reads the pets' own records back as the
 * handoff summary the sitter will receive. Creating the pass is the wizard's
 * job, and Travel Mode hands off to it with the trip's pets and dates — the
 * wizard stays the single source of truth for pass creation.
 *
 * Everything here is pure (no React, no storage, no platform module) so the
 * whole thing can be exercised in Node against fixtures — see
 * /home/team/shared/travel-mode-verification/. Two rules it keeps:
 *
 *  - **Nothing is invented.** The handoff summary is built by the wizard's own
 *    prefill builders (`prefilledPetNotes`), so what a trip previews and what a
 *    pass carries can never disagree; a field with nothing stored reads
 *    "Not on file" (`EMERGENCY_BLANK`, the app's one placeholder), never
 *    "undefined", never "NaN" and never a guess.
 *  - **No scolding.** A trip with nothing ticked, a pet with no records, a
 *    deleted pet still named on a trip — each says plainly what it is and what
 *    it is not. Dates are validated with the wizard's own `wizardDateError`, so
 *    there is exactly one date rule in the app.
 *
 * 100% offline: pure functions over in-memory records. No storage, no network.
 */
import type {
  BaseEntity,
  CareInstructions,
  CarePass,
  FeedingSchedule,
  Medication,
  Pet,
  VetRecord,
} from '../types';
import {
  CARE_PASS_CONTACT_ROLES,
  carePassContactRoleLabel,
  carePassDurationDays,
  carePassStatus,
  isValidISODate,
} from '../types';
import type { EmergencyCardExtras } from '../pdf/emergency/document';
import type { CarePassWizardState } from './carePassWizard';
import type { CarePassWizardPetNotes } from './carePassWizard';
import {
  contactDraftLine,
  prefilledPetNotes,
  wizardDayKey,
  wizardDateError,
} from './carePassWizard';
import { EMERGENCY_BLANK, emergencyText } from './emergencyMode';
import { petEmojiFor } from './petDisplay';

/** What a missing value looks like everywhere in Travel Mode. */
export const TRAVEL_BLANK = EMERGENCY_BLANK;

/** The longest a trip name may be (the store caps it here too). */
export const TRAVEL_NAME_MAX = 80;

/** The longest a pet id may be when it is read back out of storage. */
export const TRAVEL_PET_ID_MAX = 60;

/** How many pets one trip may name (a sanity cap on hand-edited storage). */
export const TRAVEL_MAX_PETS = 50;

/* ------------------------------------------------------------------ model -- */

/**
 * A saved trip: the owner's plan for being away, on this device.
 *
 * It is deliberately NOT a pass. A trip may exist before any pass does, may
 * never get one, and carries no care content of its own — the content lives in
 * the pets' records and in the pass the wizard builds.
 */
export interface TravelTrip extends BaseEntity {
  /** What the owner calls this trip. Blank is allowed — see `travelTripName`. */
  name: string;
  /** First day away (ISO `YYYY-MM-DD`). */
  startDate: string;
  /** Last day away (ISO `YYYY-MM-DD`, inclusive). */
  endDate: string;
  /** The pets coming along / staying home under a sitter, in pick order. */
  petIds: string[];
  /** Slugs of the "before you go" checklist lines already sorted. */
  checked: string[];
}

/** What the screen collects; the store assigns the id and the timestamp. */
export interface TravelTripInput {
  name: string;
  startDate: string;
  endDate: string;
  petIds: string[];
  checked: string[];
}

/** The editable trip the screen holds (a trip that may not be saved yet). */
export interface TravelDraft {
  /** Set when the draft came from (and will update) a saved trip. */
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  petIds: string[];
  checked: string[];
}

/* -------------------------------------------------------------- checklist -- */

/**
 * One "before you go" line. The slug is stable and stored; the words are the
 * screen's. Four lines, because four is what a sitter handover actually turns
 * on — food, medication, a number, and the sitter knowing the dates.
 */
export interface TravelChecklistItem {
  slug: string;
  emoji: string;
  label: string;
  /** The one quiet line under the label explaining what "done" means. */
  hint: string;
}

/** THE checklist — the screen, the store's cleaner and the harness all read it. */
export const TRAVEL_CHECKLIST: readonly TravelChecklistItem[] = [
  {
    slug: 'food-bagged',
    emoji: '🍽️',
    label: 'Food portions bagged',
    hint: 'Every meal for the days you are away, portioned and labelled the way you feed them.',
  },
  {
    slug: 'meds-counted',
    emoji: '💊',
    label: 'Medication counted for the trip',
    hint: 'Enough for every day you are away, plus a spare day if you have one.',
  },
  {
    slug: 'vet-number-posted',
    emoji: '📞',
    label: 'Vet’s number posted for the sitter',
    hint: 'On the fridge or on the pass — wherever your sitter will actually look.',
  },
  {
    slug: 'sitter-dates-confirmed',
    emoji: '🤝',
    label: 'Sitter confirmed the dates',
    hint: 'They know which days they have them, and when you are back.',
  },
];

/** How many checklist lines there are (the "2 of 4 sorted" denominator). */
export const TRAVEL_CHECKLIST_COUNT = TRAVEL_CHECKLIST.length;

/** Every canonical checklist slug, in order. */
export const TRAVEL_CHECKLIST_SLUGS: readonly string[] = TRAVEL_CHECKLIST.map(
  (item) => item.slug,
);

/** The checklist line with this slug, or null for an unknown slug. */
export function travelChecklistItem(slug: string): TravelChecklistItem | null {
  return TRAVEL_CHECKLIST.find((item) => item.slug === slug) ?? null;
}

/** Whether a value is one of the four canonical checklist slugs. */
export function isTravelChecklistSlug(value: unknown): boolean {
  return typeof value === 'string' && TRAVEL_CHECKLIST_SLUGS.includes(value);
}

/**
 * A stored checked list, kept honest: unknown slugs drop, duplicates collapse,
 * and the result comes back in the checklist's own order so two equal sets
 * compare equal.
 */
export function travelCheckedSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const chosen = new Set(value.filter(isTravelChecklistSlug) as string[]);
  return TRAVEL_CHECKLIST_SLUGS.filter((slug) => chosen.has(slug));
}

/** Whether one checklist line is ticked on this trip. */
export function travelIsChecked(trip: Pick<TravelTrip, 'checked'> | undefined, slug: string): boolean {
  if (!trip || !isTravelChecklistSlug(slug)) return false;
  return travelCheckedSlugs(trip.checked).includes(slug);
}

/** Tick or untick one line, leaving every other line alone (pure). */
export function travelToggleChecked(
  trip: Pick<TravelTrip, 'checked'> | undefined,
  slug: string,
): string[] {
  const current = travelCheckedSlugs(trip?.checked);
  if (!isTravelChecklistSlug(slug)) return current;
  const next = current.includes(slug)
    ? current.filter((item) => item !== slug)
    : [...current, slug];
  return next;
}

/** How many checklist lines are ticked. */
export function travelCheckedCount(trip: Pick<TravelTrip, 'checked'> | undefined): number {
  return travelCheckedSlugs(trip?.checked).length;
}

/**
 * The honest progress line: "2 of 4 sorted", "All 4 sorted", "Nothing ticked
 * yet". Never a nag — a trip with nothing ticked is a trip that has not been
 * packed yet, which is simply a fact.
 */
export function travelChecklistLabel(
  trip: Pick<TravelTrip, 'checked'> | undefined,
): string {
  const done = travelCheckedCount(trip);
  if (done === 0) return 'Nothing ticked yet';
  if (done === TRAVEL_CHECKLIST_COUNT) return `All ${TRAVEL_CHECKLIST_COUNT} sorted`;
  return `${done} of ${TRAVEL_CHECKLIST_COUNT} sorted`;
}

/* ------------------------------------------------------------------ naming -- */

/** A trip's display name: the owner's own, else its dates, else honest words. */
export function travelTripName(trip: Pick<TravelTrip, 'name' | 'startDate' | 'endDate'> | undefined): string {
  const name = emergencyText(trip?.name, TRAVEL_NAME_MAX);
  if (name.length > 0) return name;
  const start = emergencyText(trip?.startDate, 10);
  const end = emergencyText(trip?.endDate, 10);
  if (isValidISODate(start) && isValidISODate(end)) return `${start} → ${end}`;
  return 'Trip without dates yet';
}

/** The dates line for a trip row ("12 Oct 2026 → …" is the pass's job; this is ISO). */
export function travelTripDatesLabel(
  trip: Pick<TravelTrip, 'startDate' | 'endDate'> | undefined,
): string {
  const start = emergencyText(trip?.startDate, 10);
  const end = emergencyText(trip?.endDate, 10);
  if (isValidISODate(start) && isValidISODate(end)) return `${start} → ${end}`;
  if (isValidISODate(start)) return `From ${start} · no end date yet`;
  if (isValidISODate(end)) return `Until ${end} · no start date yet`;
  return 'No dates on this trip yet';
}

/** How long a trip runs, in whole days inclusive (0 when the dates are unusable). */
export function travelTripDays(
  trip: Pick<TravelTrip, 'startDate' | 'endDate'> | undefined,
): number {
  const start = emergencyText(trip?.startDate, 10);
  const end = emergencyText(trip?.endDate, 10);
  if (!isValidISODate(start) || !isValidISODate(end) || end < start) return 0;
  return carePassDurationDays({ startDate: start, endDate: end });
}

/* ------------------------------------------------------------------ dates -- */

/**
 * The inline problem for a trip's dates and pets ('' when it is ready to save).
 * The date rule is the wizard's own — one date rule in the app, not two.
 * Never throws: any odd input is simply "not a real calendar day".
 */
export function travelTripProblem(input: {
  startDate: unknown;
  endDate: unknown;
  petIds?: readonly string[] | null;
}): string {
  const pets = Array.isArray(input.petIds) ? input.petIds : [];
  if (pets.length === 0) return 'Pick at least one pet for this trip.';
  return wizardDateError(emergencyText(input.startDate, 10), emergencyText(input.endDate, 10));
}

/** The plain-words line under the dates, or '' when the dates are not usable. */
export function travelDatesStatusLine(
  startDate: unknown,
  endDate: unknown,
  todayKey: string,
): string {
  const start = emergencyText(startDate, 10);
  const end = emergencyText(endDate, 10);
  if (wizardDateError(start, end)) return '';
  const status = travelTripStatus({ startDate: start, endDate: end }, todayKey);
  if (status === 'past') {
    return 'Those days have already passed — this trip stays on your device as a record of it.';
  }
  if (status === 'upcoming') {
    return `Away from ${start} to ${end}. It reads as Upcoming until ${start}.`;
  }
  return `You are away right now — back on ${end}.`;
}

/* ----------------------------------------------------------------- status -- */

/** Where a trip sits in its own date window, relative to today. */
export type TravelTripStatus = 'upcoming' | 'covering' | 'past' | 'undated';

/** What each status is called on screen. */
export function travelTripStatusLabel(status: TravelTripStatus): string {
  switch (status) {
    case 'upcoming':
      return 'Upcoming';
    case 'covering':
      return 'Active now';
    case 'past':
      return 'Passed';
    case 'undated':
      return 'Dates needed';
  }
}

/** The palette tone each status badge uses (a `TONE` key, kept as a string). */
export function travelTripStatusTone(status: TravelTripStatus): 'blue' | 'leaf' | 'neutral' | 'coral' {
  switch (status) {
    case 'upcoming':
      return 'blue';
    case 'covering':
      return 'leaf';
    case 'past':
      return 'neutral';
    case 'undated':
      return 'coral';
  }
}

/**
 * A trip's status from its date window. The end-date half is the app's own
 * TZ-correct rule (`carePassStatus`), so a trip and a pass over the same days
 * can never disagree about whether the window has passed. A trip whose dates
 * are missing or unusable reads "Dates needed" rather than pretending.
 */
export function travelTripStatus(
  trip: Pick<TravelTrip, 'startDate' | 'endDate'> | undefined,
  todayKey: string,
): TravelTripStatus {
  const start = emergencyText(trip?.startDate, 10);
  const end = emergencyText(trip?.endDate, 10);
  if (!isValidISODate(start) || !isValidISODate(end) || end < start) return 'undated';
  if (start > todayKey) return 'upcoming';
  return carePassStatus({ endDate: end, status: 'active' }, todayKey) === 'expired'
    ? 'past'
    : 'covering';
}

/** Whether two ISO day windows overlap (both ends inclusive). Never throws. */
export function travelWindowsOverlap(
  a: { startDate?: unknown; endDate?: unknown } | null | undefined,
  b: { startDate?: unknown; endDate?: unknown } | null | undefined,
): boolean {
  const aStart = emergencyText(a?.startDate, 10);
  const aEnd = emergencyText(a?.endDate, 10);
  const bStart = emergencyText(b?.startDate, 10);
  const bEnd = emergencyText(b?.endDate, 10);
  for (const day of [aStart, aEnd, bStart, bEnd]) {
    if (!isValidISODate(day)) return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
}

/* --------------------------------------------------------------- the pets -- */

/** The pets on a trip, in the trip's own pick order, dropping deleted ones. */
export function travelTripPets(
  trip: Pick<TravelTrip, 'petIds'> | undefined,
  pets: readonly Pet[],
): Pet[] {
  const ids = Array.isArray(trip?.petIds) ? trip.petIds : [];
  const byId = new Map(pets.map((pet) => [pet.id, pet]));
  const out: Pet[] = [];
  for (const id of ids) {
    const pet = typeof id === 'string' ? byId.get(id) : undefined;
    if (pet) out.push(pet);
  }
  return out;
}

/** A pet's name as a trip may show it — sanitised, and never blank. */
function travelPetName(pet: Pet | undefined): string {
  return emergencyText(pet?.name, 60) || 'Your pet';
}

/**
 * The pets line for a trip row. Says exactly what happened: names when the
 * pets are here, "No pets picked yet" when none were picked, and plainly that
 * a profile is gone when a trip still names a pet this device no longer has.
 */
export function travelTripPetsLabel(
  trip: Pick<TravelTrip, 'petIds'> | undefined,
  pets: readonly Pet[],
): string {
  const live = travelTripPets(trip, pets);
  if (live.length > 0) return live.map(travelPetName).join(' · ');
  const named = Array.isArray(trip?.petIds) ? trip.petIds.length : 0;
  return named > 0 ? 'No longer in your app' : 'No pets picked yet';
}

/* ------------------------------------------------- the sitter's summary -- */

/** One "Label … value" line of a pet's handoff summary. */
export interface TravelSummaryLine {
  key: string;
  label: string;
  /** The value, or `TRAVEL_BLANK` ("Not on file") when nothing is stored. */
  value: string;
  blank: boolean;
}

/** What one pet's trip handoff currently looks like, read-only. */
export interface TravelPetSummary {
  petId: string;
  name: string;
  emoji: string;
  photoUri: string;
  /** Every line, in reading order, blanks included and labelled as blanks. */
  lines: TravelSummaryLine[];
  /** How many lines actually have something on file. */
  onFile: number;
  /** How many lines there are in total. */
  total: number;
  /** "6 of 9 handoff lines on file · 3 say “Not on file”." */
  readyLine: string;
  /** True when every line is on file — the sitter needs nothing added. */
  complete: boolean;
}

/** Everything the summary reads for one pet — the app's own stores. */
export interface TravelSummaryInput {
  pet: Pet;
  /** The owner's own name from Settings (the pass's "pet parent" line). */
  ownerName: string;
  /** Today, for the medication-activity rule (injected so the harness can pin it). */
  todayKey: string;
  feeding?: readonly FeedingSchedule[] | null;
  medications?: readonly Medication[] | null;
  careInstructions?: CareInstructions | null;
  extras?: EmergencyCardExtras | null;
  vetRecords?: readonly VetRecord[] | null;
}

/** One line from a prefill value: the text, or the honest placeholder. */
function summaryLine(key: string, label: string, raw: unknown): TravelSummaryLine {
  const value = emergencyText(raw, 400);
  return {
    key,
    label,
    value: value.length > 0 ? value : TRAVEL_BLANK,
    blank: value.length === 0,
  };
}

/**
 * One pet's handoff summary for a trip: feeding, medication, the written care
 * notes, the four contact lines, the microchip and the allergies — every one
 * read through the wizard's own prefill builders, so the preview and the pass
 * cannot drift apart. A pet with nothing on file produces nine honest
 * "Not on file" lines, never a blank block and never a fabricated value.
 */
export function travelPetSummary(input: TravelSummaryInput): TravelPetSummary {
  const { pet } = input;
  // The wizard's builders, reused — not re-derived here. The owner's name is
  // only ever used as a contact line, so a missing one is an empty string
  // rather than a reason to fall over (a summary is a read, not a save).
  const notes: CarePassWizardPetNotes = prefilledPetNotes({
    petId: pet.id,
    ownerName: typeof input.ownerName === 'string' ? input.ownerName : '',
    todayKey: input.todayKey,
    feeding: input.feeding ?? [],
    medications: input.medications ?? [],
    careInstructions: input.careInstructions ?? null,
    extras: input.extras ?? null,
    vetRecords: input.vetRecords ?? [],
  });

  const lines: TravelSummaryLine[] = [
    summaryLine('feeding', 'Feeding', notes.feeding),
    summaryLine('medications', 'Medication', notes.medications),
    summaryLine('care', 'Care notes', notes.care),
  ];
  for (const role of CARE_PASS_CONTACT_ROLES) {
    const line = contactDraftLine(notes.contacts?.[role]);
    lines.push(summaryLine(`contact-${role}`, carePassContactRoleLabel(role), line));
  }
  lines.push(summaryLine('microchip', 'Microchip', notes.microchip));
  lines.push(summaryLine('allergies', 'Allergies', notes.allergies));

  const onFile = lines.filter((line) => !line.blank).length;
  const missing = lines.length - onFile;
  return {
    petId: pet.id,
    name: travelPetName(pet),
    emoji: petEmojiFor(pet),
    photoUri: typeof pet.photoUri === 'string' ? pet.photoUri : '',
    lines,
    onFile,
    total: lines.length,
    readyLine:
      missing === 0
        ? `${onFile} of ${lines.length} handoff lines on file — everything the sitter needs is here.`
        : `${onFile} of ${lines.length} handoff lines on file · ${missing} ${missing === 1 ? 'says' : 'say'} “${TRAVEL_BLANK}”.`,
    complete: missing === 0,
  };
}

/** The summaries for every pet on a trip, in the trip's own order. */
export function travelTripSummaries(
  trip: Pick<TravelTrip, 'petIds'> | undefined,
  pets: readonly Pet[],
  sources: (pet: Pet) => Omit<TravelSummaryInput, 'pet'>,
): TravelPetSummary[] {
  return travelTripPets(trip, pets).map((pet) =>
    travelPetSummary({ pet, ...sources(pet) }),
  );
}

/* ------------------------------------------------------------- covering -- */

/**
 * The pass that already covers this trip, or null.
 *
 * A pass counts when it is not closed, its day window overlaps the trip's, and
 * it names at least one of the trip's pets. A *closed* pass covers nothing —
 * the owner ended it — and a pass over different days is a different handover,
 * so neither is offered as a duplicate.
 */
export function findCoveringPass(
  passes: readonly CarePass[] | null | undefined,
  trip: Pick<TravelTrip, 'petIds' | 'startDate' | 'endDate'> | undefined,
): CarePass | null {
  const list = Array.isArray(passes) ? passes : [];
  const tripPets = new Set(
    (Array.isArray(trip?.petIds) ? trip.petIds : []).filter(
      (id): id is string => typeof id === 'string' && id !== '',
    ),
  );
  if (tripPets.size === 0) return null;
  for (const pass of list) {
    if (!pass || pass.status === 'closed') continue;
    if (!travelWindowsOverlap(trip, pass)) continue;
    const covered: string[] = Array.isArray(pass.selectedPetIds) ? pass.selectedPetIds : [];
    if (!covered.some((id: string) => tripPets.has(id))) continue;
    return pass;
  }
  return null;
}

/** One plain line describing the pass that already covers a trip. */
export function coveringPassLine(pass: CarePass): string {
  const caregiver = emergencyText(pass.caregiverName, 60) || 'your sitter';
  const dates = emergencyText(`${pass.startDate} → ${pass.endDate}`, 40);
  return `A pass for ${caregiver} runs ${dates} — open it instead of making a second one.`;
}

/* -------------------------------------------------- handing to the wizard -- */

/** The prefill Travel Mode hands the Care Pass wizard. */
export interface TravelWizardPrefill {
  petIds: string[];
  startDate: string;
  endDate: string;
  /** What changed since the last handoff — the wizard re-applies on a change. */
  signature: string;
}

/** The signature of a prefill (used to notice a *new* handoff). */
export function travelPrefillSignature(prefill: {
  petIds: readonly string[];
  startDate: string;
  endDate: string;
}): string {
  return `${prefill.petIds.join(',')}|${prefill.startDate}|${prefill.endDate}`;
}

/**
 * Read the navigation params Travel Mode passes the wizard, or null when they
 * say nothing usable (then the wizard opens exactly as it always has). Odd
 * params — a string where a list belongs, a junk date, an inverted window —
 * are simply not a prefill: nothing throws and nothing is half-applied.
 */
export function travelPrefillFromParams(
  params: { petIds?: unknown; startDate?: unknown; endDate?: unknown } | null | undefined,
): TravelWizardPrefill | null {
  if (!params || typeof params !== 'object') return null;
  const raw = Array.isArray(params.petIds) ? params.petIds : [];
  const petIds: string[] = [];
  for (const id of raw) {
    const clean = emergencyText(id, TRAVEL_PET_ID_MAX);
    if (clean.length === 0 || petIds.includes(clean)) continue;
    petIds.push(clean);
    if (petIds.length >= TRAVEL_MAX_PETS) break;
  }
  const startDate = emergencyText(params.startDate, 10);
  const endDate = emergencyText(params.endDate, 10);
  if (petIds.length === 0) return null;
  if (wizardDateError(startDate, endDate)) return null;
  return {
    petIds,
    startDate,
    endDate,
    signature: travelPrefillSignature({ petIds, startDate, endDate }),
  };
}

/** The prefill for a real trip: its live pets and its dates, or null. */
export function travelPrefillForTrip(
  trip: Pick<TravelTrip, 'petIds' | 'startDate' | 'endDate'> | undefined,
  pets: readonly Pet[],
): TravelWizardPrefill | null {
  const live = travelTripPets(trip, pets);
  if (live.length === 0) return null;
  return travelPrefillFromParams({
    petIds: live.map((pet) => pet.id),
    startDate: trip?.startDate,
    endDate: trip?.endDate,
  });
}

/**
 * The wizard's state with a trip's pets and dates carried in — the exact
 * handoff, and the only thing Travel Mode does to the wizard's state.
 *
 * The pets are the *live* ones (an id whose profile is gone is dropped rather
 * than selected invisibly), the dates are only taken when they are real days
 * and not inverted, and a prefill that says nothing leaves the wizard's own
 * opening state alone.
 */
export function wizardWithTripPrefill(
  state: CarePassWizardState,
  prefill: TravelWizardPrefill | null | undefined,
  pets: readonly Pet[],
): CarePassWizardState {
  if (!prefill) return state;
  const live = new Set(pets.map((pet) => pet.id));
  const petIds = prefill.petIds.filter((id) => live.has(id));
  const startDate = isValidISODate(prefill.startDate) ? prefill.startDate : state.startDate;
  const wantedEnd = isValidISODate(prefill.endDate) ? prefill.endDate : state.endDate;
  // A window is never inverted, whatever a hand-edited store says.
  const endDate = wantedEnd < startDate ? startDate : wantedEnd;
  return {
    ...state,
    selectedPetIds: petIds.length > 0 ? petIds : state.selectedPetIds,
    startDate,
    endDate,
  };
}

/* ----------------------------------------------------------------- drafts -- */

/** A fresh trip: every pet on it, today → a week today (the wizard's own span). */
export function travelInitDraft(pets: readonly Pet[], todayKey: string): TravelDraft {
  return {
    name: '',
    startDate: todayKey,
    endDate: wizardDayKey(todayKey, 7),
    petIds: pets.map((pet) => pet.id),
    checked: [],
  };
}

/**
 * A saved trip as an editable draft. Every field is cleaned on the way in, so
 * a hand-edited store can never put junk into an input box.
 */
export function travelDraftFromTrip(trip: TravelTrip): TravelDraft {
  return {
    id: typeof trip.id === 'string' && trip.id !== '' ? trip.id : undefined,
    name: emergencyText(trip.name, TRAVEL_NAME_MAX),
    startDate: emergencyText(trip.startDate, 10),
    endDate: emergencyText(trip.endDate, 10),
    petIds: (Array.isArray(trip.petIds) ? trip.petIds : [])
      .filter((id): id is string => typeof id === 'string' && id !== '')
      .slice(0, TRAVEL_MAX_PETS),
    checked: travelCheckedSlugs(trip.checked),
  };
}

/** A draft as the store wants it. */
export function travelDraftToInput(draft: TravelDraft): TravelTripInput {
  return {
    name: emergencyText(draft.name, TRAVEL_NAME_MAX),
    startDate: emergencyText(draft.startDate, 10),
    endDate: emergencyText(draft.endDate, 10),
    petIds: (Array.isArray(draft.petIds) ? draft.petIds : [])
      .filter((id): id is string => typeof id === 'string' && id !== '')
      .slice(0, TRAVEL_MAX_PETS),
    checked: travelCheckedSlugs(draft.checked),
  };
}

/** Whether a draft can be saved (the same rule the store enforces). */
export function travelDraftProblem(draft: TravelDraft | null): string {
  if (!draft) return 'This trip is still loading.';
  return travelTripProblem(draft);
}
