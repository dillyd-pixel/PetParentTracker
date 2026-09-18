/**
 * Small display helpers shared by the Today, Pets, Records and Card screens.
 * Pure formatting of on-device data — no storage, no network.
 */
import type { Pet } from '../types';
import { AUTO_TIME_ZONE, formatDateOnlyInTimeZone } from './datetime';

/**
 * Species → emoji face, keyed by the lowercased species label.
 *
 * Emoji-only by design: the app bundles NO image assets (it stays 100% offline,
 * so nothing is ever fetched and nothing has to be downloaded), and an emoji
 * glyph is rendered by the device's own font at whatever size the layout asks
 * for — a cute big face on the photo plate, a small one in a list avatar.
 */
const SPECIES_EMOJI: Record<string, string> = {
  dog: '🐶',
  cat: '🐱',
  bird: '🐦',
  parrot: '🦜',
  chicken: '🐔',
  duck: '🦆',
  fish: '🐟',
  bunny: '🐰',
  rabbit: '🐰',
  hamster: '🐹',
  mouse: '🐭',
  rat: '🐀',
  frog: '🐸',
  horse: '🐴',
  cow: '🐮',
  pig: '🐷',
  goat: '🐐',
  sheep: '🐑',
  lizard: '🦎',
  snake: '🐍',
  turtle: '🐢',
  tortoise: '🐢',
};
/**
 * The pet's own animal as an emoji, for every placeholder that stands in for a
 * photo the owner has not added yet (the photo plate on the pet profile and the
 * add/edit form, the list/avatar thumbs, the emergency card).
 *
 * Resolves through `petSpeciesLabel`, so a built-in species ("Dog" → 🐶) and a
 * typed custom species ("Bunny" / "bunny" / "FISH" → 🐰 / 🐟) both work: the
 * label is trimmed and lowercased before the lookup. An 'Other' pet with no
 * custom name — or a species we have no glyph for — falls back to the generic
 * paw print 🐾.
 */
export function petEmojiFor(pet: Pick<Pet, 'species' | 'customSpecies'>): string {
  const label = petSpeciesLabel(pet).trim().toLowerCase();
  return SPECIES_EMOJI[label] ?? '🐾';
}

/**
 * The official species label for a pet: the owner's own species name when the
 * pet is an 'Other' pet and they typed one (e.g. "Bunny"), otherwise the plain
 * species ("Dog" / "Cat" / "Other"). This is the single place the species TEXT
 * is decided — `petEmojiFor` reads it for the picture placeholder too, so the
 * face and the label can never disagree.
 */
export function petSpeciesLabel(pet: Pick<Pet, 'species' | 'customSpecies'>): string {
  if (pet.species === 'Other') {
    const custom = pet.customSpecies?.trim();
    if (custom) return custom;
  }
  return pet.species;
}

/** Weight with its unit, e.g. "31 kg" — empty string when unset. */
export function petWeightLabel(pet: Pet): string {
  if (typeof pet.weight !== 'number') return '';
  return `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`;
}

/** One-line meta under a pet's name, e.g. "Dog · Golden retriever · 31 kg". */
export function petMetaLine(pet: Pet): string {
  const parts: string[] = [petSpeciesLabel(pet)];
  if (pet.breed) parts.push(pet.breed);
  const weight = petWeightLabel(pet);
  if (weight) parts.push(weight);
  return parts.join(' · ');
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * ISO date (YYYY-MM-DD) → "9 Aug 2026"; falls back to the raw value.
 *
 * A stored date is a calendar fact, not a moment in time: the date the owner
 * typed is the date they see, so passing a `timeZone` never shuffles it onto
 * the neighbouring day (see `formatDateOnlyInTimeZone`, which anchors it at
 * midday). Without a zone — or with `auto` — this is the original fast path
 * that needs no `Intl` at all.
 */
export function shortDate(iso: string, timeZone?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  if (timeZone && timeZone !== AUTO_TIME_ZONE) {
    const inZone = formatDateOnlyInTimeZone(iso, timeZone);
    if (inZone) return inZone;
  }
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1] ?? month} ${year}`;
}

/** Today as an ISO date — the default for new records. */
export function todayISO(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The current month's name, e.g. "September" — used by the spend snapshot. */
export function monthName(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: 'long' });
}
