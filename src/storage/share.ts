/**
 * Co-parent share file format — Blueprint Premium feature 4/4.
 *
 * A "pet file" is one JSON document holding a pet's complete on-device data:
 * the pet profile plus every vaccine, medication, feeding, vet, expense, and
 * journal record that belongs to it. The exporting device writes the file
 * locally and hands it to the system share sheet (the user sends it however
 * they like — text, email, file); the co-parent's device picks the file and
 * imports it. No account, no server, no network at any step.
 *
 * Premium travels with the file: every exported file carries
 * `premiumShared: true`, and importing a valid file unlocks Blueprint Premium
 * on the importing device (one-time unlock, same as buying the tier). A strict
 * "exactly 2 co-parents" cap is impossible without a server, so the cap is
 * intent only — sharing the file further shares premium too.
 *
 * This module is pure (no React, no native modules): serialize, validate, and
 * apply-to-stores helpers that UI components drive. File writing and sharing
 * live in the component (lazy requires, web-guarded) so the web bundle never
 * evaluates native modules.
 *
 * 100% offline: JSON in memory + AsyncStorage only. No fetch, no URLs.
 */
import { expenseRepository } from './expenses';
import { feedingRepository } from './feeding';
import { journalRepository } from './journal';
import { medicationRepository } from './medications';
import { petRepository } from './pets';
import { vaccineRepository } from './vaccines';
import { vetRepository } from './vet';
import type {
  Expense,
  ExpenseInput,
  FeedingSchedule,
  FeedingScheduleInput,
  JournalEntry,
  JournalEntryInput,
  Medication,
  MedicationInput,
  Pet,
  PetInput,
  Vaccine,
  VaccineInput,
  VetRecord,
  VetRecordInput,
} from '../types';
import type { ExpenseCategory, JournalMood, MealType, PortionUnit, Species } from '../types';

/** Current pet-file format version. Readers accept this version or older ones. */
export const PET_FILE_VERSION = 1;

/**
 * A portable pet file: the pet profile, all seven record sections, the
 * premium-sharing marker, and the export metadata. Photo fields (`photoUri`)
 * travel as the stored local paths — they only resolve on the exporting
 * device, so imported photo URIs are best-effort (kept, shown when valid).
 */
export interface PetShareFile {
  /** Marker identifying this JSON as a Pet Parent Tracker pet file. */
  kind: 'pet-parent-tracker-pet-file';
  /** Format version (1 for this pass; forward-compatible readers). */
  fileVersion: number;
  /** Always true on export — importing a shared file unlocks premium. */
  premiumShared: boolean;
  /** ISO timestamp of when the file was exported. */
  exportedAt: string;
  /** The pet profile (without internal-only fields stripped — plain data). */
  pet: Pet;
  /** Every vaccine record belonging to the pet (possibly empty). */
  vaccines: Vaccine[];
  /** Every medication record belonging to the pet (possibly empty). */
  medications: Medication[];
  /** Every feeding entry belonging to the pet (possibly empty). */
  feeding: FeedingSchedule[];
  /** Every vet record belonging to the pet (possibly empty). */
  vetRecords: VetRecord[];
  /** Every expense record belonging to the pet (possibly empty). */
  expenses: Expense[];
  /** Every journal entry belonging to the pet (possibly empty). */
  journal: JournalEntry[];
}

/**
 * Snapshot of one pet's complete on-device data, ready to serialize. Used by
 * the export row (which gathers the already-loaded contexts) and mirrored by
 * `loadPetFileData` (which reads the stores directly).
 */
export interface PetFileData {
  pet: Pet;
  vaccines: Vaccine[];
  medications: Medication[];
  feeding: FeedingSchedule[];
  vetRecords: VetRecord[];
  expenses: Expense[];
  journal: JournalEntry[];
}

/** Read one pet's complete data straight from the stores (export path). */
export async function loadPetFileData(petId: string): Promise<PetFileData | null> {
  const pet = await petRepository.get(petId);
  if (!pet) return null;
  const [vaccines, medications, feeding, vetRecords, expenses, journal] =
    await Promise.all([
      vaccineRepository.listByPet(petId),
      medicationRepository.listByPet(petId),
      feedingRepository.listByPet(petId),
      vetRepository.listByPet(petId),
      expenseRepository.listByPet(petId),
      journalRepository.listByPet(petId),
    ]);
  return { pet, vaccines, medications, feeding, vetRecords, expenses, journal };
}

/** Build the portable share document for one pet's data. */
export function buildPetShareFile(data: PetFileData): PetShareFile {
  return {
    kind: 'pet-parent-tracker-pet-file',
    fileVersion: PET_FILE_VERSION,
    premiumShared: true,
    exportedAt: new Date().toISOString(),
    pet: data.pet,
    vaccines: data.vaccines,
    medications: data.medications,
    feeding: data.feeding,
    vetRecords: data.vetRecords,
    expenses: data.expenses,
    journal: data.journal,
  };
}

