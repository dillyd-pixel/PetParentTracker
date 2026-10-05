/**
 * Care Instructions — the per-pet notes a pet parent writes once (Stage 2 of
 * Sitter Mode).
 *
 * A pet parent fills in what matters about caring for one pet — the food, the
 * bathroom routine, where they sleep, how they behave, and the quirks only
 * they know. The notes are permanent and editable at any time; they are NOT
 * part of a single pass. Later stages read them as the CONTENT of a Care Pass
 * (Stage 4 wires them into the pass's sections), which is why this file is
 * built around the canonical section ids from `./carePass`.
 *
 * The shape is deliberately loose: every field is optional free text, and an
 * owner fills only what they care about. Nothing here ever fails because a
 * field is blank, and a completely empty record is a perfectly valid state
 * (the screens show a friendly empty view instead of a form full of zeroes).
 *
 * Structure — one registry, three consumers:
 *  - `CARE_INSTRUCTION_GROUPS` — the five groups the owner asked for (Food,
 *    Bathroom, Sleep, Behaviour, Quirks), in render order, with the emoji and
 *    one-line hint each screen shows.
 *  - `CARE_INSTRUCTION_FIELDS` — every field, in render order, each tagged with
 *    its group, its human label, a placeholder hint and the canonical
 *    `CarePassSection` its content feeds. The editor, the read view and the
 *    Stage 4 pass content all render from THIS list, so a new field is added in
 *    one place (here) and appears everywhere.
 *  - The `CareInstructions` entity itself — the flat record that gets stored.
 *    It stays flat (one key per field, no nested objects) so AsyncStorage
 *    round-trips it unchanged and an older record from an earlier version still
 *    reads with the fields it had.
 *
 * Section mapping (the Stage 4 contract). A field's `section` is the canonical
 * Care Pass section its content belongs to:
 *  - food          → `feeding`
 *  - walk schedule → `walking`
 *  - litter / yard → `bathroom`
 *  - sleep (bed, bedtime, night routine) → `house` (sleeping arrangements are
 *    a house rule; there is no separate "sleep" pass section)
 *  - behaviour and quirks → `behavior`
 * `careInstructionsContentBySection()` exposes exactly that grouping, keyed by
 * the canonical ids, so a pass can render its sections from these notes without
 * knowing anything about this file's groups.
 *
 * 100% offline: pure types and pure helpers — no storage, no network.
 */
import { CARE_PASS_SECTIONS, carePassSectionLabel } from './carePass';
import type { CarePassSection } from './carePass';
import type { BaseEntity } from './index';

/** The five groups of care notes, in the order every screen renders them. */
export type CareInstructionGroupId =
  | 'food'
  | 'bathroom'
  | 'sleep'
  | 'behavior'
  | 'quirks';

/** Every stored field of a care-instructions record, as a string key. */
export type CareInstructionFieldKey =
  | 'foodBrand'
  | 'foodAmount'
  | 'foodTimes'
  | 'foodStored'
  | 'treatAllowance'
  | 'walkSchedule'
  | 'litterRoutine'
  | 'yardRoutine'
  | 'sleepLocation'
  | 'bedtime'
  | 'nightRoutine'
  | 'fears'
  | 'triggers'
  | 'escapeTendencies'
  | 'petCompatibility'
  | 'strangerBehavior'
  | 'quirks';

/**
 * One group of notes: the heading, its emoji and the hint under it.
 *
 * Groups are a reading/editing convenience for the owner — the pass-facing
 * mapping lives on each field (see `CARE_INSTRUCTION_FIELDS.section`).
 */
export interface CareInstructionGroup {
  id: CareInstructionGroupId;
  /** Heading text, e.g. "Food". */
  title: string;
  /** Emoji glyph beside the heading (emoji-only — the app bundles no images). */
  emoji: string;
  /** One-line hint explaining what belongs in the group. */
  hint: string;
}

