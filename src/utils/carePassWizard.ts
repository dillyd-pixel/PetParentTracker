/**
 * The "I'm Leaving Town" wizard — its steps, its state and every derivation,
 * with no React and no storage in sight (so it can be exercised directly in
 * Node, exactly like `utils/caregiverCheckIn`).
 *
 * What the wizard is: the guided way to hand a trusted caregiver a care pass.
 * The owner walks eight steps, and at each one the app asks the stores it
 * already has — the pets, their feeding and medication schedules, their written
 * care notes and the emergency-card details — so the owner confirms instead of
 * retyping. Everything is editable, nothing is invented: a pet with no feeding
 * schedule produces a blank feeding box with a line saying so, never a
 * plausible-looking guess.
 *
 * The rules this module keeps:
 *  - **Nothing is required that the owner cannot supply.** Only the caregiver's
 *    name and the dates are needed to create the pass (the model cannot store a
 *    pass without them). A step never blocks the next one; the wizard nudges
 *    instead, and the one real check happens on the Create button.
 *  - **Prefills are labelled as prefills.** `caregiverPrefilled` and the
 *    per-step hints let the screens say where a value came from ("from the name
 *    you check in with"), so the owner is never puzzled by a filled-in box.
 *  - **Blank stays blank.** Every summary returns '' when there is nothing on
 *    file; the caller then shows the step's empty-state hint.
 *  - **No pressure.** The dates read Active/Expired because that is what the
 *    model derives from the calendar — the copy says so plainly and never tells
 *    the owner to hurry.
 *
 * 100% offline: pure functions over in-memory records. No storage, no network.
 */
import {
  CARE_PASS_CONTACT_ROLES,
  CARE_PASS_SECTIONS,
  carePassStatus,
  cleanCarePassText,
  isValidISODate,
} from '../types';
import type {
  CarePassContact,
  CarePassContactRole,
  CarePassInput,
  CarePassPermissionLevel,
  CarePassPetSnapshot,
  CarePassSection,
} from '../types';
import {
  careInstructionsContentBySection,
  careInstructionValue,
} from '../types/careInstructions';
import type { CareInstructions } from '../types/careInstructions';
import { isEveryDay, feedingDaysLabel, medicationScheduleLabel } from '../types';
import type { FeedingSchedule, Medication, Pet, VetRecord } from '../types';
import { shiftISODate } from './gamification';

/* ----------------------------------------------------------------- steps -- */

/** The eight steps, in order. Adding a step means adding it here. */
export type CarePassWizardStepId =
  | 'welcome'
  | 'pets'
  | 'caregiver'
  | 'dates'
  | 'feeding'
  | 'medications'
  | 'emergency'
  | 'review';

/** One step: its id, its mascot and the words the header shows. */
export interface CarePassWizardStep {
  id: CarePassWizardStepId;
  emoji: string;
  /** The step's own heading, e.g. "Who's looking after them?". */
  title: string;
  /** The small-caps line above the heading, e.g. "Care & handoff". */
  eyebrow: string;
}

/** THE step list — the wizard, the step indicator and the review all read it. */
export const CARE_PASS_WIZARD_STEPS: readonly CarePassWizardStep[] = [
  {
    id: 'welcome',
    emoji: '🧳',
    eyebrow: 'Care & handoff',
    title: 'Leaving town?',
  },
  {
    id: 'pets',
    emoji: '🐾',
    eyebrow: 'The pets',
    title: 'Who are you handing over?',
  },
  {
    id: 'caregiver',
    emoji: '🤝',
    eyebrow: 'The caregiver',
    title: 'Who’s looking after them?',
  },
  {
    id: 'dates',
    emoji: '🗓️',
    eyebrow: 'The dates',
    title: 'For which days?',
  },
  {
    id: 'feeding',
    emoji: '🍽️',
    eyebrow: 'Feeding',
    title: 'Meals, as you want them followed',
  },
  {
    id: 'medications',
    emoji: '💊',
    eyebrow: 'Medication',
    title: 'Anything being taken right now',
  },
  {
    id: 'emergency',
    emoji: '🚨',
    eyebrow: 'Emergency contacts',
    title: 'Who to call if something happens',
  },
  {
    id: 'review',
    emoji: '📋',
    eyebrow: 'Household & review',
    title: 'One last look',
  },
];

