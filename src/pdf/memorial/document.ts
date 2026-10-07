/**
 * Pet Memorial Book — the document model and its builder.
 *
 * `buildMemorialDocument()` is a PURE function: it takes the owner's already
 * loaded on-device records (the very same stores the rest of the app reads) for
 * ONE pet, the chosen sections and the paper size, and returns a
 * `MemorialDocument` — a structured description of the finished keepsake book.
 *
 * Two renderers consume that model, so the printed PDF and the on-device
 * preview can never drift apart:
 *  - `./html` turns it into the self-contained print HTML that `expo-print`
 *    renders to a PDF (and the browser prints directly);
 *  - `../../components/MemorialPaperView` renders it natively for the preview
 *    screen on a device, where no WebView is available.
 *
 * Honesty rules, the same ones the printable planner keeps:
 *  - Nothing is invented. Every line comes from a stored record, from an award
 *    the app actually recorded on its shelf, or from the owner's own words. A
 *    section with no data prints a warm, honest empty note — never a demo
 *    value, never a zero, never a guessed date.
 *  - A local photo cannot be embedded in an offline print document, so a picture
 *    is noted as being on the device ("photo on this device") and the book
 *    leaves a framed space for it on paper.
 *  - Where a date is the day the app noticed something rather than the day it
 *    happened (an award landing on the shelf), the wording says so: "kept on the
 *    shelf since …".
 *  - Tone: this is a keepsake, not a medical record. Dates, firsts, names and
 *    the owner's words — no diagnosis, no condition, no score, no pressure. An
 *    empty section is an invitation to write, never a telling-off.
 *
 * 100% offline: pure computation over local arrays — no fetch, no URLs.
 */
import type {
  CareCheckInEvent,
  CareCheckInType,
  JournalEntry,
  Pet,
  Vaccine,
  VetRecord,
} from '../../types';
import {
  CARE_CHECK_IN_EMOJI,
  CARE_CHECK_IN_LABELS,
  CARE_CHECK_IN_TYPES,
  isVetVisitLike,
  vetRecordKind,
} from '../../types';
import type { EarnedAward } from '../../storage/awards';
import { awardById } from '../../utils/gamification';
import {
  petAgeLabel,
  petEmojiFor,
  petSpeciesLabel,
  shortDate,
} from '../../utils/petDisplay';
import type { PaperSize } from '../planner/sections';
import {
  ALL_MEMORIAL_SECTION_IDS,
  JOURNAL_PRINT_LIMIT,
  MEMORIAL_SECTIONS,
  MEMORY_EXCERPT_CHARS,
  type MemorialSectionDef,
  type MemorialSectionId,
  normalizeMemorialSectionIds,
} from './sections';

/** How many memory cards (picture moments) print before the honest trim note. */
export const MEMORY_PRINT_LIMIT = 12;

/** How many characters of a journal body print per entry in the journal. */
export const JOURNAL_BODY_CHARS = 700;

/* ------------------------------------------------------------------ model ---- */

/** One label/value line (the cover facts, a celebration date). */
export interface MemorialKeyValue {
  label: string;
  value: string;
}

/** One entry in a bulleted block: a bold title, a small meta line, a note. */
export interface MemorialListItem {
  title: string;
  meta?: string;
  note?: string;
}

/** One dated moment on the lifetime timeline. */
export interface MemorialTimelineEntry {
  /** The ISO date the entry sorts on (YYYY-MM-DD). */
  date: string;
  /** How the date is printed, e.g. "9 Aug 2026". */
  dateLabel: string;
  /** A glyph for the kind of moment: 🎂, 🏡, 💉, 🏥, ⚖️, 🐾, 🏅. */
  emoji: string;
  /** The bold line, e.g. "Rabies (3-year)". */
  title: string;
  /** A quieter line under it. */
  meta?: string;
  /** A note in the owner's or the app's own words. */
  note?: string;
}

/**
 * One block of a section. The renderers switch on `kind`, so a new kind is a
 * compile error in both of them until it is handled.
 */
