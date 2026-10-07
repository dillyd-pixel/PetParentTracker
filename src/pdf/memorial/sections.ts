/**
 * Pet Memorial Book — the book's sections.
 *
 * This is the one place the memorial book's sections are declared. The Keep
 * screen renders its toggles from here, the document builder switches on these
 * ids, and both renderers (the print/HTML template and the on-device preview)
 * read the titles and emoji from here — a section is added in one place and
 * appears everywhere.
 *
 * Paper size is deliberately NOT redeclared: the memorial book prints on the
 * same two sheets as the printable pet planner, so `PaperSize`, `PAPER_SIZES`
 * and `paperSizeDef` are imported from `../planner/sections` — one definition
 * of "US Letter" and "A4" for every keepsake the app makes.
 *
 * Print-friendly by design: no images, no webfonts, emoji glyphs only (every
 * device renders those from its own font, offline).
 *
 * 100% offline: pure data, no storage, no network.
 */

/** A memorial-book section the owner can switch on or off in the book. */
export type MemorialSectionId =
  | 'cover'
  | 'memories'
  | 'journal'
  | 'milestones'
  | 'timeline'
  | 'note';

/** One section definition: its id, its human title and its emoji glyph. */
export interface MemorialSectionDef {
  id: MemorialSectionId;
  /** Section heading, e.g. "Lifetime timeline". */
  title: string;
  /** Emoji glyph beside the heading (the book bundles no images). */
  emoji: string;
  /** The one-line invitation shown beside the toggle on the Keep screen. */
  hint: string;
}

/**
 * Every section of the memorial book, in the order the book prints them.
 *
 * Order matters and follows the shape of a book: who they were (cover), then
 * the moments (photos, then words), then what they earned and the life story
 * that puts every date in one thread, and last the owner's own note — the page
 * that is really the reason the book exists.
 */
export const MEMORIAL_SECTIONS: readonly MemorialSectionDef[] = [
  {
    id: 'cover',
    title: 'Cover photo',
    emoji: '🖼️',
    hint: 'The title page, a framed photo and the facts of who they were.',
  },
  {
    id: 'memories',
    title: 'Memories',
    emoji: '📸',
    hint: 'The moments that carry a picture or a chosen glyph.',
  },
  {
    id: 'journal',
    title: 'Journal entries',
    emoji: '📔',
    hint: 'What you wrote at the time, in your own words.',
  },
  {
    id: 'milestones',
    title: 'Milestones & celebrations',
    emoji: '🏅',
    hint: 'Birthdays, gotcha days and the milestones already earned.',
  },
  {
    id: 'timeline',
    title: 'Lifetime timeline',
    emoji: '🕰️',
    hint: 'Every dated record in one chronological thread.',
  },
  {
    id: 'note',
    title: 'A note from you',
    emoji: '💌',
    hint: 'A few words of your own, printed as a letter.',
  },
];

/** Every section id, in print order — the default selection (all on). */
export const ALL_MEMORIAL_SECTION_IDS: MemorialSectionId[] = MEMORIAL_SECTIONS.map(
  (section) => section.id,
);

/** Look one section up by id (undefined for an unknown id). */
export function memorialSection(id: MemorialSectionId): MemorialSectionDef | undefined {
  return MEMORIAL_SECTIONS.find((section) => section.id === id);
}

/** Keep only the known section ids, in canonical print order. */
export function normalizeMemorialSectionIds(
  ids: readonly MemorialSectionId[],
): MemorialSectionId[] {
  const wanted = new Set(ids);
  return ALL_MEMORIAL_SECTION_IDS.filter((id) => wanted.has(id));
}

/** How many characters of a journal body are printed on a memory card. */
export const MEMORY_EXCERPT_CHARS = 240;

/** How many journal entries print in full before the honest trim note. */
export const JOURNAL_PRINT_LIMIT = 24;

/** How many recorded dates of any one kind the timeline prints. */
export const TIMELINE_KIND_LIMIT = 12;
