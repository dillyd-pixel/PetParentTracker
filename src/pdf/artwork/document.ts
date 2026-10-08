/**
 * Custom Pet Artwork — the document model.
 *
 * `buildArtworkDocument()` turns one pet, one treatment and the owner's own
 * words into a plain, serializable description of a single sheet of artwork.
 * It is deliberately dumb and pure: no React, no storage, no platform module,
 * so the same function can be exercised in Node against fixtures and the two
 * renderers (the on-screen canvas and the print HTML) can both read it.
 *
 * What goes on the sheet comes only from the owner's own data:
 *  - the pet's name, as they typed it;
 *  - the pet's own photo (passed in already resolved into something the
 *    renderer can load);
 *  - an optional caption in their own words.
 * Nothing is invented. A pet with no photo, or a caption left blank, prints the
 * honest thing instead — never placeholder text pretending to be the owner's.
 *
 * 100% offline: pure functions over local state. No fetch, no server, no AI —
 * the "artistic" part is the template, not a model.
 */
import type { Pet } from '../../types';
import { paperSizeDef, type PaperSize } from '../planner/sections';
import {
  ARTWORK_FOOTER,
  ARTWORK_KICKER,
  artworkTemplateOrDefault,
  type ArtworkTemplate,
  type ArtworkTemplateId,
} from './templates';

/** What the owner chose on the artwork screen. */
export interface ArtworkConfig {
  /** The pet the piece is about (null when there is nothing to draw). */
  petId: string | null;
  templateId: ArtworkTemplateId | string;
  paper: PaperSize;
  /** The owner's own words under the name ('' when they typed none). */
  caption: string;
  /**
   * The pet's photo, already resolved by the caller into a URI the renderer can
   * load: a `data:` URI on a device (so the printed sheet carries the photo),
   * or the picked blob/data URI in a browser. Null when there is no photo, or
   * when a local file could not be read — the sheet then says so honestly.
   */
  photo: string | null;
}

/** Everything the artwork is built from — the app's own stores, gathered. */
export interface ArtworkSource {
  pets: Pet[];
  /** The owner's own name from Settings, if they set one. */
  ownerName?: string;
}

/** One finished piece of artwork, ready to be drawn or printed. */
export interface ArtworkDocument {
  /** The treatment being used (its data drives both renderers). */
  template: ArtworkTemplate;
  /** The sheet it will be printed on. */
  paper: PaperSize;
  /** The pet's name in the owner's own words, or an honest fallback. */
  petName: string;
  /** "Custom artwork" — the small-caps line under the name. */
  kicker: string;
  /** The owner's own caption, trimmed ('' when they wrote none). */
  caption: string;
  /** The owner's name for the sign-off line, or '' when unset. */
  signedBy: string;
  /** The photo the renderer should load, or null. */
  photo: string | null;
  /** Whether a photo is actually being framed (drives the placeholder copy). */
  hasPhoto: boolean;
  /** The document title (also the browser frame's `<title>`). */
  title: string;
  /** The quiet line at the foot of the sheet. */
  footer: string;
}

/** The pets that can have artwork made — the ones with a photo on file. */
export function petsWithPhoto(pets: readonly Pet[]): Pet[] {
  return pets.filter((pet) => !!pet.photoUri);
}

/** The pets that cannot yet — listed honestly by the screen, never hidden. */
export function petsWithoutPhoto(pets: readonly Pet[]): Pet[] {
  return pets.filter((pet) => !pet.photoUri);
}

/** One pet by id, or null. */
function petById(pets: readonly Pet[], id: string | null): Pet | null {
  if (!id) return null;
  return pets.find((candidate) => candidate.id === id) ?? null;
}

/**
 * Build the piece for a configuration. Deterministic: the same source and
 * config always produce the same document.
 */
export function buildArtworkDocument(
  source: ArtworkSource,
  config: ArtworkConfig,
): ArtworkDocument {
  const template = artworkTemplateOrDefault(config.templateId);
  const pet = petById(source.pets, config.petId);
  const paper = paperSizeDef(config.paper);
  const petName = pet?.name?.trim() || 'Your pet';
  const caption = config.caption.trim().replace(/\s+/g, ' ');
  const photo = config.photo ?? null;

  return {
    template,
    paper: config.paper,
    petName,
    kicker: ARTWORK_KICKER,
    caption,
    signedBy: source.ownerName?.trim() ?? '',
    photo,
    hasPhoto: !!photo,
    title: pet ? `${pet.name} · custom artwork` : 'Custom pet artwork',
    footer: ARTWORK_FOOTER,
  };
}

/**
 * The one-line description of the piece shown on the artwork screen, e.g.
 * "Bella · Polaroid · US Letter".
 */
export function artworkSummary(doc: ArtworkDocument): string {
  const paper = paperSizeDef(doc.paper).short;
  return `${doc.petName} · ${doc.template.title} · ${paper}`;
}