/** How many steps the wizard has (the "STEP 4 OF 8" denominator). */
export const CARE_PASS_WIZARD_STEP_COUNT = CARE_PASS_WIZARD_STEPS.length;

/** The step with this id, or the first step for an unknown one. */
export function wizardStepById(id: CarePassWizardStepId): CarePassWizardStep {
  return CARE_PASS_WIZARD_STEPS.find((step) => step.id === id) ?? CARE_PASS_WIZARD_STEPS[0];
}

/* ----------------------------------------------------------------- state -- */

/** One contact box in the wizard: a name and a number, either possibly blank. */
export interface CarePassWizardContactDraft {
  name: string;
  phone: string;
}

/** One pet's editable notes in the wizard (all free text, all optional). */
export interface CarePassWizardPetNotes {
  feeding: string;
  medications: string;
  care: string;
  /** The four contacts the emergency step asks about, by role. */
  contacts: Record<CarePassContactRole, CarePassWizardContactDraft>;
  microchip: string;
  allergies: string;
}

/** The whole wizard's state — local, on-device, lost on purpose when you leave. */
export interface CarePassWizardState {
  /** Index into `CARE_PASS_WIZARD_STEPS`. */
  stepIndex: number;
  /** The pets this pass covers, in the order they were picked. */
  selectedPetIds: string[];
  /** The pet parent's own name (their Settings name, editable here). */
  creatorName: string;
  /** The caregiver the pass is for. */
  caregiverName: string;
  /** True when the caregiver box was filled from the stored check-in name. */
  caregiverPrefilled: boolean;
  startDate: string;
  endDate: string;
  permissionLevel: CarePassPermissionLevel;
  /** Every canonical section starts on; the owner unticks what to withhold. */
  visibleSections: CarePassSection[];
  /** The pass-level note for whoever is in the house. */
  householdNote: string;
  /** Per-pet notes, keyed by pet id. */
  petNotes: Record<string, CarePassWizardPetNotes>;
}

/** The emergency-card details the wizard prefills from (see storage/emergencyDetails). */
export interface WizardEmergencyExtras {
  ownerPhone?: string;
  coParentName?: string;
  coParentPhone?: string;
  vetName?: string;
  vetPhone?: string;
  emergencyVetName?: string;
  emergencyVetPhone?: string;
  microchip?: string;
  allergies?: string;
  behaviorNote?: string;
}

/** Everything the wizard needs to build its first state. */
export interface CarePassWizardInit {
  /** Today in the owner's display zone (`YYYY-MM-DD`). */
  todayKey: string;
  /** The owner's own name from Settings. */
  ownerName: string;
  /** The stored check-in name, when there is one (`null` = none stored). */
  storedCaregiverName?: string | null;
  /** All the owner's pets — a single pet is selected up front. */
  pets: readonly Pet[];
}

/** An empty contacts record, one box per role. */
export function emptyWizardContacts(): Record<CarePassContactRole, CarePassWizardContactDraft> {
  const out = {} as Record<CarePassContactRole, CarePassWizardContactDraft>;
  for (const role of CARE_PASS_CONTACT_ROLES) out[role] = { name: '', phone: '' };
  return out;
}

/** A pet's notes with nothing written yet. */
export function emptyWizardPetNotes(): CarePassWizardPetNotes {
  return {
    feeding: '',
    medications: '',
    care: '',
    contacts: emptyWizardContacts(),
    microchip: '',
    allergies: '',
  };
}

/** The notes the wizard holds for a pet (an empty set when it holds none yet). */
export function wizardPetNotes(
  state: CarePassWizardState,
  petId: string,
): CarePassWizardPetNotes {
  return state.petNotes[petId] ?? emptyWizardPetNotes();
}

/**
 * The wizard's opening state: today → a week today, every section on, the
 * owner's own name in, and the caregiver box prefilled from the stored
 * check-in name when there is one. One pet home means that pet is already
 * selected — the common case, one tap fewer.
 */
