/**
 * Printable care binder (HANDOFF, unit 3 of 3) — the document model and builder.
 *
 * `buildBinderDocument()` is a PURE function. It takes the owner's already
 * loaded on-device records (the very same stores every other screen reads) plus
 * the pets and paper size, and returns the printed care file: one chapter per
 * pet, each with the five binder sections (profile, health, records, costs,
 * care instructions).
 *
 * It deliberately reuses the Printable Pet Planner's engine rather than
 * inventing a second one:
 *  - the document shape IS `PlannerDocument` (same chapters/sections/blocks),
 *  - the blocks are built with the planner's own `empty`/`line`/`subheading`/
 *    `metaLine` helpers,
 *  - `../planner/html.buildPlannerHtml` renders it, `PlannerPaperView` draws the
 *    on-device preview, and `../planner/plannerFile` makes/prints/saves/shares
 *    the PDF with the same paper handling.
 * So the binder and the planner cannot drift apart in layout, paper size or
 * print behaviour — only their sections differ.
 *
 * Honesty rules baked in:
 *  - Nothing is invented. Every line comes from a stored record or the owner's
 *    own typed words. A fact with nothing stored prints the app's one
 *    placeholder, "Not on file" — never a blank block, a zero, or a demo value.
 *  - The app keeps ONE free-text line for allergies & conditions (the emergency
 *    card details), so that is what prints, labelled as such.
 *  - Current medication uses the Care Pass wizard's own active-today rule
 *    (`medicationOnPassToday`), so the binder and the pass agree exactly.
 *  - A passed appointment with no visit recorded after it is called out as
 *    something the app cannot know — never reported as a fact.
 *  - Costs are added up over stored, finite amounts only; an entry whose amount
 *    is missing/unusable is counted as left out, never silently zeroed.
 *  - Every read is guarded (`Array.isArray`, typeof checks), so hand-edited or
 *    corrupt storage can never throw here or print "undefined"/"NaN"/
 *    "[object Object]".
 *
 * 100% offline: pure computation over local arrays — no fetch, no URLs.
 */
import type {
  CareInstructions,
  Expense,
  FeedingSchedule,
  Medication,
  Pet,
  Vaccine,
  VetRecord,
} from '../../types';
import {
  careInstructionsGroupsWithContent,
  careInstructionValue,
  feedingDaysLabel,
  medicationScheduleLabel,
  vetRecordKind,
} from '../../types';
import { medicationOnPassToday } from '../../utils/carePassWizard';
import { EMERGENCY_BLANK } from '../../utils/emergencyMode';
import {
  petAgeLabel,
  petEmojiFor,
  petMetaLine,
  petSpeciesLabel,
  petWeightLabel,
  shortDate,
  todayISO,
} from '../../utils/petDisplay';
import {
  empty,
  line,
  metaLine,
  subheading,
  type PlannerBlock,
  type PlannerDocument,
  type PlannerKeyValue,
  type PlannerListItem,
} from '../planner/document';
import type { PaperSize } from '../planner/sections';
import type { EmergencyExtrasByPet } from '../emergency/document';
import { BINDER_SECTIONS, type BinderSectionDef, type BinderSectionId } from './sections';

/* ------------------------------------------------------------------ model ---- */

/**
 * The app's one placeholder for a fact that is not stored. Re-exported from the
 * Emergency Mode constant so the whole app keeps saying the same words.
 */
export const BINDER_BLANK = EMERGENCY_BLANK;

/**
 * The printed care file. It is the planner's document type, unchanged: one
 * renderer, one paper system, two products.
 */
export type BinderDocument = PlannerDocument;

/** Everything the builder reads — the owner's own stores, already loaded. */
export interface BinderSource {
  pets: Pet[];
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  /** Care-instruction records (one per pet, however many exist). */
  careInstructions: CareInstructions[];
  /** The owner's own name from Settings — the only "pet parent" fact stored. */
  ownerName: string;
  /** Per-pet emergency-card details: the microchip and the allergies/conditions line. */
  emergencyExtras: EmergencyExtrasByPet;
}