export type MemorialBlock =
  | {
      /** A paragraph. `muted` marks a warm empty note (printed italic). */
      kind: 'text';
      text: string;
      muted?: boolean;
    }
  /** A quiet sub-heading inside a section, e.g. "The facts". */
  | { kind: 'subheading'; text: string }
  /** A label/value table (the cover facts, the celebration dates). */
  | { kind: 'kv'; rows: MemorialKeyValue[] }
  /** A list of memories, milestones or journal entries. */
  | { kind: 'list'; items: MemorialListItem[] }
  /** The lifetime timeline, oldest first. */
  | { kind: 'timeline'; entries: MemorialTimelineEntry[]; note?: string }
  /** A framed photo space — where a printed photo is meant to go. */
  | { kind: 'frame'; text: string; tall?: boolean }
  /**
   * A letter: the owner's note, signed off. `muted` marks a page waiting for
   * words, and `ruleLines` draws write-in rules under it on paper.
   */
  | { kind: 'letter'; text: string; muted?: boolean; signOff?: string; ruleLines?: number };

/** One printed section: its heading and its blocks. */
export interface MemorialSectionContent {
  id: MemorialSectionId;
  title: string;
  emoji: string;
  blocks: MemorialBlock[];
}

/** The whole book, ready to render to HTML or to native views. */
export interface MemorialDocument {
  /** Document title, e.g. "Bella — a life worth remembering". */
  title: string;
  /** Kicker above the title (the brand line). */
  kicker: string;
  /** Generated-on + paper + offline line under the title. */
  subtitle: string;
  petName: string;
  petEmoji: string;
  /** Species · breed · age line under the pet's name. */
  petMeta: string;
  /** The sections included, in print order (the cover's "what's inside"). */
  sectionTitles: string[];
  paper: PaperSize;
  sections: MemorialSectionContent[];
}

/** Everything the builder reads — the owner's own stores, already loaded. */
export interface MemorialSource {
  pets: Pet[];
  /** The journal: one store for memories and written entries alike. */
  journal: JournalEntry[];
  checkIns: CareCheckInEvent[];
  vetRecords: VetRecord[];
  vaccines: Vaccine[];
  /** The awards shelf the app keeps (badges and milestones already earned). */
  awards: EarnedAward[];
  /** The owner's name as set in Settings — the note's sign-off. */
  ownerName: string;
  /** The chosen display time zone (`auto` = this device's own). */
  timeZone?: string;
}

/** What the owner chose on the Keep screen. */
export interface MemorialConfig {
  /** The one pet this book is about. */
  petId: string | null;
  /** The sections to include, in any order (normalized to print order). */
  sectionIds: readonly MemorialSectionId[];
  paper: PaperSize;
  /** The owner's own words for the "A note from you" section. Optional. */
  note?: string;
}

/* --------------------------------------------------------------- helpers ---- */

/** A warm, honest empty note — never a fabricated value. */
function empty(text: string): MemorialBlock {
  return { kind: 'text', text, muted: true };
}

/** A real summary line (not an empty note). */
function line(text: string): MemorialBlock {
  return { kind: 'text', text };
}

function subheading(text: string): MemorialBlock {
  return { kind: 'subheading', text };
}

/** Print a stored ISO calendar date as the owner typed it, or '—'. */
function dateText(iso: string | undefined, timeZone?: string): string {
  if (!iso) return '—';
  return shortDate(iso, timeZone);
}

/** An ISO timestamp (a moment) as its calendar day, or undefined. */
function dayOf(at: string | undefined): string | undefined {
  if (!at) return undefined;
  const day = at.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

/** Whole years between a stored date's year and today's, or null when unknown. */
function yearsSince(iso: string | undefined, today: Date): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const years = today.getFullYear() - Number(iso.slice(0, 4));
  return years > 0 ? years : null;
}

/** Local photos never embed in an offline print document — say so, honestly. */
function photoNote(photoUri?: string): string | undefined {
  return photoUri ? 'photo on this device' : undefined;
}

/** Join the parts of a meta line, dropping the empty ones. */
function metaLine(parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter((part): part is string => Boolean(part && part.trim()));
  return kept.length > 0 ? kept.join(' · ') : undefined;
}

