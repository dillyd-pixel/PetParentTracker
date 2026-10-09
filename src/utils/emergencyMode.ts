/**
 * Emergency Mode — the pure core (Sitter Mode, unit 3 of 3).
 *
 * One pet, one screen, everything a person needs in the first minute of a scare:
 * who the pet is, what they are allergic to, what they are on, the chip number,
 * the vet — and a Call button beside every number that actually exists. This
 * module is the whole of the thinking; `EmergencyScreen` only draws it.
 *
 * It is deliberately dumb and pure (no React, no storage, no platform module)
 * for two reasons: the same object can be exercised in Node against fixtures
 * (see /home/team/shared/emergency-mode-verification/), and every line on the
 * screen is traceable to something already stored on the device.
 *
 * Where every line comes from — nothing is invented, ever:
 *  - name, species, breed, photo — the pet's own profile (`Pet`);
 *  - age — `pet.birthdate`, counted against today;
 *  - weight — `pet.weight` (the app's only weigh-in), with the day it was
 *    recorded when the owner's build stored one;
 *  - allergies & conditions, the microchip number, the owner's and co-parent's
 *    names and numbers, the vet's name and number, the emergency vet and the
 *    behaviour note — the card details the owner typed once on the Emergency
 *    Card screen (`EmergencyCardExtras`, the SAME store the printed card uses,
 *    read through `storage/emergencyDetails`);
 *  - current medications — the pet's own ACTIVE `Medication` records;
 *  - the primary vet's name, when the card details have none — the vet or clinic
 *    named on the pet's latest visit record;
 *  - the owner's name — Settings.
 *
 * Two rules the copy and the code keep:
 *  - a field with nothing stored shows `EMERGENCY_BLANK` ("Not on file"), never
 *    "undefined", never "NaN" and never a guess;
 *  - a Call button exists only when a callable number was stored
 *    (`phoneCallHref` needs at least `EMERGENCY_MIN_DIGITS` digits), so a blank
 *    or nonsense phone line can never offer a dead button.
 *
 * Hostile input: every owner-typed value goes through `emergencyText()` on the
 * way into the profile — control characters and line breaks are flattened,
 * whitespace collapsed, runaway lengths capped. Values are only ever rendered
 * as text children of a `<Text>` node, so a stored `<script>` is a visible
 * string on the screen and never markup. The harness asserts both.
 *
 * 100% offline: pure functions over local state. No fetch, no server, no AI.
 */
import type { CareInstructions, Medication, Pet, VetRecord } from '../types';
import { medicationScheduleLabel } from '../types';
import type { EmergencyCardExtras } from '../pdf/emergency/document';
import { petAgeLabel, petEmojiFor, petSpeciesLabel, shortDate } from './petDisplay';

/** What a missing value looks like everywhere in Emergency Mode. */
export const EMERGENCY_BLANK = 'Not on file';

/** The longest an owner-typed value may be on this screen (ellipsised past it). */
export const EMERGENCY_MAX_VALUE = 160;

/** The longest a phone line may be before it is capped. */
export const EMERGENCY_MAX_PHONE = 40;

/**
 * How many digits a stored phone line needs before it earns a Call button.
 * Three is deliberate: it keeps short-but-real emergency numbers ("112", "911")
 * callable while a stray "-", a lone "n/a" or a hostile string earns nothing.
 */
export const EMERGENCY_MIN_DIGITS = 3;

/* ------------------------------------------------------------------ test ids -- */

/** The testIDs the call buttons carry (one per role, stable for the walk). */
export const EMERGENCY_CALL_TESTID = {
  owner: 'emergency-call-owner',
  coParent: 'emergency-call-co-parent',
  vet: 'emergency-call-vet',
  emergencyVet: 'emergency-call-emergency-vet',
} as const;

/** Who a Call button reaches. */
export type EmergencyCallRole = keyof typeof EMERGENCY_CALL_TESTID;

/** The back link on the emergency screen. */
export const EMERGENCY_BACK_TESTID = 'emergency-back';

