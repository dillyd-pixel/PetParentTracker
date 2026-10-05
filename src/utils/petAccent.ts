/**
 * Per-pet accent colours for the Command Center (design Phase B1).
 *
 * The owner's direction gives every pet its own colour, drawn from the core
 * palette, so the crew carousel, the selected pet's hero band and the status
 * pill all agree at a glance. The colour is derived from the pet's id by a
 * stable hash, so:
 *
 *  - the same pet always gets the same colour (no stored field to migrate, and
 *    nothing to keep in sync when a pet is renamed or re-photographed);
 *  - two pets rarely collide, and a third pet created later still gets a colour
 *    from the same seven-hue cycle.
 *
 * Each accent carries the three tones the UI needs, mirroring `TONE` in the
 * theme: `fill` for the hero gradient / avatar ring / ticked tile, `soft` for
 * the pill's fill, and `ink` for text on that soft fill (a deep, readable member
 * of the same hue family — never a saturated hue straight onto white).
 *
 * 100% offline and dependency-free: pure colour maths over theme tokens.
 */
import { COLOR } from '../theme';

/** One pet accent, in the three tones the UI composes with. */
export interface PetAccent {
  /** The saturated hue: hero gradient, avatar ring, ticked tile. */
  fill: string;
  /** Translucent fill for the status pill and other soft surfaces. */
  soft: string;
  /** A deep, readable member of the hue family, for text on `soft`. */
  ink: string;
}

/**
 * The seven-hue cycle a pet's accent is drawn from. Ordered so neighbouring
 * pets in the crew carousel look clearly different.
 */
export const PET_ACCENTS: PetAccent[] = [
  { fill: COLOR.blue, soft: 'rgba(36,107,253,0.12)', ink: COLOR.accent700 },
  { fill: COLOR.aqua, soft: 'rgba(49,215,215,0.18)', ink: '#0F7C7C' },
  { fill: COLOR.lavender, soft: 'rgba(155,120,255,0.18)', ink: COLOR.premiumDeep },
  { fill: COLOR.tangerine, soft: 'rgba(255,149,72,0.18)', ink: '#A05212' },
  { fill: COLOR.leaf, soft: 'rgba(85,201,141,0.20)', ink: '#1C7A4B' },
  { fill: COLOR.coral, soft: 'rgba(255,107,120,0.16)', ink: COLOR.accent2_700 },
  { fill: COLOR.sunshine, soft: 'rgba(255,216,77,0.30)', ink: '#7E5A0B' },
];

/** The accent used when there is no pet to colour with (the app's own blue). */
export const DEFAULT_ACCENT: PetAccent = PET_ACCENTS[0];

/**
 * A stable 32-bit hash of an id — the whole reason the colour is deterministic.
 * `hash * 31 + charCode` is the classic djb2-style mix: cheap, and spread well
 * enough for ids of the shape `m9x2hp-4kq81z`.
 */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** The accent for a pet id — always the same pet, always the same colour. */
export function petAccent(petId: string): PetAccent {
  if (!petId) return DEFAULT_ACCENT;
  return PET_ACCENTS[hashId(petId) % PET_ACCENTS.length];
}

/**
 * A `#RRGGBB` token at a given alpha, as `rgba(...)` — the one helper the
 * gradient bands and soft overlays need, since `expo-linear-gradient` takes
 * colour strings and the theme's hexes carry no alpha.
 *
 * Anything that is not a plain 6-digit hex (an `rgba()` token, a named colour)
 * is returned unchanged, so a caller can pass any colour safely.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${a})`;
}
