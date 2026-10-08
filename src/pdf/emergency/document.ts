/**
 * Emergency Pet Card pack — the document model.
 *
 * `buildEmergencyCardDeck()` turns the pets the owner picked into a plain,
 * serializable description of a pack of cards — two faces each (front and
 * back), every line traceable to something already on the device. It is
 * deliberately dumb and pure: no React, no storage, no platform module, so the
 * same function can be exercised in Node against fixtures and both renderers
 * (the on-screen card and the print HTML) read the same object.
 *
 * Where every line comes from (nothing is invented, ever):
 *  - name, species, breed, birthdate (age), weight, photo — the pet's own
 *    profile (`Pet`);
 *  - current medications — the pet's active `Medication` records;
 *  - the primary vet — the pet's own latest visit record (name and clinic),
 *    falling back to nothing at all;
 *  - behaviour notes — the pet's own care instructions (fears, triggers,
 *    strangers, escape tendencies), plus an optional line the owner typed;
 *  - the owner's name — Settings; the owner's and co-parent's phone numbers, the
 *    vet's number, the emergency vet, the microchip number and the allergies /
 *    conditions line — the card details the owner fills in once on the card
 *    screen and that are stored on this device (see ../../storage/emergencyDetails).
 *
 * The app keeps no medical-condition field and no microchip field of its own, so
 * those lines print the owner's own words when they have given them and stay
 * blank otherwise. A blank line is honest; a guessed one would not be. The same
 * goes for a missing phone number: the card shows "—", never a made-up digit.
 *
 * 100% offline: pure functions over local state. No fetch, no server, no AI.
 */
import type { CareInstructions, Medication, Pet, VetRecord } from '../../types';
import { medicationScheduleLabel } from '../../types';
import { petAgeLabel, petSpeciesLabel, petWeightLabel } from '../../utils/petDisplay';
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  CARDS_PER_SHEET,
  emergencySheetDef,
  type EmergencyCardPaper,
  type EmergencySheetDef,
} from './card';
import { emergencyQr, emergencyQrPayload, type EmergencyQr } from './qr';

/** What a missing value looks like on a card — never an empty gap or "undefined". */
export const CARD_BLANK = '—';

/**
 * The card details only the owner can supply: the app stores no phone numbers,
 * no microchip field and no allergy field, so these are typed once on the card
 * screen (in their own words) and kept on this device.
 */
export interface EmergencyCardExtras {
  /** The owner's phone number. */
  ownerPhone?: string;
  /** The co-parent's name. */
  coParentName?: string;
  /** The co-parent's phone number. */
  coParentPhone?: string;
  /** The normal vet's phone number (the name usually comes from the records). */
  vetPhone?: string;
  /** The normal vet's name, when the owner wants to set it themselves. */
  vetName?: string;
  /** The emergency / out-of-hours vet's name. */
  emergencyVetName?: string;
  /** The emergency / out-of-hours vet's phone number. */
  emergencyVetPhone?: string;
  /** The pet's microchip number, as printed on the chip paperwork. */
  microchip?: string;
  /** Allergies and medical conditions, in the owner's own words. */
  allergies?: string;
  /** A behaviour note for whoever finds the pet, in the owner's own words. */
  behaviorNote?: string;
}

/** The owner's card details, keyed by pet id. */
export type EmergencyExtrasByPet = Record<string, EmergencyCardExtras>;

/** What the owner chose on the card screen. */
export interface EmergencyCardConfig {
  /** The pets getting a card, in the order the pack prints them. */
  petIds: string[];
  /** How the pack is laid out on paper. */
  paper: EmergencyCardPaper;
  /** The card details the owner typed, keyed by pet id. */
  extras: EmergencyExtrasByPet;
  /**
   * Each pet's photo, already resolved by the caller into a URI the renderer can
   * load (a `data:` URI on a device, the picked URI in a browser). A pet with no
   * photo — or one that could not be read — is keyed to null, and its card
   * prints the illustrated initial instead.
   */
  photos: Record<string, string | null>;
}

/** Everything the cards are built from — the app's own stores, gathered. */
export interface EmergencyCardSource {
  pets: Pet[];
  medications: Medication[];
  vetRecords: VetRecord[];
  careInstructions: CareInstructions[];
  /** The owner's own name from Settings. */
  ownerName: string;
}

/** One contact block on the back of a card. */
export interface EmergencyContact {
  /** The block's heading, e.g. "PRIMARY VET". */
  label: string;
  /** Who to speak to, or CARD_BLANK. */
  name: string;
  /** The number to call, or CARD_BLANK. */
  phone: string;
  /** A second line under the name (the clinic, when it differs), or ''. */
  detail: string;
}