export function wizardInit(input: CarePassWizardInit): CarePassWizardState {
  const stored = input.storedCaregiverName?.trim() ?? '';
  return {
    stepIndex: 0,
    selectedPetIds: input.pets.length === 1 ? [input.pets[0].id] : [],
    creatorName: input.ownerName?.trim() ?? '',
    caregiverName: stored,
    caregiverPrefilled: stored.length > 0,
    startDate: input.todayKey,
    endDate: shiftISODate(input.todayKey, 7) ?? input.todayKey,
    permissionLevel: 'update-tasks',
    visibleSections: [...CARE_PASS_SECTIONS],
    householdNote: '',
    petNotes: {},
  };
}

/* ------------------------------------------------------------ navigation -- */

/** The step the wizard is on. */
export function wizardCurrentStep(state: CarePassWizardState): CarePassWizardStep {
  return CARE_PASS_WIZARD_STEPS[state.stepIndex] ?? CARE_PASS_WIZARD_STEPS[0];
}

/** "STEP 4 OF 8" — the indicator every step shows. */
export function wizardStepIndicator(state: CarePassWizardState): string {
  return `Step ${Math.min(state.stepIndex + 1, CARE_PASS_WIZARD_STEP_COUNT)} of ${CARE_PASS_WIZARD_STEP_COUNT}`;
}

/** Whether there is a next step (the last step creates instead of advancing). */
export function wizardHasNext(state: CarePassWizardState): boolean {
  return state.stepIndex < CARE_PASS_WIZARD_STEP_COUNT - 1;
}

/** Move one step forward. Clamped at the last step — never past it. */
export function wizardNext(state: CarePassWizardState): CarePassWizardState {
  if (!wizardHasNext(state)) return state;
  return { ...state, stepIndex: state.stepIndex + 1 };
}

/** Move one step back. Clamped at the first step. */
export function wizardBack(state: CarePassWizardState): CarePassWizardState {
  if (state.stepIndex <= 0) return state;
  return { ...state, stepIndex: state.stepIndex - 1 };
}

/** Jump to a step by id (used by the review screen's "change this" links). */
export function wizardGoTo(
  state: CarePassWizardState,
  id: CarePassWizardStepId,
): CarePassWizardState {
  const index = CARE_PASS_WIZARD_STEPS.findIndex((step) => step.id === id);
  return index < 0 ? state : { ...state, stepIndex: index };
}

/* ------------------------------------------------------------- pet picks -- */

/** Add or remove one pet from the pass. */
export function wizardTogglePet(
  state: CarePassWizardState,
  petId: string,
): CarePassWizardState {
  const selected = state.selectedPetIds.includes(petId);
  return {
    ...state,
    selectedPetIds: selected
      ? state.selectedPetIds.filter((id) => id !== petId)
      : [...state.selectedPetIds, petId],
  };
}

/**
 * Select every pet, or clear the lot when they are all already on. `pets` is
 * the owner's own list, so ids of pets that no longer exist never linger.
 */
export function wizardToggleAllPets(
  state: CarePassWizardState,
  pets: readonly Pet[],
): CarePassWizardState {
  const ids = pets.map((pet) => pet.id);
  const all = ids.length > 0 && ids.every((id) => state.selectedPetIds.includes(id));
  return { ...state, selectedPetIds: all ? [] : ids };
}

/** Whether every one of the owner's pets is already on the pass. */
export function wizardAllPetsSelected(
  state: CarePassWizardState,
  pets: readonly Pet[],
): boolean {
  return pets.length > 0 && pets.every((pet) => state.selectedPetIds.includes(pet.id));
}

/** The label for the select-all shortcut: "All 3 pets" / "Clear the pets". */
export function wizardAllPetsLabel(
  state: CarePassWizardState,
  pets: readonly Pet[],
): string {
  const all = wizardAllPetsSelected(state, pets);
  const count = pets.length;
  if (all) return count === 1 ? 'Clear the pet' : 'Clear the pets';
  return count === 1 ? 'Pick the pet' : `All ${count} pets`;
}

/** The selected pets, in the owner's own render order. */
export function wizardSelectedPets(
  state: CarePassWizardState,
  pets: readonly Pet[],
): Pet[] {
  return pets.filter((pet) => state.selectedPetIds.includes(pet.id));
}