/** Serialize one pet's data to the share-file JSON string. */
export function serializePetFile(data: PetFileData): string {
  return JSON.stringify(buildPetShareFile(data));
}

/** Suggested local filename for an exported pet file (safe characters only). */
export function petFileName(petName: string): string {
  const safe = petName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${safe || 'pet'}-pet-file.json`;
}

// --- Validation (import path) ----------------------------------------------

/** Why a candidate document is not an importable pet file. */
export type PetFileProblem =
  | 'not-json'
  | 'not-a-pet-file'
  | 'unsupported-version'
  | 'missing-pet';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

const SPECIES: Species[] = ['Dog', 'Cat', 'Other'];
const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
const PORTION_UNITS: PortionUnit[] = ['g', 'cups', 'tbsp', 'cans', 'ml'];
const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Vet',
  'Grooming',
  'Supplies',
  'Medication',
  'Other',
];
const MOODS: JournalMood[] = ['Happy', 'Playful', 'Sleepy', 'Grumpy', 'Sick'];

/** Lenient record check: required identity + parent link present and sane. */
function isPlausibleRecord(
  value: unknown,
  extra: (record: Record<string, unknown>) => boolean,
): boolean {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || typeof value.petId !== 'string') return false;
  if (typeof value.createdAt !== 'string') return false;
  return extra(value);
}

function isPlausibleVaccine(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) => typeof r.name === 'string' && typeof r.dateGiven === 'string',
  );
}

function isPlausibleMedication(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) =>
      typeof r.name === 'string' &&
      typeof r.dosage === 'string' &&
      isStringArray(r.times) &&
      typeof r.intervalDays === 'number' &&
      typeof r.active === 'boolean' &&
      typeof r.remindersEnabled === 'boolean',
  );
}

function isPlausibleFeeding(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) =>
      typeof r.mealType === 'string' &&
      (MEAL_TYPES as string[]).includes(r.mealType) &&
      typeof r.time === 'string' &&
      typeof r.portionAmount === 'number' &&
      typeof r.portionUnit === 'string' &&
      (PORTION_UNITS as string[]).includes(r.portionUnit) &&
      isNumberArray(r.daysOfWeek),
  );
}

function isPlausibleVetRecord(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) => typeof r.visitTitle === 'string' && typeof r.visitDate === 'string',
  );
}

function isPlausibleExpense(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) =>
      typeof r.title === 'string' &&
      typeof r.amount === 'number' &&
      typeof r.date === 'string' &&
      typeof r.category === 'string' &&
      (EXPENSE_CATEGORIES as string[]).includes(r.category),
  );
}

function isPlausibleJournal(value: unknown): boolean {
  return isPlausibleRecord(
    value,
    (r) =>
      typeof r.body === 'string' &&
      typeof r.entryDate === 'string' &&
      (r.mood === undefined || (typeof r.mood === 'string' && (MOODS as string[]).includes(r.mood))),
  );
}

function asArray<T>(value: unknown, check: (item: unknown) => boolean): T[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const kept: T[] = [];
  for (const item of value) {
    if (!check(item)) return null;
    kept.push(item as T);
  }
  return kept;
}

/**
 * Parse + validate a candidate pet-file JSON string. Returns the validated
 * file, or the reason it cannot be imported. Unknown extra fields are
 * ignored; malformed sections reject the file (never import half a pet).
 */
export function parsePetShareFile(
  raw: string,
): { ok: true; file: PetShareFile } | { ok: false; problem: PetFileProblem } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, problem: 'not-json' };
  }
  if (!isObject(parsed) || parsed.kind !== 'pet-parent-tracker-pet-file') {
    return { ok: false, problem: 'not-a-pet-file' };
  }
  if (typeof parsed.fileVersion !== 'number' || parsed.fileVersion < 1) {
    return { ok: false, problem: 'not-a-pet-file' };
  }
  if (parsed.fileVersion > PET_FILE_VERSION) {
    return { ok: false, problem: 'unsupported-version' };
  }
  const petRaw = parsed.pet;
  if (
    !isObject(petRaw) ||
    typeof petRaw.id !== 'string' ||
    typeof petRaw.name !== 'string' ||
    petRaw.name.trim() === '' ||
    typeof petRaw.species !== 'string' ||
    !(SPECIES as string[]).includes(petRaw.species) ||
    typeof petRaw.createdAt !== 'string'
  ) {
    return { ok: false, problem: 'missing-pet' };
  }
  const vaccines = asArray<Vaccine>(parsed.vaccines, isPlausibleVaccine);
  const medications = asArray<Medication>(parsed.medications, isPlausibleMedication);
  const feeding = asArray<FeedingSchedule>(parsed.feeding, isPlausibleFeeding);
  const vetRecords = asArray<VetRecord>(parsed.vetRecords, isPlausibleVetRecord);
  const expenses = asArray<Expense>(parsed.expenses, isPlausibleExpense);
  const journal = asArray<JournalEntry>(parsed.journal, isPlausibleJournal);
  if (
    vaccines === null ||
    medications === null ||
    feeding === null ||
    vetRecords === null ||
    expenses === null ||
    journal === null
  ) {
    return { ok: false, problem: 'not-a-pet-file' };
  }
  return {
    ok: true,
    file: {
      kind: 'pet-parent-tracker-pet-file',
      fileVersion: parsed.fileVersion,
      premiumShared: parsed.premiumShared === true,
      exportedAt:
        typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      pet: petRaw as unknown as Pet,
      vaccines,
      medications,
      feeding,
      vetRecords,
      expenses,
      journal,
    },
  };
}

/** Human-friendly explanation of why a file could not be imported. */
export function petFileProblemMessage(problem: PetFileProblem): string {
  switch (problem) {
    case 'not-json':
      return 'That file isn’t a pet file — it doesn’t look like JSON the app can read.';
    case 'not-a-pet-file':
      return 'That file wasn’t exported from Pet Parent Tracker. Ask your co-parent to use “Share with co-parent” on their pet.';
    case 'unsupported-version':
      return 'That pet file was made by a newer version of the app. Update Pet Parent Tracker on this device and try again.';
    case 'missing-pet':
      return 'That pet file is missing the pet profile, so there’s nothing to import.';
  }
}

// --- Import (apply a validated file to the stores) --------------------------

/** What applying a validated file produced. */
export interface PetFileImportResult {
  /** The newly created pet on this device (fresh id). */
  pet: Pet;
  /** Record counts restored into each section. */
  counts: {
    vaccines: number;
    medications: number;
    feeding: number;
    vetRecords: number;
    expenses: number;
    journal: number;
  };
}

/**
 * Persist a validated pet file as a brand-new pet + records on this device.
 * Every record gets a fresh id (via the stores) and is re-parented to the new
 * pet id, so imports never collide with existing data. `petName` overrides
 * the file's name (duplicate handling — e.g. "Milo (2)").
 *
 * Reminders intentionally do NOT auto-enable on import: the file's
 * reminder flags travel for reference, but scheduling stays behind the
 * premium reminder toggles the co-parent controls themselves.
 */
export async function importPetShareFile(
  file: PetShareFile,
  petName?: string,
): Promise<PetFileImportResult> {
  const petInput: PetInput = {
    name: petName ?? file.pet.name,
    species: file.pet.species,
    breed: file.pet.breed,
    birthdate: file.pet.birthdate,
    weight: file.pet.weight,
    weightUnit: file.pet.weightUnit,
    photoUri: file.pet.photoUri,
  };
  const pet = await petRepository.create(petInput);
  const petId = pet.id;

  const withoutIds = <T extends { id: string; createdAt: string; petId: string }>(
    records: T[],
  ): Array<Omit<T, 'id' | 'createdAt'> & { petId: string }> =>
    records.map((record) => {
      const { id: _id, createdAt: _createdAt, petId: _petId, ...rest } = record;
      return { ...rest, petId } as Omit<T, 'id' | 'createdAt'> & { petId: string };
    });

  const vaccineInputs = withoutIds(file.vaccines) as VaccineInput[];
  const medicationInputs = withoutIds(file.medications) as MedicationInput[];
  const feedingInputs = withoutIds(file.feeding) as FeedingScheduleInput[];
  const vetInputs = withoutIds(file.vetRecords) as VetRecordInput[];
  const expenseInputs = withoutIds(file.expenses) as ExpenseInput[];
  const journalInputs = withoutIds(file.journal) as JournalEntryInput[];

  await Promise.all([
    ...vaccineInputs.map((input) => vaccineRepository.create(input)),
    ...medicationInputs.map((input) => medicationRepository.create(input)),
    ...feedingInputs.map((input) => feedingRepository.create(input)),
    ...vetInputs.map((input) => vetRepository.create(input)),
    ...expenseInputs.map((input) => expenseRepository.create(input)),
    ...journalInputs.map((input) => journalRepository.create(input)),
  ]);

  return {
    pet,
    counts: {
      vaccines: vaccineInputs.length,
      medications: medicationInputs.length,
      feeding: feedingInputs.length,
      vetRecords: vetInputs.length,
      expenses: expenseInputs.length,
      journal: journalInputs.length,
    },
  };
}

/**
 * Suggest a non-colliding pet name when this device already has a pet with
 * the imported name: "Milo" → "Milo (2)" → "Milo (3)" …
 */
export function resolveDuplicatePetName(wanted: string, existingNames: string[]): string {
  const taken = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const base = wanted.trim() || 'Shared pet';
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n += 1;
  return `${base} (${n})`;
}