/** The five groups, in render order. */
export const CARE_INSTRUCTION_GROUPS: readonly CareInstructionGroup[] = [
  {
    id: 'food',
    title: 'Food',
    emoji: '🍽️',
    hint: 'What they eat, how much, when — and where it lives.',
  },
  {
    id: 'bathroom',
    title: 'Bathroom',
    emoji: '🚶',
    hint: 'Walks, litter or the yard: the toilet routine.',
  },
  {
    id: 'sleep',
    title: 'Sleep',
    emoji: '🛏️',
    hint: 'Where they sleep and what settles them at night.',
  },
  {
    id: 'behavior',
    title: 'Behaviour',
    emoji: '🧠',
    hint: 'What to expect, and what to keep them away from.',
  },
  {
    id: 'quirks',
    title: 'Quirks',
    emoji: '✨',
    hint: 'The little things only you know.',
  },
];

/**
 * One editable field: which group it sits in, what it is called, the hint in
 * the empty box and the canonical pass section its content feeds.
 */
export interface CareInstructionField {
  key: CareInstructionFieldKey;
  group: CareInstructionGroupId;
  /** The field's own label, e.g. "Food brand". */
  label: string;
  /** Placeholder shown in the empty box — a hint, never data. */
  placeholder: string;
  /** Whether the field is a paragraph (multi-line) rather than one line. */
  multiline: boolean;
  /** The canonical Care Pass section this content belongs to. */
  section: CarePassSection;
}

/**
 * THE field list. Order is the order the editor and the read view render, and
 * every label/placeholder/help text in the app comes from here — a screen never
 * types a field label of its own.
 */
export const CARE_INSTRUCTION_FIELDS: readonly CareInstructionField[] = [
  // ---- Food → feeding ----
  {
    key: 'foodBrand',
    group: 'food',
    label: 'Food brand',
    placeholder: 'e.g. the usual kibble, grain-free',
    multiline: false,
    section: 'feeding',
  },
  {
    key: 'foodAmount',
    group: 'food',
    label: 'Amount per meal',
    placeholder: 'e.g. one heaped cup, twice a day',
    multiline: false,
    section: 'feeding',
  },
  {
    key: 'foodTimes',
    group: 'food',
    label: 'Feeding times',
    placeholder: 'e.g. about 07:30 and 18:00',
    multiline: false,
    section: 'feeding',
  },
  {
    key: 'foodStored',
    group: 'food',
    label: 'Where food is kept',
    placeholder: 'e.g. sealed tub on the bottom pantry shelf',
    multiline: false,
    section: 'feeding',
  },
  {
    key: 'treatAllowance',
    group: 'food',
    label: 'Treat allowance',
    placeholder: 'e.g. a few small treats a day, nothing from the table',
    multiline: true,
    section: 'feeding',
  },
  // ---- Bathroom → walking / bathroom ----
  {
    key: 'walkSchedule',
    group: 'bathroom',
    label: 'Walk schedule',
    placeholder: 'e.g. a short walk in the morning, a long one late afternoon',
    multiline: true,
    section: 'walking',
  },
  {
    key: 'litterRoutine',
    group: 'bathroom',
    label: 'Litter routine',
    placeholder: 'e.g. scoop twice a day, full change once a week',
    multiline: true,
    section: 'bathroom',
  },
  {
    key: 'yardRoutine',
    group: 'bathroom',
    label: 'Yard routine',
    placeholder: 'e.g. out after every meal; please latch the gate',
    multiline: true,
    section: 'bathroom',
  },
  // ---- Sleep → house ----
  {
    key: 'sleepLocation',
    group: 'sleep',
    label: 'Bed or crate location',
    placeholder: 'e.g. crate in the kitchen, door left open',
    multiline: false,
    section: 'house',
  },
  {
    key: 'bedtime',
    group: 'sleep',
    label: 'Bedtime',
    placeholder: 'e.g. about 22:00',
    multiline: false,
    section: 'house',
  },
  {
    key: 'nightRoutine',
    group: 'sleep',
    label: 'Night routine',
    placeholder: 'e.g. last toilet trip, then a biscuit in the crate',
    multiline: true,
    section: 'house',
  },
  // ---- Behaviour → behavior ----
  {
    key: 'fears',
    group: 'behavior',
    label: 'Fears',
    placeholder: 'e.g. thunder, the vacuum, loud strangers',
    multiline: true,
    section: 'behavior',
  },
  {
    key: 'triggers',
    group: 'behavior',
    label: 'Triggers',
    placeholder: 'e.g. the doorbell sets off barking',
    multiline: true,
    section: 'behavior',
  },
  {
    key: 'escapeTendencies',
    group: 'behavior',
    label: 'Escape tendencies',
    placeholder: 'e.g. slips a harness; makes for the front gate',
    multiline: true,
    section: 'behavior',
  },
  {
    key: 'petCompatibility',
    group: 'behavior',
    label: 'Dogs and cats',
    placeholder: 'e.g. fine with calm dogs, will chase cats',
    multiline: true,
    section: 'behavior',
  },
  {
    key: 'strangerBehavior',
    group: 'behavior',
    label: 'With strangers',
    placeholder: 'e.g. barks first, warms up in a few minutes',
    multiline: true,
    section: 'behavior',
  },
  // ---- Quirks → behavior ----
  {
    key: 'quirks',
    group: 'quirks',
    label: 'Anything else',
    placeholder: 'Habits, favourite toys, silly routines, names they answer to…',
    multiline: true,
    section: 'behavior',
  },
];