/** Set one string note on one pet, leaving every other note alone. */
export function wizardSetPetNote(
  state: CarePassWizardState,
  petId: string,
  note: Partial<Omit<CarePassWizardPetNotes, 'contacts'>>,
): CarePassWizardState {
  const current = wizardPetNotes(state, petId);
  return {
    ...state,
    petNotes: { ...state.petNotes, [petId]: { ...current, ...note } },
  };
}

/** Set one contact box (name or phone) on one pet. */
export function wizardSetPetContact(
  state: CarePassWizardState,
  petId: string,
  role: CarePassContactRole,
  field: keyof CarePassWizardContactDraft,
  value: string,
): CarePassWizardState {
  const current = wizardPetNotes(state, petId);
  const contact = current.contacts[role] ?? { name: '', phone: '' };
  return {
    ...state,
    petNotes: {
      ...state.petNotes,
      [petId]: {
        ...current,
        contacts: { ...current.contacts, [role]: { ...contact, [field]: value } },
      },
    },
  };
}

/* --------------------------------------------------------------- prefill -- */

/** One line per meal on a pet's feeding schedule, e.g. "Breakfast 06:30 · 120 g". */
function mealLine(schedule: FeedingSchedule): string {
  const portion = `${schedule.portionAmount} ${schedule.portionUnit}`;
  const days = isEveryDay(schedule.daysOfWeek) ? '' : ` (${feedingDaysLabel(schedule.daysOfWeek)})`;
  const notes = cleanCarePassText(schedule.notes, 120);
  return `• ${schedule.mealType} ${schedule.time} · ${portion}${days}${
    notes ? ` — ${notes}` : ''
  }`;
}

/**
 * The feeding summary for one pet: its real meal times and portions, then the
 * food notes it has written (brand, amount, where it is kept, treats). Both
 * halves are optional; a pet with neither returns '' and the step says so.
 */
export function feedingSummary(
  schedules: readonly FeedingSchedule[],
  instructions?: CareInstructions | null,
): string {
  const lines: string[] = [];
  const meals = schedules
    .slice()
    .sort((a, b) => a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt));
  for (const meal of meals) lines.push(mealLine(meal));
  const notes: Array<[string, string | undefined]> = [
    ['Food', instructions ? careInstructionValue(instructions, 'foodBrand') || undefined : undefined],
    ['Amount', instructions ? careInstructionValue(instructions, 'foodAmount') || undefined : undefined],
    ['Kept', instructions ? careInstructionValue(instructions, 'foodStored') || undefined : undefined],
    ['Treats', instructions ? careInstructionValue(instructions, 'treatAllowance') || undefined : undefined],
  ];
  for (const [label, value] of notes) {
    if (value) lines.push(`${label}: ${value}`);
  }
  return cleanCarePassText(lines.join('\n'));
}

/** Is this medication on the pass's list today? (Same rule the day view uses.) */
export function medicationOnPassToday(m: Medication, todayKey: string): boolean {
  if (!m.active) return false;
  if (m.endDate && m.endDate < todayKey) return false;
  if (m.startDate && m.startDate > todayKey) return false;
  return true;
}

/**
 * The medication summary for one pet: every medication the pet is on today,
 * with its dosage, its schedule and the owner's own note, plus the last day of
 * the course when there is one. Nothing active on file → ''.
 */
export function medicationSummary(
  medications: readonly Medication[],
  todayKey: string,
): string {
  const due = medications
    .filter((m) => medicationOnPassToday(m, todayKey))
    .slice()
    .sort(
      (a, b) =>
        (a.times[0] ?? '99:99').localeCompare(b.times[0] ?? '99:99') ||
        a.name.localeCompare(b.name),
    );
  const lines = due.map((m) => {
    const notes = cleanCarePassText(m.notes, 120);
    const until = m.endDate ? `, until ${m.endDate}` : '';
    return `• ${m.name} · ${m.dosage} · ${medicationScheduleLabel(m)}${until}${
      notes ? ` — ${notes}` : ''
    }`;
  });
  return cleanCarePassText(lines.join('\n'));
}

/**
 * The pet's written care notes, as the pass carries them: every section of the
 * notes EXCEPT feeding and medication (those have their own steps), each line
 * labelled with the field it came from. Nothing written → ''.
 */
