/**
 * Small display helpers shared by the Today, Pets, Records and Card screens.
 * Pure formatting of on-device data — no storage, no network.
 */
import type { Pet } from '../types';

/** Emoji avatar for a species (the app bundles no image assets). */
export function petEmoji(species: Pet['species']): string {
  if (species === 'Dog') return '🐶';
  if (species === 'Cat') return '🐱';
  return '🐾';
}

/** Weight with its unit, e.g. "31 kg" — empty string when unset. */
export function petWeightLabel(pet: Pet): string {
  if (typeof pet.weight !== 'number') return '';
  return `${pet.weight.toLocaleString()} ${pet.weightUnit ?? 'kg'}`;
}

/** One-line meta under a pet's name, e.g. "Dog · Golden retriever · 31 kg". */
export function petMetaLine(pet: Pet): string {
  const parts = [pet.species];
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

/** ISO date (YYYY-MM-DD) → "9 Aug 2026"; falls back to the raw value. */
export function shortDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS_SHORT[Number(month) - 1] ?? month} ${year}`;
}

/** Today as an ISO date — the default for new records. */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The current month's name, e.g. "September" — used by the spend snapshot. */
export function monthName(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { month: 'long' });
}