/** What the owner chose on the binder screen. */
export interface BinderConfig {
  /** The pets to include: one, several, or every pet in the household. */
  petIds: string[];
  paper: PaperSize;
}

/* --------------------------------------------------------------- guards ---- */

/**
 * A stored value as printable text: a string as typed (trimmed), a finite
 * number as its digits, and anything else as '' — so a hand-edited record can
 * never put "undefined", "NaN" or "[object Object]" on a printed page.
 */
function safeText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

/** A stored value as a usable number, or null when it is not really one. */
function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A stored collection as an array of records (never throws on junk storage). */
function safeArray<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is T => row != null && typeof row === 'object');
}

/** A stored value, or the app's one placeholder when nothing usable is there. */
function orBlank(value: string): string {
  return value.length > 0 ? value : BINDER_BLANK;
}

/** An ISO date printed as "9 Aug 2026", or the placeholder when unusable. */
function dateOrBlank(value: unknown): string {
  const text = safeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return BINDER_BLANK;
  return shortDate(text);
}

/** A pet's own id, guarded (an id is what every record is matched on). */
function petIdOf(pet: Pet): string {
  return safeText((pet as { id?: unknown }).id);
}

/* ------------------------------------------------------------- formatting ---- */

/** "photo on this device" — a local file never embeds in an offline print document. */
function photoNote(photoUri: unknown): string | undefined {
  return safeText(photoUri) ? 'photo on this device' : undefined;
}

/** Sort newest first by an ISO date-ish field (stable for equal dates). */
function byDateDesc<T>(rows: T[], pick: (row: T) => unknown): T[] {
  return [...rows].sort((a, b) => safeText(pick(b)).localeCompare(safeText(pick(a))));
}

/** Sort oldest first by an ISO date-ish field. */
function byDateAsc<T>(rows: T[], pick: (row: T) => unknown): T[] {
  return [...rows].sort((a, b) => safeText(pick(a)).localeCompare(safeText(pick(b))));
}

/** A whole-number share of the total, e.g. 42 → 42 (0 for a zero total). */
function percent(part: number, total: number): number {
  if (!Number.isFinite(total) || total === 0) return 0;
  return Math.round((part / total) * 100);
}

/** Blank write-in rows for a printed table (`rows` × `columns`). */
function blankRows(rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''));
}

/** One pet's records, filtered out of the whole-device collections. */
interface PetRecords {
  pet: Pet;
  petId: string;
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  instructions?: CareInstructions;
  extras: EmergencyExtrasByPet[string];
}

/** The typed card details for one pet, read defensively from the stored map. */
function extrasFor(all: unknown, petId: string): EmergencyExtrasByPet[string] {
  if (!all || typeof all !== 'object' || Array.isArray(all)) return {};
  const value = (all as Record<string, unknown>)[petId];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as EmergencyExtrasByPet[string];
}

/* -------------------------------------------------------------- sections ---- */