export function careNoteSummary(instructions?: CareInstructions | null): string {
  const sections = careInstructionsContentBySection(instructions).filter(
    (content) => content.section !== 'feeding' && content.section !== 'medications',
  );
  const lines: string[] = [];
  for (const section of sections) {
    for (const entry of section.entries) {
      lines.push(`${section.label} — ${entry.field.label}: ${entry.value}`);
    }
  }
  return cleanCarePassText(lines.join('\n'));
}

/** The most recent vet record that names a vet or a clinic, or null. */
export function latestVetRecord(records: readonly VetRecord[]): VetRecord | null {
  const visits = records.filter((record) => (record.kind ?? 'visit') !== 'document');
  if (visits.length === 0) return null;
  return visits.reduce((best, record) =>
    record.visitDate > best.visitDate ? record : best,
  );
}

/**
 * The four contact boxes for one pet, prefilled from what is actually on file:
 * the owner's own name and number, the co-parent from the emergency details,
 * the vet (their own typed name, else the vet named on the pet's latest visit
 * record) and the out-of-hours vet. Every value is optional; a blank box stays
 * blank, and nothing is ever guessed from a different pet.
 */
export function contactPrefill(options: {
  ownerName: string;
  extras?: WizardEmergencyExtras | null;
  vetRecords?: readonly VetRecord[];
}): Record<CarePassContactRole, CarePassWizardContactDraft> {
  const extras = options.extras ?? {};
  const vetRecord = latestVetRecord(options.vetRecords ?? []);
  const vetName =
    extras.vetName?.trim() || vetRecord?.veterinarian?.trim() || vetRecord?.clinicName?.trim() || '';
  return {
    owner: { name: options.ownerName.trim(), phone: extras.ownerPhone?.trim() ?? '' },
    'co-parent': {
      name: extras.coParentName?.trim() ?? '',
      phone: extras.coParentPhone?.trim() ?? '',
    },
    vet: { name: vetName, phone: extras.vetPhone?.trim() ?? '' },
    'emergency-vet': {
      name: extras.emergencyVetName?.trim() ?? '',
      phone: extras.emergencyVetPhone?.trim() ?? '',
    },
  };
}

/** What one pet's notes start as when the owner first reaches the wizard. */
export function prefilledPetNotes(options: {
  petId: string;
  ownerName: string;
  todayKey: string;
  feeding?: readonly FeedingSchedule[];
  medications?: readonly Medication[];
  careInstructions?: CareInstructions | null;
  extras?: WizardEmergencyExtras | null;
  vetRecords?: readonly VetRecord[];
}): CarePassWizardPetNotes {
  return {
    feeding: feedingSummary(options.feeding ?? [], options.careInstructions),
    medications: medicationSummary(options.medications ?? [], options.todayKey),
    care: careNoteSummary(options.careInstructions),
    contacts: contactPrefill({
      ownerName: options.ownerName,
      extras: options.extras,
      vetRecords: options.vetRecords,
    }),
    microchip: options.extras?.microchip?.trim() ?? '',
    allergies: options.extras?.allergies?.trim() ?? '',
  };
}

/**
 * Fill a pet's notes in from the stores, once — the wizard's first visit to
 * the pet's steps. A pet the owner has already edited keeps exactly what they
 * typed, so walking back and forward never overwrites their words.
 */
export function wizardPrefillPet(
  state: CarePassWizardState,
  notes: CarePassWizardPetNotes,
  petId: string,
): CarePassWizardState {
  if (state.petNotes[petId]) return state;
  return { ...state, petNotes: { ...state.petNotes, [petId]: notes } };
}

/* ----------------------------------------------------------------- dates -- */

/** The day a quick-pick chip offers: an ISO day `days` after `todayKey`. */
export function wizardDayKey(todayKey: string, days: number): string {
  return shiftISODate(todayKey, days) ?? todayKey;
}

/**
 * The inline error for the dates step ('' when they are fine). Plain words,
 * inline text rather than an alert — the browser preview has no alerts.
 */
export function wizardDateError(startDate: string, endDate: string): string {
  if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
    return 'Dates need to be real calendar days, written as YYYY-MM-DD.';
  }
  if (endDate < startDate) return 'The end date can’t be before the start date.';
  return '';
}