/** The pet picker entry for one pet, e.g. `emergency-pet-pet-bella`. */
export function emergencyPetTestId(petId: string): string {
  return `emergency-pet-${petId}`;
}

/* ------------------------------------------------------------- sanitising -- */

/**
 * Tidy an owner-typed (or hand-edited-storage) value into what the screen may
 * show: control characters — including newlines, tabs and NUL — flattened to
 * spaces, whitespace collapsed, trimmed, and anything past `max` cut off with an
 * ellipsis. A non-string (a number, an object, `undefined`) is simply "".
 *
 * This is the ONLY door owner text comes through, so no stored value can break
 * the layout, smuggle a line break into a label, or arrive as "undefined".
 */
export function emergencyText(value: unknown, max: number = EMERGENCY_MAX_VALUE): string {
  if (typeof value !== 'string') return '';
  const flat = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (flat.length === 0) return '';
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** The digits inside a stored phone line, in order ('' when there are none). */
export function phoneDigits(value: unknown): string {
  return emergencyText(value, EMERGENCY_MAX_PHONE).replace(/[^\d]/g, '');
}

/** The phone line exactly as the owner typed it (sanitised), or ''. */
export function phoneDisplay(value: unknown): string {
  return emergencyText(value, EMERGENCY_MAX_PHONE);
}

/**
 * The `tel:` URL for a stored phone line, or null when there is nothing worth
 * dialling. A leading "+" is kept so an international number dials correctly;
 * every other separator the owner typed (spaces, dashes, brackets, dots) is
 * dropped, which is what a dialler wants.
 */
export function phoneCallHref(value: unknown): string | null {
  const display = phoneDisplay(value);
  const digits = phoneDigits(display);
  if (digits.length < EMERGENCY_MIN_DIGITS) return null;
  return display.startsWith('+') ? `tel:+${digits}` : `tel:${digits}`;
}

/** A value, or `EMERGENCY_BLANK` — the one place the placeholder is chosen. */
export function orBlank(value: unknown, max: number = EMERGENCY_MAX_VALUE): string {
  const text = emergencyText(value, max);
  return text.length > 0 ? text : EMERGENCY_BLANK;
}

/**
 * The lines an emergency sheet actually wants, in the order they are worth
 * filling in. `missing` on the profile is built from exactly this list, so the
 * "still to add" card and the sheet itself can never disagree about what is
 * absent — and the count on it is honest arithmetic, not a feeling.
 */
export const EMERGENCY_TRACKED_LINES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'allergies', label: 'allergies & conditions' },
  { id: 'microchip', label: 'microchip number' },
  { id: 'emergencyVet', label: 'an emergency vet' },
  { id: 'vetPhone', label: "the vet's phone number" },
  { id: 'ownerPhone', label: "the pet parent's phone number" },
  { id: 'coParentPhone', label: "a second pet parent's phone number" },
];

/* ------------------------------------------------------------------- model -- */

/** One line of the emergency sheet: a label, its value and whether it is blank. */
export interface EmergencyRow {
  /** A stable slug for the row (also its on-screen `testID`, `emergency-fact-<key>`). */
  key: 'allergies' | 'microchip';
  label: string;
  value: string;
  /** True when nothing is stored — the value is `EMERGENCY_BLANK`. */
  blank: boolean;
}

/** A Call button: the number, where it dials, and what it says. */
export interface EmergencyCallTarget {
  role: EmergencyCallRole;
  /** Button text, e.g. "Call the vet". */
  label: string;
  /** Who the button reaches, e.g. "Dr Okafor · Main Street Animal Hospital". */
  who: string;
  /** The number as the owner typed it. */
  phone: string;
  /** The `tel:` URL — the only thing the button does. */
  href: string;
  testID: string;
}