/** One finished card: everything both faces print, plus its QR code. */
export interface EmergencyCard {
  petId: string;
  /** The pet's name, as the owner typed it. */
  petName: string;
  /** The single letter the photo plate shows when there is no photo. */
  initial: string;
  /** The photo the renderer should load, or null. */
  photo: string | null;
  /** "DOG · Border collie" — the species line. */
  speciesLine: string;
  /** "9 yr · 12 kg" — the facts line ('' when neither is on file). */
  factsLine: string;
  /** "CHIP 981020001234567", or '' when none has been typed. */
  microchip: string;
  /** The alert chips shown on the front, in priority order (may be empty). */
  alerts: string[];
  /** The honest line the front shows instead of chips when there are none. */
  alertsNote: string;
  /** The "if found" instruction line on the front. */
  ifFound: string;
  /** The four contact blocks on the back (vet, emergency vet, owner, co-parent). */
  contacts: EmergencyContact[];
  /** The pet's current medications, one line each (may be empty). */
  medications: string[];
  /** The honest line the back shows instead of a medication list when empty. */
  medsNote: string;
  /** Behaviour lines for whoever finds the pet (may be empty). */
  notes: string[];
  /** The honest line the back shows instead of notes when there are none. */
  notesNote: string;
  /** What is still missing, in the owner's words — shown on the screen, never printed. */
  missing: string[];
  /** The plain-text summary the QR encodes (ASCII only, no URL). */
  qrPayload: string;
  /** The encoded QR matrix, or null when there is nothing to encode. */
  qr: EmergencyQr | null;
}

/** One side of one card — what a page (or a sheet slot) carries. */
export interface EmergencyCardFace {
  card: EmergencyCard;
  kind: 'front' | 'back';
  /** The caption under the card on a sheet, e.g. "Bella · front". */
  label: string;
}

/** The finished pack, ready to be drawn or printed. */
export interface EmergencyCardDeck {
  cards: EmergencyCard[];
  /** Front and back for every card, in print order. */
  faces: EmergencyCardFace[];
  paper: EmergencyCardPaper;
  sheet: EmergencySheetDef;
  /** Faces per page: 1 in card mode, 8 on a Letter/A4 sheet. */
  perSheet: number;
  /** How many pages the pack prints on. */
  sheets: number;
  /** The document title (also the browser frame's `<title>`). */
  title: string;
  /** An honest one-line description of the pack: size, scale and page count. */
  summary: string;
  /** The plain instruction that prints above a sheet ("print at 100%"), or ''. */
  printNote: string;
  /** The quiet line at the foot of the document. */
  footer: string;
}

/** The pets that can have a card — every pet can; this lists them in order. */
export function emergencyPets(pets: readonly Pet[], ids: readonly string[]): Pet[] {
  const wanted = new Set(ids);
  const chosen = pets.filter((pet) => wanted.has(pet.id));
  return chosen.length > 0 ? chosen : [];
}

/** The pet's own latest visit record, or null. Documents are not visits. */
function latestVisit(records: readonly VetRecord[], petId: string): VetRecord | null {
  const visits = records
    .filter((record) => record.petId === petId && (record.kind ?? 'visit') !== 'document')
    .slice()
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate));
  return visits[0] ?? null;
}

/** A trimmed string, or CARD_BLANK when there is nothing to show. */
function orBlank(value: string | undefined | null): string {
  const text = (value ?? '').trim();
  return text.length > 0 ? text : CARD_BLANK;
}

/** A trimmed string, or '' — for fields the layout should simply omit. */
function orEmpty(value: string | undefined | null): string {
  return (value ?? '').trim();
}