/** How the pass will read once created, in plain words (never a warning). */
export function wizardDatesStatusLine(
  startDate: string,
  endDate: string,
  todayKey: string,
): string {
  if (wizardDateError(startDate, endDate)) return '';
  const status = carePassStatus({ endDate, status: 'active' }, todayKey);
  if (status === 'expired') {
    return 'Those days have already passed, so the pass will read as Expired — it stays on your device either way.';
  }
  if (startDate > todayKey) {
    return `It starts on ${startDate} and reads as Active from then until ${endDate}.`;
  }
  return `It reads as Active right now, until ${endDate}.`;
}

/* ------------------------------------------------------------- validation -- */

/** The one real check: what the model cannot store a pass without. */
export interface CarePassWizardProblem {
  /** The step the owner has to fix, so the screen can offer to jump there. */
  step: CarePassWizardStepId;
  message: string;
}

/**
 * What still has to be filled in before the pass can be created — the caregiver
 * and a real date range, plus at least one pet. Returns null when it is ready.
 */
export function wizardCreateProblem(state: CarePassWizardState): CarePassWizardProblem | null {
  if (state.selectedPetIds.length === 0) {
    return { step: 'pets', message: 'Pick at least one pet for this pass.' };
  }
  if (!state.caregiverName.trim()) {
    return {
      step: 'caregiver',
      message: 'Add the name of the person looking after your pets.',
    };
  }
  const dateError = wizardDateError(state.startDate, state.endDate);
  if (dateError) return { step: 'dates', message: dateError };
  if (state.visibleSections.length === 0) {
    return {
      step: 'review',
      message: 'Pick at least one care section, or the pass shows nothing.',
    };
  }
  return null;
}

/** The soft nudge the caregiver step shows when the box is still empty. */
export function wizardCaregiverNudge(state: CarePassWizardState): string {
  return state.caregiverName.trim()
    ? ''
    : 'You can leave this for now and go on — the pass needs a name before you create it.';
}

/* --------------------------------------------------------------- capture -- */

/** One pet's snapshot with the notes the wizard collected (blanks dropped). */
export function snapshotFromWizardNotes(
  pet: Pet,
  notes: CarePassWizardPetNotes,
): CarePassPetSnapshot {
  const contacts: CarePassContact[] = [];
  for (const role of CARE_PASS_CONTACT_ROLES) {
    const draft = notes.contacts[role];
    const name = cleanCarePassText(draft?.name, 120);
    const phone = cleanCarePassText(draft?.phone, 40);
    if (!name && !phone) continue;
    contacts.push({ role, ...(name ? { name } : {}), ...(phone ? { phone } : {}) });
  }
  const feedingNote = cleanCarePassText(notes.feeding);
  const medicationNote = cleanCarePassText(notes.medications);
  const careNote = cleanCarePassText(notes.care);
  const microchip = cleanCarePassText(notes.microchip, 60);
  const allergies = cleanCarePassText(notes.allergies);
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    customSpecies: pet.customSpecies?.trim() || undefined,
    photoUri: pet.photoUri,
    ...(feedingNote ? { feedingNote } : {}),
    ...(medicationNote ? { medicationNote } : {}),
    ...(careNote ? { careNote } : {}),
    ...(contacts.length > 0 ? { contacts } : {}),
    ...(microchip ? { microchip } : {}),
    ...(allergies ? { allergies } : {}),
  };
}

/** The pets the wizard covers, with their notes — for the pass's snapshots. */
export function wizardSnapshots(
  state: CarePassWizardState,
  pets: readonly Pet[],
): CarePassPetSnapshot[] {
  return wizardSelectedPets(state, pets).map((pet) =>
    snapshotFromWizardNotes(pet, wizardPetNotes(state, pet.id)),
  );
}

/**
 * The pass the wizard creates. The owner's own name falls back to the name the
 * caregiver box holds when the owner left their own blank (the same default the
 * compact create form uses), and the sections are stored in canonical order so
 * two equal selections compare equal.
 */