/** 🐾 Pet profile — the pet's own fields, the microchip, and the photo frame. */
function profileBlocks(rec: PetRecords, ownerName: string): PlannerBlock[] {
  const { pet, extras } = rec;
  const name = safeText(pet.name) || 'This pet';
  const age = petAgeLabel(pet);
  const weight = petWeightLabel(pet);
  const microchip = safeText(extras.microchip);
  const hasWeightDate = /^\d{4}-\d{2}-\d{2}$/.test(safeText(pet.weightUpdatedAt));

  const rows: PlannerKeyValue[] = [
    { label: 'Name', value: orBlank(name) },
    { label: 'Species', value: orBlank(safeText(petSpeciesLabel(pet))) },
    { label: 'Breed', value: orBlank(safeText(pet.breed)) },
    { label: 'Date of birth', value: dateOrBlank(pet.birthdate) },
    { label: 'Age', value: orBlank(safeText(age)) },
    { label: 'Gotcha day', value: dateOrBlank(pet.adoptionDate) },
    { label: 'Weight', value: orBlank(safeText(weight)) },
    { label: 'Weighed on', value: dateOrBlank(pet.weightUpdatedAt) },
    { label: 'Microchip', value: orBlank(microchip) },
  ];
  if (safeText(ownerName)) rows.push({ label: 'Pet parent', value: safeText(ownerName) });

  const blocks: PlannerBlock[] = [{ kind: 'kv', rows }];

  if (safeText(weight) && !hasWeightDate) {
    blocks.push(
      line(
        'The app keeps one weigh-in per pet, and this one was saved without a date — so none is printed rather than a guessed one.',
      ),
    );
  }

  blocks.push({
    kind: 'frame',
    text: safeText(pet.photoUri)
      ? `📷 ${name}'s photo is on this device — print it and stick it here.`
      : `${petEmojiFor(pet)} No photo on file yet — this app shows the pet's species glyph in its place. Affix a photo of ${name} here.`,
  });

  const missing = rows.filter((row) => row.value === BINDER_BLANK).length;
  if (missing === rows.length - 1) {
    blocks.push(
      empty(
        `Only ${name}'s name is on file so far — fill in the rest on the pet profile and those lines print next time.`,
      ),
    );
  }
  return blocks;
}

/** 🩺 Health summary — what a vet or a sitter must know before anything else. */
function healthBlocks(rec: PetRecords, today: string): PlannerBlock[] {
  const { pet, extras } = rec;
  const name = safeText(pet.name) || 'this pet';
  const allergies = safeText(extras.allergies);
  const weight = safeText(petWeightLabel(pet));

  const shots = byDateDesc(rec.vaccines, (v) => (v as Vaccine).dateGiven);
  const onToday = byDateAsc(
    rec.medications.filter((m) => medicationOnPassToday(m, today)),
    (m) => (m as Medication).startDate,
  );

  const blanks =
    (weight ? 0 : 1) + (allergies ? 0 : 1) + (shots.length > 0 ? 0 : 1) + (onToday.length > 0 ? 0 : 1);
  const total = 4;
  const blocks: PlannerBlock[] = [
    line(
      blanks === 0
        ? `Every health line is on file for ${name}.`
        : `${total - blanks} of ${total} health lines on file · ${blanks} say “${BINDER_BLANK}”.`,
    ),
    subheading('Vitals on file'),
    {
      kind: 'kv',
      rows: [
        { label: 'Weight', value: orBlank(weight) },
        { label: 'Weighed on', value: dateOrBlank(pet.weightUpdatedAt) },
        { label: 'Date of birth', value: dateOrBlank(pet.birthdate) },
        { label: 'Age', value: orBlank(safeText(petAgeLabel(pet))) },
      ],
    },
    subheading('Allergies & conditions'),
    {
      kind: 'kv',
      rows: [{ label: 'On file', value: orBlank(allergies) }],
    },
    empty(
      'The app keeps one free-text line for allergies and conditions — exactly the words you typed on the emergency card — so nothing is split, guessed or padded out here.',
    ),
    subheading('Vaccinations'),
  ];

  blocks.push(
    shots.length > 0
      ? {
          kind: 'list',
          items: shots.map((v) => {
            const given = dateOrBlank((v as Vaccine).dateGiven);
            const due = safeText((v as Vaccine).dueDate)
              ? `next due ${dateOrBlank((v as Vaccine).dueDate)}`
              : 'no due date set';
            return {
              title: safeText((v as Vaccine).name) || 'Vaccination',
              meta: metaLine([`given ${given}`, due, photoNote((v as Vaccine).photoUri)]),
              note: safeText((v as Vaccine).notes) || undefined,
            };
          }),
        }
      : empty(`No vaccinations are on file for ${name} yet.`),
  );

  blocks.push(subheading('Medication they are on today'));
  blocks.push(
    onToday.length > 0
      ? {
          kind: 'list',
          items: onToday.map((m) => {
            const med = m as Medication;
            const medName = safeText(med.name) || 'Medication';
            const dosage = safeText(med.dosage);
            return {
              title: `${medName}${dosage ? ` · ${dosage}` : ''}`,
              meta: metaLine([
                medicationScheduleLabel({
                  ...med,
                  times: Array.isArray(med.times) ? med.times.map((t) => safeText(t)) : [],
                } as Medication),
                safeText(med.startDate) ? `started ${dateOrBlank(med.startDate)}` : undefined,
                safeText(med.endDate) ? `last day ${dateOrBlank(med.endDate)}` : undefined,
                photoNote(med.photoUri),
              ]),
              note: safeText(med.notes) || undefined,
            };
          }),
        }
      : empty(
          `No medication is active for ${name} today — a finished course stays on the pet's own records, and nothing is listed here that is not being given.`,
        ),
  );

  return blocks;
}