/** The group with this id, or undefined for an unknown one. */
export function careInstructionGroup(
  id: CareInstructionGroupId,
): CareInstructionGroup | undefined {
  return CARE_INSTRUCTION_GROUPS.find((group) => group.id === id);
}

/** Every field of one group, in render order (used by the editor and read view). */
export function careInstructionFieldsInGroup(
  id: CareInstructionGroupId,
): CareInstructionField[] {
  return CARE_INSTRUCTION_FIELDS.filter((field) => field.group === id);
}

/**
 * A pet's care instructions — ONE record per pet, stored on-device.
 *
 * Every field is independent and optional: the owner writes the ones they care
 * about and leaves the rest blank. Blank and missing mean the same thing (the
 * screens treat both as "not written"), so an empty record is valid.
 */
export interface CareInstructions extends BaseEntity {
  /** The pet these notes are about (one record per pet id). */
  petId: string;

  /* ---- Food (→ pass section `feeding`) ---- */
  foodBrand?: string;
  foodAmount?: string;
  foodTimes?: string;
  foodStored?: string;
  treatAllowance?: string;

  /* ---- Bathroom (→ `walking` / `bathroom`) ---- */
  walkSchedule?: string;
  litterRoutine?: string;
  yardRoutine?: string;

  /* ---- Sleep (→ `house`) ---- */
  sleepLocation?: string;
  bedtime?: string;
  nightRoutine?: string;

  /* ---- Behaviour (→ `behavior`) ---- */
  fears?: string;
  triggers?: string;
  escapeTendencies?: string;
  petCompatibility?: string;
  strangerBehavior?: string;

  /* ---- Quirks (→ `behavior`) ---- */
  quirks?: string;

  /**
   * ISO timestamp of the last save. Set by the repository; optional so records
   * written before a field existed still read fine.
   */
  updatedAt?: string;
}

/** What the editor supplies: a value for any subset of the fields. */
export type CareInstructionValues = Partial<Record<CareInstructionFieldKey, string>>;

/** A field together with the value the owner wrote for it (always non-empty). */
export interface CareInstructionEntry {
  field: CareInstructionField;
  /** The stored value, trimmed. */
  value: string;
}

/** A record with no field filled in — the state before the owner writes anything. */
export function emptyCareInstructions(petId: string): CareInstructions {
  return { id: '', createdAt: '', petId };
}