/** One contact block: who they are, and the Call button when there is a number. */
export interface EmergencyContactBlock {
  role: EmergencyCallRole;
  /** The block's heading, e.g. "Emergency vet". */
  label: string;
  /** The person's or practice's name, or `EMERGENCY_BLANK`. */
  name: string;
  /** A second line under the name (the clinic, when it differs), or ''. */
  detail: string;
  /** The number as typed, or `EMERGENCY_BLANK`. */
  phone: string;
  /** True when nothing at all is stored for this contact. */
  blank: boolean;
  /** The Call button, or null when there is no callable number. */
  call: EmergencyCallTarget | null;
}

/** Everything the emergency screen draws for one pet. */
export interface EmergencyProfile {
  petId: string;
  petName: string;
  /** The pet's animal glyph (the app bundles no photos of its own). */
  emoji: string;
  /** The pet's own photo URI, or '' — the screen falls back to the glyph. */
  photoUri: string;
  /** "Dog · Border collie". */
  speciesLine: string;
  /** "6 yr 6 mo", or '' when no birthdate is on file. */
  ageLabel: string;
  /** "12 kg", or '' when no weight is on file. */
  weightLabel: string;
  /** "last weigh-in 3 Aug 2026", or '' — never a guessed date. */
  weightNote: string;
  /** Allergies & conditions, and the microchip number. */
  facts: EmergencyRow[];
  /** The pet's active medications, one line each ([] when there are none). */
  medications: string[];
  /** The honest line shown instead of a medication list when there are none. */
  medsNote: string;
  /** The behaviour note for whoever finds the pet, or ''. */
  behaviour: string;
  /** How the pet is with strangers — from the pet's care notes, or ''. */
  withStrangers: string;
  /** Who to call, in the order the screen draws them (always all four). */
  contacts: EmergencyContactBlock[];
  /** The Call buttons that actually exist, emergency vet first. */
  calls: EmergencyCallTarget[];
  /** The field labels still to add, in the screen's own words (may be empty). */
  missing: string[];
  /** The warm one-liner at the top, e.g. "If Bella ever needs urgent care…". */
  headline: string;
  /** "5 of 8 lines on file — the rest say Not on file." */
  readyLine: string;
}

/** The app's own stores, gathered for one pet. */
export interface EmergencyProfileInput {
  pet: Pet;
  /** The owner's own name from Settings. */
  ownerName: string;
  /** The card details typed once on the Emergency Card screen. */
  extras: EmergencyCardExtras | undefined | null;
  /** Every medication on the device (filtered here to this pet's active ones). */
  medications: readonly Medication[];
  /** Every vet record on the device (read for the primary vet's name). */
  vetRecords: readonly VetRecord[];
  /** The pet's care notes, when the owner has written any. */
  careInstructions?: CareInstructions | null;
  /** Today, for the age line (injected so the harness can pin it). */
  today?: Date;
}

/** A medication as one line: "Carprofen · 1 tablet · 1× daily · 08:00". */
export function emergencyMedicationLine(med: Medication): string {
  const name = emergencyText(med.name, 60);
  const dosage = emergencyText(med.dosage, 40);
  const schedule = medicationScheduleLabel(med);
  return [name, dosage, schedule].filter((part) => part.length > 0).join(' · ');
}

/** The pet's own latest visit that was a real visit (a document is not one). */
function latestVisit(records: readonly VetRecord[], petId: string): VetRecord | null {
  const visits = records
    .filter((record) => record.petId === petId && (record.kind ?? 'visit') !== 'document')
    .slice()
    .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
  return visits[0] ?? null;
}

/** Build one Call button, or null when the stored number is not callable. */
function callTarget(
  role: EmergencyCallRole,
  label: string,
  who: string,
  rawPhone: unknown,
): EmergencyCallTarget | null {
  const href = phoneCallHref(rawPhone);
  if (!href) return null;
  return {
    role,
    label,
    who: emergencyText(who, 80),
    phone: phoneDisplay(rawPhone),
    href,
    testID: EMERGENCY_CALL_TESTID[role],
  };
}

