/**
 * Printable care binder (HANDOFF, unit 3 of 3) — the binder's sections.
 *
 * A binder is not a planner: it is the pet's whole care file, assembled in one
 * tap from the records that are already on the device, printed to hand to a
 * sitter, a vet or family. So its sections are exactly the owner's brief —
 * profile, health, records, expenses, care instructions — with nothing to
 * switch on or off.
 *
 * The binder prints through the SAME engine as the Printable Pet Planner: the
 * same `PlannerBlock` document model, the same print HTML renderer, the same
 * paper sizes and the same on-device PDF file actions. This file only declares
 * which sections exist; `./document` fills them from real records.
 *
 * 100% offline: pure data, no storage, no network.
 */

/** One binder section the care file always carries, in print order. */
export type BinderSectionId = 'profile' | 'health' | 'records' | 'expenses' | 'care';

/** One section definition: its id, its heading and its emoji glyph. */
export interface BinderSectionDef {
  id: BinderSectionId;
  /** Section heading, e.g. "Health summary". */
  title: string;
  /** Emoji glyph beside the heading (the document bundles no images). */
  emoji: string;
}

/**
 * Every binder section, in the order the care file prints them.
 *
 * Profile first (who this pet is), then what a vet or a sitter must know about
 * their health, then the visit history, then what the care has cost, and
 * finally how to actually look after them day to day.
 */
export const BINDER_SECTIONS: readonly BinderSectionDef[] = [
  { id: 'profile', title: 'Pet profile', emoji: '🐾' },
  { id: 'health', title: 'Health summary', emoji: '🩺' },
  { id: 'records', title: 'Vet records', emoji: '🏥' },
  { id: 'expenses', title: 'Costs on file', emoji: '💰' },
  { id: 'care', title: 'Care instructions', emoji: '🧳' },
];

/** Every binder section id, in print order. */
export const ALL_BINDER_SECTION_IDS: BinderSectionId[] = BINDER_SECTIONS.map(
  (section) => section.id,
);

/**
 * Keep only the known section ids, in canonical print order.
 *
 * The binder itself always prints every section (a care file with a hole in it
 * is worse than useless), but the normalizer exists so a caller — a future
 * "leave out costs" option, the preview's own summary — can ask for a subset
 * without ever inventing an id.
 */
export function normalizeBinderSectionIds(
  ids: readonly BinderSectionId[],
): BinderSectionId[] {
  const wanted = new Set(ids);
  return ALL_BINDER_SECTION_IDS.filter((id) => wanted.has(id));
}