/** One field's value from a record, trimmed — '' when unset or blank. */
export function careInstructionValue(
  instructions: Pick<CareInstructions, CareInstructionFieldKey> | undefined | null,
  key: CareInstructionFieldKey,
): string {
  const raw = instructions?.[key];
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * Tidy editor values into storable ones: trim every field and drop the empty
 * ones, so a cleared box leaves no `''` behind and two equal sets of notes
 * compare equal.
 */
export function cleanCareInstructionValues(
  values: CareInstructionValues,
): CareInstructionValues {
  const clean: CareInstructionValues = {};
  for (const field of CARE_INSTRUCTION_FIELDS) {
    const value = values[field.key]?.trim();
    if (value) clean[field.key] = value;
  }
  return clean;
}

/** Every filled field, in registry order (the read view's data source). */
export function filledCareInstructionEntries(
  instructions: CareInstructions | undefined | null,
): CareInstructionEntry[] {
  if (!instructions) return [];
  const entries: CareInstructionEntry[] = [];
  for (const field of CARE_INSTRUCTION_FIELDS) {
    const value = careInstructionValue(instructions, field.key);
    if (value) entries.push({ field, value });
  }
  return entries;
}

/** How many fields the owner has written something in. */
export function careInstructionsFilledCount(
  instructions: CareInstructions | undefined | null,
): number {
  return filledCareInstructionEntries(instructions).length;
}

/** Whether nothing at all has been written for this pet yet. */
export function careInstructionsAreEmpty(
  instructions: CareInstructions | undefined | null,
): boolean {
  return careInstructionsFilledCount(instructions) === 0;
}

/** One group's heading plus the entries written in it (only filled groups). */
export interface CareInstructionGroupContent {
  group: CareInstructionGroup;
  entries: CareInstructionEntry[];
}

/** The groups that have something written in them, in render order. */
export function careInstructionsGroupsWithContent(
  instructions: CareInstructions | undefined | null,
): CareInstructionGroupContent[] {
  if (!instructions) return [];
  const result: CareInstructionGroupContent[] = [];
  for (const group of CARE_INSTRUCTION_GROUPS) {
    const entries = careInstructionFieldsInGroup(group.id)
      .map((field) => ({ field, value: careInstructionValue(instructions, field.key) }))
      .filter((entry) => entry.value !== '');
    if (entries.length > 0) result.push({ group, entries });
  }
  return result;
}

/**
 * One canonical Care Pass section's content, taken from these notes: the
 * section id, its human label and the labelled lines a pass renders.
 *
 * This is THE hook Stage 4 uses — a pass asks for its sections and gets back
 * only the ids it can render, in canonical order, with every line already
 * labelled. Nothing about the owner's Food/Sleep/Quirks grouping leaks out.
 */
export interface CareInstructionSectionContent {
  section: CarePassSection;
  /** The section's human label, from `carePassSectionLabel`. */
  label: string;
  /** The labelled lines written for it, in field order. */
  entries: CareInstructionEntry[];
}

/**
 * The written notes grouped by canonical pass section, in canonical order,
 * with empty sections left out. A pet with nothing written returns `[]`.
 */
export function careInstructionsContentBySection(
  instructions: CareInstructions | undefined | null,
): CareInstructionSectionContent[] {
  const entries = filledCareInstructionEntries(instructions);
  if (entries.length === 0) return [];
  return CARE_PASS_SECTIONS.map((section) => ({
    section,
    label: carePassSectionLabel(section),
    entries: entries.filter((entry) => entry.field.section === section),
  })).filter((content) => content.entries.length > 0);
}

/** The canonical sections these notes feed, in canonical order (Stage 4 contract). */
export function careInstructionsSections(
  instructions: CareInstructions | undefined | null,
): CarePassSection[] {
  return careInstructionsContentBySection(instructions).map((content) => content.section);
}

/**
 * One-line status for a summary row, e.g. "Nothing written yet" or
 * "6 notes saved". Used on the pet's page and on Sitter Mode home.
 */
export function careInstructionsSummary(
  instructions: CareInstructions | undefined | null,
): string {
  const count = careInstructionsFilledCount(instructions);
  if (count === 0) return 'Nothing written yet';
  return count === 1 ? '1 note saved' : `${count} notes saved`;
}