/** Cap a printed line so a hostile or runaway value cannot break the card. */
function cap(value: string, max: number): string {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The first letter (or digit) of a name, for the illustrated photo plate. */
export function cardInitial(name: string): string {
  const match = /[A-Za-z0-9]/.exec(name);
  return match ? match[0].toUpperCase() : '★';
}

/** A medication as one printed line: "Apoquel · 1 tablet · daily". */
export function medicationLine(med: Medication): string {
  return [orEmpty(med.name), orEmpty(med.dosage), medicationScheduleLabel(med)]
    .filter((part) => part.length > 0)
    .join(' · ');
}

/** The medication summary the QR carries: "Apoquel daily", or ''. */
function medicationQrSummary(meds: readonly Medication[]): string {
  if (meds.length === 0) return '';
  const names = meds.map((med) => orEmpty(med.name)).filter((name) => name.length > 0);
  if (names.length === 0) return '';
  const shown = names.slice(0, 2).join(' + ');
  const extra = names.length > 2 ? ` +${names.length - 2} more` : '';
  const first = meds[0];
  const rhythm =
    first.times.length > 0
      ? 'daily'
      : first.intervalDays > 0
        ? first.intervalDays === 1
          ? 'daily'
          : `every ${first.intervalDays} days`
        : '';
  return [shown + extra, rhythm].filter((part) => part.length > 0).join(' ');
}

/** One care-instruction value as "Label: value", or null when it is blank. */
function careLine(
  instructions: CareInstructions | undefined,
  key: keyof CareInstructions,
  label: string,
): string | null {
  const value = instructions ? orEmpty(String(instructions[key] ?? '')) : '';
  return value.length > 0 ? cap(`${label}: ${value}`, 120) : null;
}

/** Build one pet's card from the gathered stores. */
export function buildEmergencyCard(
  source: EmergencyCardSource,
  pet: Pet,
  extras: EmergencyCardExtras,
  photo: string | null,
): EmergencyCard {
  const petName = orEmpty(pet.name) || 'Your pet';
  const speciesLabel = petSpeciesLabel(pet);
  const breed = orEmpty(pet.breed);
  const age = petAgeLabel(pet);
  const weight = petWeightLabel(pet);
  const microchip = orEmpty(extras.microchip);

  const petMeds = source.medications.filter((med) => med.petId === pet.id && med.active);
  const medLines = petMeds.map(medicationLine).filter((line) => line.length > 0);
  const vet = latestVisit(source.vetRecords, pet.id);
  const recordVetName = orEmpty(vet?.veterinarian) || orEmpty(vet?.clinicName);
  const vetName = orEmpty(extras.vetName) || recordVetName;
  const vetDetail =
    vet?.clinicName && orEmpty(vet.clinicName) !== vetName ? orEmpty(vet.clinicName) : '';
  const vetPhone = orEmpty(extras.vetPhone);
  const emergencyVetName = orEmpty(extras.emergencyVetName);
  const emergencyVetPhone = orEmpty(extras.emergencyVetPhone);
  const ownerName = orEmpty(source.ownerName) || 'Pet Parent';
  const ownerPhone = orEmpty(extras.ownerPhone);
  const coParentName = orEmpty(extras.coParentName);
  const coParentPhone = orEmpty(extras.coParentPhone);
  const allergies = orEmpty(extras.allergies);

  const instructions = source.careInstructions.find((record) => record.petId === pet.id);

  /* ---- the front's alert chips ---- */
  const alerts: string[] = [];
  if (allergies) alerts.push(`ALLERGIC: ${cap(allergies, 60).toUpperCase()}`);
  const medNames = petMeds
    .map((med) => orEmpty(med.name))
    .filter((name) => name.length > 0)
    .slice(0, 2)
    .join(' + ');
  if (medNames) alerts.push(`NEEDS MEDS: ${medNames.toUpperCase()}`);

  /* ---- the back's behaviour lines: the owner's own note first ---- */
  const notes: string[] = [];
  const typedNote = orEmpty(extras.behaviorNote);
  if (typedNote) notes.push(cap(typedNote, 120));
  for (const line of [
    careLine(instructions, 'strangerBehavior', 'With strangers'),
    careLine(instructions, 'triggers', 'Triggers'),
    careLine(instructions, 'fears', 'Fears'),
    careLine(instructions, 'escapeTendencies', 'Escape tendencies'),
    careLine(instructions, 'quirks', 'Quirks'),
  ]) {
    if (line && notes.length < 3) notes.push(line);
  }

  /* ---- what is still missing (the screen shows this, the card never does) ---- */
  const missing: string[] = [];
  if (!photo) missing.push('a photo');
  if (!vetPhone) missing.push('the vet’s phone number');
  if (!ownerPhone) missing.push('your phone number');
  if (!emergencyVetName && !emergencyVetPhone) missing.push('an emergency vet');
  if (!microchip) missing.push('the microchip number');
  if (!allergies) missing.push('allergies or conditions');
  if (!coParentName && !coParentPhone) missing.push('a co-parent contact');
  if (petMeds.length === 0) missing.push('current medications');
  if (!pet.birthdate) missing.push('a birthdate (for their age)');
  if (typeof pet.weight !== 'number') missing.push('a weight');
  if (!breed) missing.push('a breed');

  const qrInput = {
    petName,
    species: speciesLabel,
    breed,
    age,
    weight,
    microchip,
    allergies,
    meds: medicationQrSummary(petMeds),
    vetName,
    vetPhone,
    ownerName,
    ownerPhone,
    coParentName,
    coParentPhone,
    note: notes[0] ?? '',
  };
  const qrPayload = emergencyQrPayload(qrInput);

  return {
    petId: pet.id,
    petName,
    initial: cardInitial(petName),
    photo,
    speciesLine: [speciesLabel.toUpperCase(), breed.toUpperCase()].filter(Boolean).join(' · '),
    factsLine: [age, weight].filter((part) => part.length > 0).join(' · '),
    microchip: microchip ? `CHIP ${microchip}` : '',
    alerts: alerts.slice(0, 3),
    alertsNote:
      alerts.length === 0
        ? 'No allergies or medications are recorded on this phone.'
        : '',
    ifFound: `Please call the numbers on the back first — thank you for keeping ${petName} safe.`,
    contacts: [
      {
        label: 'PRIMARY VET',
        name: vetName || CARD_BLANK,
        phone: vetPhone || CARD_BLANK,
        detail: vetDetail,
      },
      {
        label: 'EMERGENCY VET',
        name: emergencyVetName || CARD_BLANK,
        phone: emergencyVetPhone || CARD_BLANK,
        detail: '',
      },
      { label: 'OWNER', name: ownerName, phone: ownerPhone || CARD_BLANK, detail: '' },
      {
        label: 'CO-PARENT',
        name: coParentName || CARD_BLANK,
        phone: coParentPhone || CARD_BLANK,
        detail: '',
      },
    ],
    medications: medLines.slice(0, 3),
    medsNote:
      medLines.length === 0 ? 'No current medications are recorded on this phone.' : '',
    notes: notes.slice(0, 3),
    notesNote:
      notes.length === 0 ? 'Nothing has been written about their behaviour yet.' : '',
    missing,
    qrPayload,
    qr: emergencyQr(qrPayload),
  };
}

/** How many extra medication lines a card left off ("+2 more"). */
function extraMedCount(card: EmergencyCard): number {
  return Math.max(0, card.medications.length - 3);
}

/** Build the whole pack for a configuration. Deterministic. */
export function buildEmergencyCardDeck(
  source: EmergencyCardSource,
  config: EmergencyCardConfig,
): EmergencyCardDeck {
  const paper: EmergencyCardPaper = emergencySheetDef(config.paper).id;
  const sheet = emergencySheetDef(paper);
  const pets = emergencyPets(source.pets, config.petIds);
  const cards = pets.map((pet) =>
    buildEmergencyCard(
      source,
      pet,
      config.extras[pet.id] ?? {},
      config.photos[pet.id] ?? null,
    ),
  );

  const faces: EmergencyCardFace[] = [];
  for (const card of cards) {
    faces.push({ card, kind: 'front', label: `${card.petName} · front` });
    faces.push({ card, kind: 'back', label: `${card.petName} · back` });
  }

  const perSheet = paper === 'card' ? 1 : CARDS_PER_SHEET;
  const sheets = faces.length === 0 ? 0 : Math.ceil(faces.length / perSheet);
  const cardWord = cards.length === 1 ? 'card' : 'cards';
  const faceWord = faces.length === 1 ? 'face' : 'faces';
  const pageWord = sheets === 1 ? 'page' : 'pages';

  const summary =
    cards.length === 0
      ? 'No pets picked yet — choose whose cards you need.'
      : paper === 'card'
        ? `${cards.length} ${cardWord} · ${faces.length} card ${faceWord} · ${sheets} ${pageWord}, each page exactly ${CARD_WIDTH_MM} × ${CARD_HEIGHT_MM} mm (ID-1, the size of a bank card) and printed at 100% — no scaling.`
        : `${cards.length} ${cardWord} · ${faces.length} card ${faceWord} · ${sheets} ${sheet.short} ${sheets === 1 ? 'sheet' : 'sheets'} — up to ${CARDS_PER_SHEET} cards per sheet, every card exactly ${CARD_WIDTH_MM} × ${CARD_HEIGHT_MM} mm at 100% scale, cut along the corner marks.`;

  return {
    cards,
    faces,
    paper,
    sheet,
    perSheet,
    sheets,
    title:
      cards.length === 0
        ? 'Emergency pet cards'
        : cards.length === 1
          ? `${cards[0].petName} · emergency card`
          : `${cards.map((card) => card.petName).join(' & ')} · emergency cards`,
    summary,
    printNote:
      paper === 'card'
        ? `Each page is exactly ${CARD_WIDTH_MM} × ${CARD_HEIGHT_MM} mm (ID-1). Print at 100% — do not scale to fit — on card stock, then laminate or trim.`
        : `Print at 100% — do not scale to fit. Every card is ${CARD_WIDTH_MM} × ${CARD_HEIGHT_MM} mm (ID-1); cut along the corner marks.`,
    footer:
      'Made on this device from your own records — nothing is uploaded, and the app has no server to send it to.',
  };
}

/**
 * The line under the medication list when a card had to stop at three lines:
 * "+2 more medications are on file in the app." — or '' when nothing was cut.
 */
export function extraMedicationsNote(card: EmergencyCard): string {
  const extra = extraMedCount(card);
  return extra === 0
    ? ''
    : `+${extra} more ${extra === 1 ? 'medication' : 'medications'} on file in the app.`;
}