/** 🏥 Vet records — the visit history newest first, then documents, then booked days. */
function recordsBlocks(rec: PetRecords, today: string): PlannerBlock[] {
  const { pet } = rec;
  const name = safeText(pet.name) || 'this pet';
  const rows = safeArray<VetRecord>(rec.vetRecords);
  const dated = (record: VetRecord): string => safeText(record.visitDate);

  const visits = byDateDesc(
    rows.filter((record) => vetRecordKind(record) === 'visit'),
    dated,
  );
  const documents = byDateDesc(
    rows.filter((record) => vetRecordKind(record) === 'document'),
    dated,
  );
  const appointments = byDateAsc(
    rows.filter((record) => vetRecordKind(record) === 'appointment'),
    dated,
  );
  const upcoming = appointments.filter((record) => dated(record) >= today);
  const passed = appointments.filter((record) => dated(record) < today);

  const item = (record: VetRecord, meta: Array<string | undefined>): PlannerListItem => ({
    title: safeText(record.visitTitle) || 'Vet record',
    meta: metaLine(meta),
    note: safeText(record.notes) || undefined,
  });

  const visitMeta = (record: VetRecord): Array<string | undefined> => [
    `${dateOrBlank(record.visitDate)}${safeText(record.visitTime) ? ` · ${safeText(record.visitTime)}` : ''}`,
    safeText(record.clinicName) || undefined,
    safeText(record.veterinarian) || undefined,
    safeNumber(record.cost) !== null ? `cost ${(record.cost as number).toFixed(2)}` : undefined,
    photoNote(record.photoUri),
  ];

  const blocks: PlannerBlock[] = [
    line(
      rows.length === 0
        ? `No vet records are on file for ${name} yet.`
        : `${visits.length} visit${visits.length === 1 ? '' : 's'}, ${documents.length} document${
            documents.length === 1 ? '' : 's'
          } and ${appointments.length} appointment${appointments.length === 1 ? '' : 's'} on file.`,
    ),
    subheading('Visit history'),
  ];

  blocks.push(
    visits.length > 0
      ? { kind: 'list', items: visits.map((record) => item(record, visitMeta(record))) }
      : empty(`No clinic visits are on file for ${name} yet.`),
  );

  blocks.push(subheading('Filed documents'));
  blocks.push(
    documents.length > 0
      ? {
          kind: 'list',
          items: documents.map((record) =>
            item(record, [
              `filed ${dateOrBlank(record.visitDate)}`,
              safeText(record.clinicName) || undefined,
              photoNote(record.photoUri),
            ]),
          ),
        }
      : empty(
          `No invoices or printouts are filed for ${name} yet — anything you file as a document prints here.`,
        ),
  );

  blocks.push(subheading('Booked ahead'));
  if (upcoming.length > 0) {
    blocks.push({
      kind: 'list',
      items: upcoming.map((record) =>
        item(record, [
          `${dateOrBlank(record.visitDate)}${safeText(record.visitTime) ? ` · ${safeText(record.visitTime)}` : ''}`,
          'booked',
          safeText(record.clinicName) || undefined,
          safeText(record.veterinarian) || undefined,
        ]),
      ),
    });
  } else {
    blocks.push(empty(`No vet appointment is booked for ${name}.`));
  }

  // A past appointment with no visit recorded after it: the app cannot know
  // whether the day happened, and it says so instead of reporting it as a fact.
  const unaccounted = passed.filter(
    (appointment) =>
      !visits.some((visit) => dated(visit) >= dated(appointment) && dated(appointment) !== ''),
  );
  if (unaccounted.length > 0) {
    const first = unaccounted[unaccounted.length - 1];
    blocks.push(
      empty(
        `An appointment for ${dateOrBlank(first.visitDate)}${
          safeText(first.visitTitle) ? ` (“${safeText(first.visitTitle)}”)` : ''
        } has no visit recorded after it — the app cannot know whether that day happened, so it is not reported as one.`,
      ),
    );
  }

  return blocks;
}