/** One contact block: the values as stored, the blank flag, and its Call button. */
function contactBlock(
  role: EmergencyCallRole,
  label: string,
  rawName: unknown,
  rawDetail: unknown,
  rawPhone: unknown,
  callLabel: string,
): EmergencyContactBlock {
  const name = emergencyText(rawName, 80);
  const detail = emergencyText(rawDetail, 80);
  const phone = phoneDisplay(rawPhone);
  const who = [name, detail].filter((part) => part.length > 0).join(' · ');
  return {
    role,
    label,
    name: name.length > 0 ? name : EMERGENCY_BLANK,
    detail,
    phone: phone.length > 0 ? phone : EMERGENCY_BLANK,
    blank: name.length === 0 && detail.length === 0 && phone.length === 0,
    call: callTarget(role, callLabel, who, rawPhone),
  };
}

/**
 * Build the whole emergency sheet for one pet from the app's own stores.
 *
 * Ordering matters here: the Call buttons come out emergency vet → primary vet →
 * the pet parent → the second pet parent, because that is the order a person
 * reaching for the phone in a hurry wants them.
 */
export function buildEmergencyProfile(input: EmergencyProfileInput): EmergencyProfile {
  const { pet, ownerName, extras, medications, vetRecords, careInstructions } = input;
  const today = input.today ?? new Date();

  const petName = emergencyText(pet.name, 60) || 'Your pet';
  const breed = emergencyText(pet.breed, 60);
  const speciesLine = [petSpeciesLabel(pet), breed]
    .filter((part) => part.length > 0)
    .join(' · ');

  const ageLabel = petAgeLabel(pet, today);
  const weightLabel =
    typeof pet.weight === 'number' && Number.isFinite(pet.weight)
      ? emergencyText(
          `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`,
          EMERGENCY_MAX_PHONE,
        )
      : '';
  const weighInDay = emergencyText(pet.weightUpdatedAt, 10);
  const weightNote =
    weightLabel.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(weighInDay)
      ? `last weigh-in ${shortDate(weighInDay)}`
      : '';

  const allergies = emergencyText(extras?.allergies);
  const microchip = emergencyText(extras?.microchip, 40);
  const behaviour = emergencyText(extras?.behaviorNote);
  const withStrangers = emergencyText(careInstructions?.strangerBehavior);

  const facts: EmergencyRow[] = [
    {
      key: 'allergies',
      label: 'Allergies & conditions',
      value: allergies.length > 0 ? allergies : EMERGENCY_BLANK,
      blank: allergies.length === 0,
    },
    {
      key: 'microchip',
      label: 'Microchip',
      value: microchip.length > 0 ? microchip : EMERGENCY_BLANK,
      blank: microchip.length === 0,
    },
  ];

  const petMeds = medications.filter((med) => med.petId === pet.id && med.active);
  const medLines = petMeds
    // A record with no name is not a medication anyone can act on, so it earns
    // no line here — the note below stays honest either way.
    .filter((med) => emergencyText(med.name, 60).length > 0)
    .map(emergencyMedicationLine);
  const medsNote =
    medLines.length === 0
      ? `No current medication is listed for ${petName} — nothing appears here on purpose.`
      : `${medLines.length} medication${medLines.length === 1 ? '' : 's'} on file, from ${petName}’s own records.`;

  /* ---- the four contacts, and the Call buttons that exist ---- */
  const vet = latestVisit(vetRecords, pet.id);
  const recordVetName = emergencyText(vet?.veterinarian, 80) || emergencyText(vet?.clinicName, 80);
  const vetName = emergencyText(extras?.vetName, 80) || recordVetName;
  const clinic = emergencyText(vet?.clinicName, 80);
  const vetDetail = clinic.length > 0 && clinic !== vetName ? clinic : '';

  const ownerLabel = emergencyText(ownerName, 60) || 'the pet parent';
  const coParentName = emergencyText(extras?.coParentName, 80);

  const contacts: EmergencyContactBlock[] = [
    contactBlock(
      'emergencyVet',
      'Emergency vet',
      extras?.emergencyVetName,
      '',
      extras?.emergencyVetPhone,
      'Call the emergency vet',
    ),
    contactBlock('vet', 'Primary vet', vetName, vetDetail, extras?.vetPhone, 'Call the vet'),
    contactBlock(
      'owner',
      'Pet parent',
      ownerLabel,
      '',
      extras?.ownerPhone,
      `Call ${ownerLabel}`,
    ),
    contactBlock(
      'coParent',
      'Second pet parent',
      coParentName,
      '',
      extras?.coParentPhone,
      coParentName.length > 0 ? `Call ${coParentName}` : 'Call the second pet parent',
    ),
  ];

  const calls = contacts
    .map((contact) => contact.call)
    .filter((call): call is EmergencyCallTarget => call !== null);

  /* ---- what is still to add, in the order it is worth filling in ---- */
  const satisfied = new Set<string>();
  if (allergies.length > 0) satisfied.add('allergies');
  if (microchip.length > 0) satisfied.add('microchip');
  if (contacts[0].call) satisfied.add('emergencyVet');
  if (contacts[1].call) satisfied.add('vetPhone');
  if (contacts[2].call) satisfied.add('ownerPhone');
  if (contacts[3].call) satisfied.add('coParentPhone');

  const missing = EMERGENCY_TRACKED_LINES.filter((line) => !satisfied.has(line.id)).map(
    (line) => line.label,
  );
  const onFile = EMERGENCY_TRACKED_LINES.length - missing.length;

  return {
    petId: pet.id,
    petName,
    emoji: petEmojiFor(pet),
    photoUri: typeof pet.photoUri === 'string' ? pet.photoUri : '',
    speciesLine: speciesLine.length > 0 ? speciesLine : EMERGENCY_BLANK,
    ageLabel,
    weightLabel,
    weightNote,
    facts,
    medications: medLines,
    medsNote,
    behaviour,
    withStrangers,
    contacts,
    calls,
    missing,
    headline: `If ${petName} ever needs urgent care, here’s everything at a glance — the numbers first, then the facts, all read straight off this device.`,
    readyLine:
      missing.length === 0
        ? `${onFile} of ${EMERGENCY_TRACKED_LINES.length} lines on file — the whole sheet is filled in.`
        : `${onFile} of ${EMERGENCY_TRACKED_LINES.length} lines on file · ${missing.length} still to add.`,
  };
}

