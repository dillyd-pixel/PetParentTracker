/**
 * Small display helpers shared by the Today, Pets, Records and Card screens.
 * Pure formatting of on-device data — no storage, no network.
 */
import type { Pet } from '../types';
import { AUTO_TIME_ZONE, formatDateOnlyInTimeZone } from './datetime';

/** Emoji avatar for a species (the app bundles no image assets). */
export function petEmoji(species: Pet['species']): string {
  if (species === 'Dog') return '🐶';
  if (species === 'Cat') return '🐱';
  return '🐾';
}

/**
 * The official species label for a pet: the owner's own species name when the
 * pet is an 'Other' pet and they typed one (e.g. "Bunny"), otherwise the plain
 * species ("Dog" / "Cat" / "Other"). This is the single place the species TEXT
 * is decided — `petEmoji` stays separate and untouched.
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