/** 💰 Costs on file — honest arithmetic over stored amounts only, then the entries. */
function expenseBlocks(rec: PetRecords): PlannerBlock[] {
  const { pet } = rec;
  const name = safeText(pet.name) || 'this pet';
  const rows = safeArray<Expense>(rec.expenses);

  if (rows.length === 0) {
    return [empty(`No costs are logged for ${name} yet — add one on the Expenses screen and it prints here.`)];
  }

  const usable = rows
    .map((expense) => ({ expense, amount: safeNumber(expense.amount) }))
    .filter((entry): entry is { expense: Expense; amount: number } => entry.amount !== null);
  const leftOut = rows.length - usable.length;
  const total = usable.reduce((sum, entry) => sum + entry.amount, 0);

  const byCategory = new Map<string, number>();
  for (const entry of usable) {
    const category = safeText(entry.expense.category) || 'Other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + entry.amount);
  }

  const blocks: PlannerBlock[] = [
    line(
      `Total on file: ${total.toFixed(2)} across ${usable.length} entr${
        usable.length === 1 ? 'y' : 'ies'
      }.`,
    ),
  ];
  if (leftOut > 0) {
    blocks.push(
      empty(
        `${leftOut} of ${rows.length} entries ${
          leftOut === 1 ? 'has' : 'have'
        } no usable amount stored, so ${leftOut === 1 ? 'it is' : 'they are'} left out of the total — the sum only adds what is really there.`,
      ),
    );
  }
  if (byCategory.size > 0) {
    blocks.push({
      kind: 'kv',
      rows: [...byCategory.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, sum]) => ({
          label: category,
          value: `${sum.toFixed(2)} (${percent(sum, total)}%)`,
        })),
    });
  }
  blocks.push({
    kind: 'list',
    items: byDateDesc(rows, (expense) => (expense as Expense).date).map((expense) => {
      const amount = safeNumber(expense.amount);
      return {
        title: safeText(expense.title) || 'Cost',
        meta: metaLine([
          dateOrBlank(expense.date),
          amount !== null ? amount.toFixed(2) : `amount ${BINDER_BLANK}`,
          safeText(expense.category) || undefined,
          safeText(expense.description) || undefined,
          photoNote(expense.photoUri),
        ]),
        note: safeText(expense.notes) || undefined,
      };
    }),
  });
  return blocks;
}

