/**
 * Printable Pet Planner — the 14 planner sections and the paper sizes.
 *
 * This is the one place the planner's sections are declared. The Customize
 * screen renders its toggles from here, the document builder switches on these
 * ids, the print/HTML template and the on-device preview both read the titles
 * and emoji from here — a section is added in one place and appears everywhere.
 *
 * Print-friendly by design: no images, no webfonts, emoji glyphs only (every
 * device renders those from its own font, offline).
 *
 * 100% offline: pure data, no storage, no network.
 */

/** A planner section the owner can switch on or off in the document. */
export type PlannerSectionId =
  | 'profile'
  | 'contacts'
  | 'feeding'
  | 'medication'
  | 'vaccination'
  | 'vet'
  | 'grooming'
  | 'weight'
  | 'exercise'
  | 'calendar'
  | 'expenses'
  | 'notes'
  | 'sitter'
  | 'emergency';

/** One section definition: its id, its human title and its emoji glyph. */
export interface PlannerSectionDef {
  id: PlannerSectionId;
  /** Section heading, e.g. "Feeding schedule". */
  title: string;
  /** Emoji glyph beside the heading (the document bundles no images). */
  emoji: string;
}

/**
 * Every planner section, in the order the document prints them.
 *
 * Order matters: profile first (who this pet is), then the day-to-day care
 * blocks, then planning (calendar, spending), then the written word, and
 * finally the emergency sheet — the page a sitter reaches for first.
 */
export const PLANNER_SECTIONS: readonly PlannerSectionDef[] = [
  { id: 'profile', title: 'Pet profile', emoji: '🐾' },
  { id: 'contacts', title: 'Important contacts', emoji: '📞' },
  { id: 'feeding', title: 'Feeding schedule', emoji: '🍽️' },
  { id: 'medication', title: 'Medication schedule', emoji: '💊' },
  { id: 'vaccination', title: 'Vaccination records', emoji: '💉' },
  { id: 'vet', title: 'Vet appointments', emoji: '🏥' },
  { id: 'grooming', title: 'Grooming', emoji: '✂️' },
  { id: 'weight', title: 'Weight tracker', emoji: '⚖️' },
  { id: 'exercise', title: 'Exercise & activity', emoji: '🎾' },
  { id: 'calendar', title: '12-month calendar', emoji: '📅' },
  { id: 'expenses', title: 'Expense tracker', emoji: '💰' },
  { id: 'notes', title: 'Notes & memories', emoji: '📔' },
  { id: 'sitter', title: 'Pet sitter instructions', emoji: '🧳' },
  { id: 'emergency', title: 'Emergency information', emoji: '🚨' },
];

/** Every section id, in print order — the default selection (all on). */
export const ALL_PLANNER_SECTION_IDS: PlannerSectionId[] = PLANNER_SECTIONS.map((s) => s.id);

/** Look one section up by id (undefined for an unknown id). */
export function plannerSection(id: PlannerSectionId): PlannerSectionDef | undefined {
  return PLANNER_SECTIONS.find((section) => section.id === id);
}

/** Keep only the known section ids, in canonical print order. */
export function normalizeSectionIds(ids: readonly PlannerSectionId[]): PlannerSectionId[] {
  const wanted = new Set(ids);
  return ALL_PLANNER_SECTION_IDS.filter((id) => wanted.has(id));
}

/**
 * Paper size. The HTML template carries the matching `@page` rule and a size
 * class, and `printToFileAsync` is asked for the matching pixel size where the
 * API allows it (72 PPI, so US Letter is 612×792 and A4 is 595×842).
 */
export type PaperSize = 'letter' | 'a4';

/** One paper size: its label, its CSS `@page` value and its pixel dimensions. */
export interface PaperSizeDef {
  id: PaperSize;
  /** Human label shown on the Customize screen, e.g. "US Letter (8.5 × 11 in)". */
  label: string;
  /** Short label, e.g. "US Letter". */
  short: string;
  /** The CSS `@page { size: … }` value. */
  cssPageSize: string;
  /** Page width in pixels at 72 PPI — what `printToFileAsync` wants. */
  widthPx: number;
  /** Page height in pixels at 72 PPI. */
  heightPx: number;
  /**
   * Page width in millimetres — used by the custom artwork sheet, which fills
   * the page edge to edge and therefore sets its own size in real units.
   */
  widthMm: number;
  /** Page height in millimetres. */
  heightMm: number;
}

/** The two supported paper sizes, in the order the Customize screen shows them. */
export const PAPER_SIZES: readonly PaperSizeDef[] = [
  {
    id: 'letter',
    label: 'US Letter · 8.5 × 11 in',
    short: 'US Letter',
    cssPageSize: 'letter portrait',
    widthPx: 612,
    heightPx: 792,
    widthMm: 215.9,
    heightMm: 279.4,
  },
  {
    id: 'a4',
    label: 'A4 · 210 × 297 mm',
    short: 'A4',
    cssPageSize: 'A4 portrait',
    widthPx: 595,
    heightPx: 842,
    widthMm: 210,
    heightMm: 297,
  },
];

/** Look a paper size up by id (defaults to US Letter for an unknown value). */
export function paperSizeDef(id: PaperSize): PaperSizeDef {
  return PAPER_SIZES.find((size) => size.id === id) ?? PAPER_SIZES[0];
}