/* ----------------------------------------------------------------- picking -- */

/**
 * The pets at the top of the emergency screen, in the app's own order.
 * Every live pet can have an emergency sheet — there is nothing to pick twice.
 */
export function emergencyPickablePets(pets: readonly Pet[]): Pet[] {
  return pets.slice();
}

/**
 * Which pet the screen opens on: the one asked for when it is a real pet,
 * otherwise the first pet. Null only when there are no pets at all.
 */
export function resolveEmergencyPet(pets: readonly Pet[], petId?: string | null): Pet | null {
  if (pets.length === 0) return null;
  const wanted = emergencyText(petId, 80);
  if (wanted.length > 0) {
    const match = pets.find((pet) => pet.id === wanted);
    if (match) return match;
  }
  return pets[0];
}

/** One selectable row in the pet picker. */
export interface EmergencyPetOption {
  petId: string;
  name: string;
  emoji: string;
  photoUri: string;
  selected: boolean;
  testID: string;
}

/** The picker rows for the given pets, with `selectedId` marked. */
export function emergencyPetOptions(
  pets: readonly Pet[],
  selectedId: string | null | undefined,
): EmergencyPetOption[] {
  return pets.map((pet) => ({
    petId: pet.id,
    name: emergencyText(pet.name, 60) || 'Your pet',
    emoji: petEmojiFor(pet),
    photoUri: typeof pet.photoUri === 'string' ? pet.photoUri : '',
    selected: pet.id === selectedId,
    testID: emergencyPetTestId(pet.id),
  }));
}

/** Whether the screen should show the picker at all (one pet needs no choosing). */
export function emergencyNeedsPicker(pets: readonly Pet[]): boolean {
  return pets.length > 1;
}