/** 🧳 Care instructions — the feeding schedule, the food on file, the written notes. */
function careBlocks(rec: PetRecords): PlannerBlock[] {
  const { pet, instructions } = rec;
  const name = safeText(pet.name) || 'this pet';
  const meals = byDateAsc(rec.feeding, (meal) => (meal as FeedingSchedule).time);

  const blocks: PlannerBlock[] = [subheading('Feeding schedule')];
  blocks.push(
    meals.length > 0
      ? {
          kind: 'log',
          columns: ['Meal', 'Time', 'Portion', 'Days', 'Notes'],
          rows: meals.map((meal) => {
            const amount = safeNumber(meal.portionAmount);
            const unit = safeText(meal.portionUnit);
            return [
              safeText(meal.mealType) || 'Meal',
              orBlank(safeText(meal.time)),
              amount !== null ? `${amount}${unit ? ` ${unit}` : ''}` : BINDER_BLANK,
              feedingDaysLabel(Array.isArray(meal.daysOfWeek) ? meal.daysOfWeek : []),
              safeText(meal.notes),
            ];
          }),
        }
      : empty(`No feeding schedule is stored for ${name} yet — add meals on the Feeding screen and they print here.`),
  );

  blocks.push(subheading('Food on file'));
  blocks.push({
    kind: 'kv',
    rows: [
      { label: 'Food brand', value: orBlank(careInstructionValue(instructions, 'foodBrand')) },
      { label: 'Amount per meal', value: orBlank(careInstructionValue(instructions, 'foodAmount')) },
      { label: 'Feeding times', value: orBlank(careInstructionValue(instructions, 'foodTimes')) },
      { label: 'Where food is kept', value: orBlank(careInstructionValue(instructions, 'foodStored')) },
      { label: 'Treat allowance', value: orBlank(careInstructionValue(instructions, 'treatAllowance')) },
    ],
  });

  blocks.push(subheading('Written care notes'));
  const groups = careInstructionsGroupsWithContent(instructions);
  if (groups.length === 0) {
    blocks.push(
      empty(
        `No care notes are written for ${name} yet — fill them in on the pet's care instructions page and the whole sheet prints here.`,
      ),
    );
  } else {
    for (const group of groups) {
      blocks.push(subheading(`${group.group.emoji} ${group.group.title}`));
      blocks.push({
        kind: 'kv',
        rows: group.entries.map((entry) => ({ label: entry.field.label, value: entry.value })),
      });
    }
  }

  // A sitter holding paper needs somewhere to write the day's own notes, and a
  // ruled table is template furniture: no values, no invented facts.
  blocks.push({
    kind: 'log',
    columns: ['Day', 'What happened', 'Who'],
    rows: blankRows(4, 3),
    hint: 'Write-in log — the app keeps every check-in on the device; this page is for pen.',
  });

  return blocks;
}

/* -------------------------------------------------------------- document ---- */

/** The blocks for one section id. */
function sectionBlocks(
  id: BinderSectionId,
  rec: PetRecords,
  ownerName: string,
  today: string,
): PlannerBlock[] {
  switch (id) {
    case 'profile':
      return profileBlocks(rec, ownerName);
    case 'health':
      return healthBlocks(rec, today);
    case 'records':
      return recordsBlocks(rec, today);
    case 'expenses':
      return expenseBlocks(rec);
    case 'care':
      return careBlocks(rec);
    default:
      return [empty('This section has nothing to print yet.')];
  }
}

/** One pet's records, filtered out of the whole-device collections. */
function petRecords(pet: Pet, source: BinderSource): PetRecords {
  const petId = petIdOf(pet);
  const matches = <T extends { petId?: unknown }>(row: T): boolean => safeText(row.petId) === petId;
  return {
    pet,
    petId,
    vaccines: safeArray<Vaccine>(source.vaccines).filter(matches),
    medications: safeArray<Medication>(source.medications).filter(matches),
    feeding: safeArray<FeedingSchedule>(source.feeding).filter(matches),
    vetRecords: safeArray<VetRecord>(source.vetRecords).filter(matches),
    expenses: safeArray<Expense>(source.expenses).filter(matches),
    instructions: safeArray<CareInstructions>(source.careInstructions).find(
      (row) => safeText(row.petId) === petId,
    ),
    extras: extrasFor(source.emergencyExtras, petId),
  };
}