/** Trim a written body to what prints, marking that it continues. */
function excerpt(body: string, limit: number): string {
  const text = body.trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** "3 memories" / "1 memory" — the tiny plural helper, in one place. */
function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Sort newest first by a date/time field (stable for equal values). */
function byDateDesc<T>(rows: T[], pick: (row: T) => string): T[] {
  return [...rows].sort((a, b) => pick(b).localeCompare(pick(a)));
}

/** Sort oldest first by a date/time field. */
function byDateAsc<T>(rows: T[], pick: (row: T) => string): T[] {
  return [...rows].sort((a, b) => pick(a).localeCompare(pick(b)));
}

/** One pet's records, filtered out of the whole-device collections. */
interface PetMemories {
  pet: Pet;
  journal: JournalEntry[];
  checkIns: CareCheckInEvent[];
  vetRecords: VetRecord[];
  vaccines: Vaccine[];
  /** That pet's awards shelf, oldest first. */
  awards: EarnedAward[];
}

function petMemories(pet: Pet, source: MemorialSource): PetMemories {
  return {
    pet,
    journal: source.journal.filter((entry) => entry.petId === pet.id),
    checkIns: source.checkIns.filter((event) => event.petId === pet.id),
    vetRecords: source.vetRecords.filter((record) => record.petId === pet.id),
    vaccines: source.vaccines.filter((vaccine) => vaccine.petId === pet.id),
    awards: byDateAsc(
      source.awards.filter((award) => award.petId === pet.id),
      (award) => award.earnedAt,
    ),
  };
}

/* -------------------------------------------------------------- sections ---- */

/** 🖼️ Cover photo — the title page's photo space and who this pet was. */
function coverBlocks(rec: PetMemories, today: Date, timeZone?: string): MemorialBlock[] {
  const { pet } = rec;
  const age = petAgeLabel(pet, today);
  const together = yearsSince(pet.adoptionDate, today);
  const rows: MemorialKeyValue[] = [
    { label: 'Name', value: pet.name },
    { label: 'Species', value: petSpeciesLabel(pet) },
    { label: 'Breed', value: pet.breed?.trim() ? pet.breed.trim() : '—' },
    { label: 'Born', value: dateText(pet.birthdate, timeZone) },
    { label: 'Came home', value: dateText(pet.adoptionDate, timeZone) },
    { label: 'Age', value: age || '—' },
    {
      label: 'Years together',
      value: together ? `${together} year${together === 1 ? '' : 's'}` : '—',
    },
  ];
  const blocks: MemorialBlock[] = [
    subheading('The photo'),
    {
      kind: 'frame',
      tall: true,
      text: pet.photoUri
        ? `📷 ${pet.name}'s photo is on this device — print it and set it in this frame.`
        : `A favourite photo of ${pet.name} belongs here.`,
    },
    subheading('The facts'),
    { kind: 'kv', rows },
  ];
  if (!pet.birthdate && !pet.adoptionDate && !pet.breed?.trim()) {
    blocks.push(
      empty(
        `Only the basics are on file for ${pet.name} yet — add their dates on the pet page and they print here next time.`,
      ),
    );
  }
  return blocks;
}

/** 📸 Memories — the journal entries that carry a picture or a chosen glyph. */
function memoryBlocks(rec: PetMemories, timeZone?: string): MemorialBlock[] {
  const { pet } = rec;
  if (rec.journal.length === 0) {
    return [
      empty(
        `A life worth remembering starts with a few words — nothing is written down for ${pet.name} yet. Memories you add in the journal print here.`,
      ),
    ];
  }

  const withPictures = byDateDesc(
    rec.journal.filter((entry) => !!entry.photoUri || !!entry.photoEmoji),
    (entry) => entry.entryDate,
  );
  if (withPictures.length === 0) {
    return [
      empty(
        `No memories with a picture yet. ${count(rec.journal.length, 'written entry is', 'written entries are')} on file, and their words print on the journal page of this book.`,
      ),
    ];
  }

  const printed = withPictures.slice(0, MEMORY_PRINT_LIMIT);
  const blocks: MemorialBlock[] = [
    line(
      `${count(withPictures.length, 'memory', 'memories')} with a picture on file — ${
        printed.length === 1 ? 'here it is.' : `the most recent ${printed.length} print below.`
      }`,
    ),
    {
      kind: 'list',
      items: printed.map((entry) => ({
        title: entry.title?.trim() ? entry.title.trim() : dateText(entry.entryDate, timeZone),
        meta: metaLine([
          dateText(entry.entryDate, timeZone),
          entry.mood,
          photoNote(entry.photoUri),
          entry.photoEmoji ? `glyph ${entry.photoEmoji}` : undefined,
        ]),
        note: excerpt(entry.body, MEMORY_EXCERPT_CHARS),
      })),
    },
  ];
  if (withPictures.length > printed.length) {
    blocks.push(
      empty(
        `${withPictures.length - printed.length} older ${
          withPictures.length - printed.length === 1 ? 'memory stays' : 'memories stay'
        } in the app, on this device — this book prints the most recent ${printed.length}.`,
      ),
    );
  }
  return blocks;
}

/** 📔 Journal entries — the written entries themselves, in the owner's words. */
function journalBlocks(rec: PetMemories, timeZone?: string): MemorialBlock[] {
  const { pet } = rec;
  const entries = byDateDesc(rec.journal, (entry) => entry.entryDate);
  if (entries.length === 0) {
    return [
      empty(
        `A life worth remembering starts with a few words — nothing is written down for ${pet.name} yet.`,
      ),
    ];
  }
  const printed = entries.slice(0, JOURNAL_PRINT_LIMIT);
  const blocks: MemorialBlock[] = [
    line(
      `${count(entries.length, 'journal entry', 'journal entries')} on file, in your own words — printed newest first.`,
    ),
    {
      kind: 'list',
      items: printed.map((entry) => ({
        title: entry.title?.trim() ? entry.title.trim() : dateText(entry.entryDate, timeZone),
        meta: metaLine([
          dateText(entry.entryDate, timeZone),
          entry.mood,
          photoNote(entry.photoUri),
        ]),
        note: excerpt(entry.body, JOURNAL_BODY_CHARS),
      })),
    },
  ];
  if (entries.length > printed.length) {
    blocks.push(
      empty(
        `The ${entries.length - printed.length} oldest ${
          entries.length - printed.length === 1 ? 'entry stays' : 'entries stay'
        } in the app to keep the book a keepsake — this book prints the most recent ${printed.length}.`,
      ),
    );
  }
  return blocks;
}

/** 🏅 Milestones & celebrations — the stored dates and the awards shelf. */
function milestoneBlocks(rec: PetMemories, today: Date, timeZone?: string): MemorialBlock[] {
  const { pet } = rec;
  const together = yearsSince(pet.adoptionDate, today);
  const age = petAgeLabel(pet, today);

  const blocks: MemorialBlock[] = [subheading('Celebrations')];
  const celebrationRows: MemorialKeyValue[] = [
    pet.birthdate
      ? { label: 'Birthday', value: dateText(pet.birthdate, timeZone) }
      : null,
    pet.adoptionDate
      ? { label: 'Gotcha day', value: dateText(pet.adoptionDate, timeZone) }
      : null,
    together ? { label: 'Years together', value: `${together}` } : null,
    age ? { label: 'Age today', value: age } : null,
  ].filter((row): row is MemorialKeyValue => row !== null);

  blocks.push(
    celebrationRows.length > 0
      ? { kind: 'kv', rows: celebrationRows }
      : empty(
          `No birthday or gotcha day stored for ${pet.name} yet — add the dates on the pet page and they print here, year after year.`,
        ),
  );

  blocks.push(subheading('Milestones earned'));
  if (rec.awards.length === 0) {
    blocks.push(
      empty(
        `No milestones on ${pet.name}'s shelf yet. They arrive on their own as records are kept — nothing here is invented.`,
      ),
    );
  } else {
    blocks.push({
      kind: 'list',
      items: rec.awards.map((award) => {
        const def = awardById(award.awardId);
        const day = dayOf(award.earnedAt);
        return {
          title: `${def?.emoji ?? '🏅'} ${def?.title ?? award.awardId}`,
          meta: metaLine([
            day ? `kept on the shelf since ${shortDate(day, timeZone)}` : undefined,
            award.kind === 'badge' ? 'badge' : 'milestone',
          ]),
          note: def?.blurb,
        };
      }),
    });
  }
  return blocks;
}

/**
 * Award ids whose moment the pet's own records already put on the timeline —
 * the first care act, the first walk, the first clinic visit and the first
 * vaccination. The timeline skips those shelved entries so a "first" is not
 * printed twice on one page; they still print in full on the milestones page,
 * where the shelf itself is the subject.
 */
const RECORD_DERIVED_AWARDS = new Set([
  'first-check-in',
  'first-walk',
  'first-vet-visit',
  'vaccine-hero',
]);

/** Is this award's moment already on the timeline, straight from the records? */
function recordDerivedAward(awardId: string): boolean {
  return RECORD_DERIVED_AWARDS.has(awardId);
}

/** 🕰️ Lifetime timeline — every dated record, oldest first. */
function timelineBlocks(rec: PetMemories, today: Date, timeZone?: string): MemorialBlock[] {
  const { pet } = rec;
  const moments: MemorialTimelineEntry[] = [];
  /** Which kinds of moment had to be trimmed, for the honest closing note. */
  let trimmed = false;

  const push = (entry: MemorialTimelineEntry): void => {
    moments.push(entry);
  };

  /* ---- the beginning ---- */
  if (pet.birthdate) {
    push({
      date: pet.birthdate,
      dateLabel: shortDate(pet.birthdate, timeZone),
      emoji: '🎂',
      title: 'Born',
      note: 'Where the story starts.',
    });
  }
  if (pet.adoptionDate) {
    const together = yearsSince(pet.adoptionDate, today);
    push({
      date: pet.adoptionDate,
      dateLabel: shortDate(pet.adoptionDate, timeZone),
      emoji: '🏡',
      title: 'Came home',
      meta: together ? `${together} year${together === 1 ? '' : 's'} together` : undefined,
      note: 'The day the family grew.',
    });
  }

  /* ---- the records: vaccinations ---- */
  const shots = byDateAsc(rec.vaccines, (v) => v.dateGiven);
  for (const shot of shots.slice(0, 12)) {
    push({
      date: shot.dateGiven,
      dateLabel: shortDate(shot.dateGiven, timeZone),
      emoji: '💉',
      title: shot.name,
      meta: shot.notes?.trim() ? excerpt(shot.notes, 100) : undefined,
      note: shot.dueDate ? `Next due ${shortDate(shot.dueDate, timeZone)}.` : undefined,
    });
  }
  if (shots.length > 12) trimmed = true;

  /* ---- the records: clinic visits ---- */
  const visits = byDateAsc(
    rec.vetRecords.filter((record) => isVetVisitLike(record) && vetRecordKind(record) === 'visit'),
    (record) => record.visitDate,
  );
  for (const visit of visits.slice(0, 12)) {
    push({
      date: visit.visitDate,
      dateLabel: shortDate(visit.visitDate, timeZone),
      emoji: '🏥',
      title: visit.visitTitle,
      meta: metaLine([visit.clinicName?.trim(), visit.veterinarian?.trim()]),
      note: visit.notes?.trim() ? excerpt(visit.notes, 160) : undefined,
    });
  }
  if (visits.length > 12) trimmed = true;

  /* ---- the records: the weigh-in the app keeps ---- */
  const weighedOn = pet.weightUpdatedAt && /^\d{4}-\d{2}-\d{2}$/.test(pet.weightUpdatedAt)
    ? pet.weightUpdatedAt
    : undefined;
  if (weighedOn && typeof pet.weight === 'number') {
    push({
      date: weighedOn,
      dateLabel: shortDate(weighedOn, timeZone),
      emoji: '⚖️',
      title: `Weighed ${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`,
      note: 'The weigh-in on file.',
    });
  }

  /* ---- the records: the first of each kind of care act ---- */
  for (const type of CARE_CHECK_IN_TYPES) {
    const ofType = byDateAsc(
      rec.checkIns.filter((event) => event.type === type),
      (event) => event.at,
    );
    const first = ofType[0];
    const day = first ? dayOf(first.at) : undefined;
    if (!first || !day) continue;
    push({
      date: day,
      dateLabel: shortDate(day, timeZone),
      emoji: CARE_CHECK_IN_EMOJI[type],
      title: `First ${careActLabel(type)} check-in`,
      meta: `${count(ofType.length, 'care act', 'care acts')} recorded`,
      note: 'One tap said it happened.',
    });
  }

  /* ---- the shelf: the milestones the app noticed ---- */
  for (const award of rec.awards) {
    // A "first" that the records above already put on the timeline would only
    // repeat itself here — the shelf entry is skipped for those, and kept for
    // every milestone that exists nowhere else (streaks, the 100th check-in,
    // a co-parent joining, and any award this version no longer ships).
    if (recordDerivedAward(award.awardId)) continue;
    const def = awardById(award.awardId);
    const day = dayOf(award.earnedAt);
    if (!day) continue;
    push({
      date: day,
      dateLabel: shortDate(day, timeZone),
      emoji: def?.emoji ?? '🏅',
      title: def?.title ?? award.awardId,
      meta: `${award.kind} noted on the shelf`,
      note: def?.blurb,
    });
  }

  if (moments.length === 0) {
    return [
      empty(
        `No dated records on file yet — a birthday, a gotcha day or a first check-in puts the first line on ${pet.name}'s timeline.`,
      ),
    ];
  }

  const ordered = byDateAsc(moments, (moment) => moment.date).slice(0, 60);
  const pushed = moments.length;
  const blocks: MemorialBlock[] = [
    line(
      `${count(pushed, 'dated moment', 'dated moments')} on file, oldest first — the whole life story this device knows.`,
    ),
    {
      kind: 'timeline',
      entries: ordered,
      note:
        trimmed || pushed > ordered.length
          ? 'Showing the first 12 of each kind — everything else stays in the app, on this device.'
          : undefined,
    },
  ];
  return blocks;
}

/** "Food" / "Water" / … — the care act in the timeline's own words. */
function careActLabel(type: CareCheckInType): string {
  return CARE_CHECK_IN_LABELS[type].toLowerCase();
}

/** 💌 A note from you — the owner's own words, printed as a letter. */
function noteBlocks(config: MemorialConfig, ownerName: string): MemorialBlock[] {
  const text = config.note?.trim();
  if (!text) {
    return [
      {
        kind: 'letter',
        muted: true,
        text: 'Nothing written yet — a few words of your own will print here. This page is yours.',
        ruleLines: 8,
      },
    ];
  }
  return [
    {
      kind: 'letter',
      text,
      signOff: ownerName.trim() ? `— ${ownerName.trim()}` : undefined,
    },
  ];
}

/* -------------------------------------------------------------- document ---- */

/** Build the blocks for one section id (the switch every section flows through). */
function sectionBlocks(
  id: MemorialSectionId,
  rec: PetMemories,
  config: MemorialConfig,
  source: MemorialSource,
  today: Date,
): MemorialBlock[] {
  switch (id) {
    case 'cover':
      return coverBlocks(rec, today, source.timeZone);
    case 'memories':
      return memoryBlocks(rec, source.timeZone);
    case 'journal':
      return journalBlocks(rec, source.timeZone);
    case 'milestones':
      return milestoneBlocks(rec, today, source.timeZone);
    case 'timeline':
      return timelineBlocks(rec, today, source.timeZone);
    case 'note':
      return noteBlocks(config, source.ownerName);
    default:
      return [empty('This page has nothing to print yet.')];
  }
}

/** A friendly name for the file / the cover when there is no pet yet. */
const UNNAMED_TITLE = 'A life worth remembering';

/**
 * Build the complete memorial book for one pet, the chosen sections and paper.
 *
 * Sections print in the canonical order, and a section the owner turned off is
 * simply absent — never printed as a stub. With no pet chosen (or no pets at
 * all) the document is a title-only book rather than a crash: the screens guard
 * against that case, and the builder never invents a pet to fill the gap.
 */
export function buildMemorialDocument(
  source: MemorialSource,
  config: MemorialConfig,
  now: Date = new Date(),
): MemorialDocument {
  const pet =
    source.pets.find((candidate) => candidate.id === config.petId) ?? source.pets[0] ?? null;
  const sectionIds = normalizeMemorialSectionIds(
    config.sectionIds.length > 0 ? config.sectionIds : ALL_MEMORIAL_SECTION_IDS,
  );
  const defs = sectionIds
    .map((id) => MEMORIAL_SECTIONS.find((section) => section.id === id))
    .filter((def): def is MemorialSectionDef => Boolean(def));

  const generatedOn = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const paperLabel = config.paper === 'a4' ? 'A4' : 'US Letter';
  const subtitle = `Kept on this device · printed ${generatedOn} · ${paperLabel} · 100% offline — nothing left your phone.`;

  if (!pet) {
    return {
      title: UNNAMED_TITLE,
      kicker: 'Pet Parent Tracker · The Blueprint',
      subtitle,
      petName: '',
      petEmoji: '🐾',
      petMeta: '',
      sectionTitles: [],
      paper: config.paper,
      sections: [],
    };
  }

  const rec = petMemories(pet, source);
  const meta = metaLine([petSpeciesLabel(pet), pet.breed?.trim(), petAgeLabel(pet, now)]);

  return {
    title: `${pet.name} — a life worth remembering`,
    kicker: 'Pet Parent Tracker · The Blueprint',
    subtitle,
    petName: pet.name,
    petEmoji: petEmojiFor(pet),
    petMeta: meta ?? petSpeciesLabel(pet),
    sectionTitles: defs.map((def) => def.title),
    paper: config.paper,
    sections: defs.map((def) => ({
      id: def.id,
      title: def.title,
      emoji: def.emoji,
      blocks: sectionBlocks(def.id, rec, config, source, now),
    })),
  };
}

/** The pet's own one-line identity, as the book's cover shows it. */
export function memorialCoverMeta(pet: Pet, now: Date = new Date()): string {
  return metaLine([petSpeciesLabel(pet), pet.breed?.trim(), petAgeLabel(pet, now)]) ?? petSpeciesLabel(pet);
}

/* --------------------------------------------------------------- summary ---- */

/**
 * What the book would have to draw on for one pet — used by the Keep screen's
 * pet picker to mark a pet that already has memories, a photo or milestones.
 * Counted from the same stores the book reads, so the marker and the book can
 * never disagree, and a pet with nothing on file is honestly counted as zero.
 */
export interface MemorialContentSummary {
  /** Written journal entries (memories and notes alike). */
  journal: number;
  /** Of those, the ones carrying a picture or a chosen glyph. */
  pictures: number;
  /** Badges and milestones already on the pet's shelf. */
  milestones: number;
  /** Dated records: vaccinations, clinic visits, and a weigh-in on file. */
  records: number;
  /** A photo of the pet themselves. */
  petPhoto: number;
  /** Everything the book could draw on, added up. */
  total: number;
}

/** Count the material one pet's book would use. Pure — reads only local arrays. */
export function memorialContentSummary(pet: Pet, source: MemorialSource): MemorialContentSummary {
  const rec = petMemories(pet, source);
  const journal = rec.journal.length;
  const pictures = rec.journal.filter((entry) => !!entry.photoUri || !!entry.photoEmoji).length;
  const milestones = rec.awards.length;
  const records =
    rec.vaccines.length +
    rec.vetRecords.filter((record) => isVetVisitLike(record)).length +
    (pet.weightUpdatedAt && typeof pet.weight === 'number' ? 1 : 0);
  const petPhoto = pet.photoUri ? 1 : 0;
  return {
    journal,
    pictures,
    milestones,
    records,
    petPhoto,
    total: journal + milestones + records + petPhoto,
  };
}