export function wizardPassInput(
  state: CarePassWizardState,
  pets: readonly Pet[],
): CarePassInput {
  const ownerName = state.creatorName.trim() || state.caregiverName.trim();
  const householdNote = cleanCarePassText(state.householdNote);
  const snapshots = wizardSnapshots(state, pets);
  return {
    creatorName: ownerName,
    caregiverName: state.caregiverName.trim(),
    selectedPetIds: wizardSelectedPets(state, pets).map((pet) => pet.id),
    startDate: state.startDate,
    endDate: state.endDate,
    permissionLevel: state.permissionLevel,
    visibleSections: CARE_PASS_SECTIONS.filter((section) =>
      state.visibleSections.includes(section),
    ),
    petSnapshots: snapshots,
    ...(householdNote ? { householdNote } : {}),
  };
}

/* ---------------------------------------------------------------- review -- */

/** One "Label ..... value" row in the review. */
export interface CarePassReviewRow {
  label: string;
  value: string;
}

/** One titled block of the review, with an optional honest footnote. */
export interface CarePassReviewBlock {
  title: string;
  emoji: string;
  rows: CarePassReviewRow[];
  /** Shown when the block has no rows at all (never a silent empty block). */
  empty?: string;
}

/** A contact draft as one readable line, or '' when both boxes are blank. */
export function contactDraftLine(draft: CarePassWizardContactDraft | undefined): string {
  const name = draft?.name.trim() ?? '';
  const phone = draft?.phone.trim() ?? '';
  if (!name && !phone) return '';
  return [name, phone].filter((part) => part !== '').join(' · ');
}

/**
 * The full summary the last step shows before "Create & share" — the pass, each
 * pet's notes and the household note, in the order the wizard collected them.
 * A pet with nothing written gets an honest empty line instead of a blank block.
 */
export function wizardReview(
  state: CarePassWizardState,
  pets: readonly Pet[],
  options: { todayKey: string; permissionLabel: (level: CarePassPermissionLevel) => string },
): CarePassReviewBlock[] {
  const selected = wizardSelectedPets(state, pets);
  const blocks: CarePassReviewBlock[] = [];

  blocks.push({
    title: 'The pass',
    emoji: '🧳',
    rows: [
      { label: 'Pet parent', value: state.creatorName.trim() || '—' },
      { label: 'Caregiver', value: state.caregiverName.trim() || 'Not named yet' },
      { label: 'Dates', value: `${state.startDate} → ${state.endDate}` },
      {
        label: 'Reads as',
        value: wizardDatesStatusLine(state.startDate, state.endDate, options.todayKey) || '—',
      },
      { label: 'Sitter may', value: options.permissionLabel(state.permissionLevel) },
      { label: 'Sections', value: `${state.visibleSections.length} of ${CARE_PASS_SECTIONS.length}` },
    ],
  });

  for (const pet of selected) {
    const notes = wizardPetNotes(state, pet.id);
    const rows: CarePassReviewRow[] = [];
    const feeding = cleanCarePassText(notes.feeding);
    if (feeding) rows.push({ label: 'Feeding', value: feeding });
    const medications = cleanCarePassText(notes.medications);
    if (medications) rows.push({ label: 'Medication', value: medications });
    const care = cleanCarePassText(notes.care);
    if (care) rows.push({ label: 'Care notes', value: care });
    for (const role of CARE_PASS_CONTACT_ROLES) {
      const line = contactDraftLine(notes.contacts[role]);
      if (line) {
        rows.push({
          label: role === 'co-parent' ? 'Co-parent' : role === 'vet' ? 'Vet' : role === 'owner' ? 'Pet parent' : 'Emergency vet',
          value: line,
        });
      }
    }
    const microchip = cleanCarePassText(notes.microchip, 60);
    if (microchip) rows.push({ label: 'Microchip', value: microchip });
    const allergies = cleanCarePassText(notes.allergies);
    if (allergies) rows.push({ label: 'Allergies', value: allergies });
    blocks.push({
      title: pet.name,
      emoji: '🐾',
      rows,
      empty: 'Nothing extra written for this pet — the pass carries their name and details.',
    });
  }

  const household = cleanCarePassText(state.householdNote);
  blocks.push({
    title: 'The house',
    emoji: '🏠',
    rows: household ? [{ label: 'Household note', value: household }] : [],
    empty: 'No household note — your sitter sees the pets, and no house instructions.',
  });

  return blocks;
}