/** "Bella's care binder" / "Care binder · Bella, Milo + 1 more". */
function documentTitle(pets: Pet[], household: boolean): string {
  if (pets.length === 1) return `${safeText(pets[0].name) || 'This pet'}'s care binder`;
  if (household) return 'The whole household’s care binder';
  const names = pets.slice(0, 3).map((pet) => safeText(pet.name) || 'Pet');
  const extra = pets.length - names.length;
  return `Care binder · ${names.join(', ')}${extra > 0 ? ` + ${extra} more` : ''}`;
}

/**
 * Build the complete care binder for the chosen pets and paper.
 *
 * Pets print in the app's own pet order, every section always prints (a care
 * file with a hole in it is worse than no file), and a pet with nothing stored
 * still gets a chapter full of honest "Not on file" lines.
 */
export function buildBinderDocument(
  source: BinderSource,
  config: BinderConfig,
  now: Date = new Date(),
): BinderDocument {
  const pets = safeArray<Pet>(source?.pets);
  const chosenIds = Array.isArray(config?.petIds) ? config.petIds.map((id) => safeText(id)) : [];
  const wanted = new Set(chosenIds.filter((id) => id.length > 0));
  const selected = wanted.size > 0 ? pets.filter((pet) => wanted.has(petIdOf(pet))) : pets;
  const household = selected.length === pets.length && pets.length > 0;
  const today = todayISO(now);

  const chapters = selected.map((pet) => {
    const rec = petRecords(pet, source);
    return {
      petId: rec.petId,
      petName: safeText(pet.name) || 'This pet',
      petEmoji: petEmojiFor(pet),
      meta: metaLine([petMetaLine(pet), petAgeLabel(pet, now)]) ?? petSpeciesLabel(pet),
      sections: BINDER_SECTIONS.map((def: BinderSectionDef) => ({
        id: def.id,
        title: def.title,
        emoji: def.emoji,
        blocks: sectionBlocks(def.id, rec, safeText(source?.ownerName), today),
      })),
    };
  });

  const generatedOn = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const paperLabel = config?.paper === 'a4' ? 'A4' : 'US Letter';

  return {
    title: documentTitle(selected, household),
    kicker: 'Pet Parent Tracker · The Blueprint',
    subtitle: `Assembled on this device ${generatedOn} · ${paperLabel} · 100% offline — nothing left your phone.`,
    petNames: selected.map((pet) => safeText(pet.name) || 'This pet'),
    sectionTitles: BINDER_SECTIONS.map((def) => def.title),
    paper: config?.paper ?? 'letter',
    chapters,
  };
}

/* ---------------------------------------------------------------- naming ---- */

/** Lowercase, hyphenated file-name slug ("Bella" → "bella"). */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A tidy file name for the binder, e.g. "pet-care-binder-bella-2026-10-16.pdf"
 * or "pet-care-binder-bella-milo-2026-10-16.pdf". Derived from the owner's own
 * pet names — nothing is invented.
 */
export function binderFileName(petNames: string[], today: Date = new Date()): string {
  const names = (Array.isArray(petNames) ? petNames : [])
    .map((name) => slug(safeText(name)) || 'pet')
    .filter((name) => name.length > 0);
  const who =
    names.length === 0
      ? 'pets'
      : names.length <= 3
        ? names.join('-')
        : `${names[0]}-and-${names.length - 1}-more`;
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  return `pet-care-binder-${who}-${stamp}.pdf`;
}

/**
 * The one-line summary the binder screen shows above its actions, e.g.
 * "Bella · US Letter · 5 sections". Honest: it counts the sections that print.
 */
export function binderSummaryLine(
  petNames: string[],
  paper: PaperSize,
  sectionCount: number = BINDER_SECTIONS.length,
): string {
  const names = (Array.isArray(petNames) ? petNames : []).map((name) => safeText(name));
  const who =
    names.length === 0 ? 'No pet selected' : names.length === 1 ? names[0] : `${names.length} pets`;
  const paperLabel = paper === 'a4' ? 'A4' : 'US Letter';
  return `${who} · ${paperLabel} · ${sectionCount} sections`;
}
