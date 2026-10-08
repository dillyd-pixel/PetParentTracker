/**
 * Custom Pet Artwork — the artistic templates.
 *
 * This is the ONE place a treatment is declared. Both renderers read the same
 * data and draw the same picture:
 *  - the on-screen canvas (`src/components/ArtworkCanvas.tsx`) draws it with
 *    React Native views + `expo-linear-gradient`;
 *  - the print template (`./html`) turns the same data into inline CSS, which is
 *    what `expo-print` renders into the PDF and what the browser preview shows.
 * So a new treatment — or a tweak to one — is made once, here, and appears in
 * the preview, the thumbnails and the printed page together.
 *
 * Geometry rule (keeps the two renderers honest): every width, size, radius,
 * font size and gap is a FRACTION OF THE CANVAS WIDTH (`em` on the sheet is 1%
 * of it), every layer's `x` is a fraction of the width and its `y` a fraction
 * of the height, both measured to the layer's TOP-LEFT corner (exactly what
 * CSS `left` / `top` mean, and what the canvas' absolutely-positioned views
 * mean too). Nothing is in pixels or points, so the same numbers lay out a 92pt
 * thumbnail, a phone-sized preview and a full US-Letter sheet identically.
 *
 * Offline by design: pure data. No images, no webfonts, no scripts — the only
 * glyphs are emoji, which each device draws from its own font. Nothing here
 * fetches anything.
 *
 * Colour: the hexes below mirror `src/theme.ts` (Blueprint Blue #246BFD, Aqua
 * #31D7D7, Sunshine #FFD84D, Coral #FF6B78, Lavender #9B78FF, Leaf #55C98D,
 * Tangerine #FF9548, Deep Ink #202126) exactly as the other keepsake print
 * templates do — the printed sheet is a self-contained artifact, so it carries
 * its own copy of the palette rather than importing the RN theme module.
 */

/** The treatments a pet's photo can be framed in. */
export type ArtworkTemplateId =
  | 'polaroid'
  | 'watercolor'
  | 'midnight'
  | 'golden'
  | 'pawframe';

/**
 * A soft translucent colour splotch (the watercolour wash) — the same shape and
 * placement on screen and on paper. On screen it is built from three
 * concentric translucent discs (no blur dependency); in CSS it is one soft
 * radial gradient. Both read as the same painted blot.
 */
export interface ArtworkBlobLayer {
  kind: 'blob';
  color: string;
  /** Peak opacity of the wash (0–1). */
  opacity: number;
  /** Diameter as a fraction of the canvas width. */
  size: number;
  /** Top-left corner: fraction of the width / of the height (may be negative
   *  or push the shape off the canvas — it is clipped at the edge). */
  x: number;
  y: number;
}

/** A rotated translucent bar — the "soft beams" of the golden wash. */
export interface ArtworkBeamLayer {
  kind: 'beam';
  color: string;
  opacity: number;
  /** Length as a fraction of the canvas width. */
  width: number;
  /** Length ÷ thickness of the bar. */
  aspect: number;
  x: number;
  y: number;
  /** Rotation in degrees. */
  rotate: number;
}

/** An emoji glyph placed on the canvas (paw prints, sparkles, a sun). */
export interface ArtworkGlyphLayer {
  kind: 'glyph';
  glyph: string;
  color: string;
  opacity: number;
  /** Font size as a fraction of the canvas width. */
  size: number;
  x: number;
  y: number;
  rotate?: number;
}

/** A single round dot — the constellation points of the midnight sky. */
export interface ArtworkDotLayer {
  kind: 'dot';
  color: string;
  opacity: number;
  /** Diameter as a fraction of the canvas width. */
  size: number;
  x: number;
  y: number;
}

/**
 * The edge darkening that makes a flat backdrop feel printed rather than
 * pasted. Drawn as four edge gradients (never a radial vignette) so the screen
 * and the sheet can produce the same thing with the primitives both have.
 */
export interface ArtworkVignetteLayer {
  kind: 'vignette';
  /** Opacity of the darkest edge (0–1). */
  strength: number;
  /** How far in from each edge the darkening reaches (% of the size). */
  reach: number;
}

/** Any decorative layer a template paints over its backdrop. */
export type ArtworkLayer =
  | ArtworkBlobLayer
  | ArtworkBeamLayer
  | ArtworkGlyphLayer
  | ArtworkDotLayer
  | ArtworkVignetteLayer;

/** How the photo itself is framed. */
export type ArtworkFrameShape = 'square' | 'circle' | 'arch';

/** The frame the pet's photo sits in. */
export interface ArtworkFrame {
  /** Frame width as a fraction of the canvas width. */
  width: number;
  /** Frame width ÷ frame height (the whole box, mat and strip included). */
  aspect: number;
  /** The photo's own shape inside the mat. */
  shape: ArtworkFrameShape;
  /** Mat width as a fraction of the canvas width. */
  mat: number;
  /** The mat's fill. */
  matColor: string;
  /** A hairline ring hugging the mat (printed as a border). */
  ring: { color: string; width: number };
  /** Tilt in degrees (the polaroid is the only one that leans). */
  tilt: number;
  /** A polaroid-style strip under the photo, holding the caption. */
  strip: boolean;
  /** Strip height as a fraction of the canvas width (strip templates only). */
  stripHeight: number;
  /** Where the caption sits: in the strip, or centred below the frame. */
  captionPlacement: 'strip' | 'below';
  /** Drop-shadow strength (0 = flat). */
  depth: number;
}

/** One complete artistic treatment. */
export interface ArtworkTemplate {
  id: ArtworkTemplateId;
  /** The name shown on the template picker, e.g. "Polaroid". */
  title: string;
  /** The one-line invitation under the name on the picker. */
  hint: string;
  /** How the treatment describes itself in the picker's preview line. */
  blurb: string;
  backdrop: {
    /** The two ends of the wash behind the photo. */
    colors: [string, string];
    /** CSS gradient angle; the screen maps it to a start/end pair. */
    angle: number;
  };
  frame: ArtworkFrame;
  layers: ArtworkLayer[];
  /** Main text colour (the pet's name). */
  ink: string;
  /** Secondary text colour (the caption's own words, the small caps line). */
  inkSoft: string;
  /** The footer's colour — the quietest line on the sheet. */
  footerInk: string;
  /** The accent (the small rule between name and caption, and the picker chip). */
  accent: string;
}

/**
 * The five treatments, in the order the picker shows them — a plain warm print,
 * a painted wash, a dark glamour portrait, a sunlit one and a playful paw
 * frame. Each is a distinct, complete look rather than a tint of its neighbour.
 */
export const ARTWORK_TEMPLATES: readonly ArtworkTemplate[] = [
  {
    id: 'polaroid',
    title: 'Polaroid',
    hint: 'A leaning instant print with a written strip.',
    blurb: 'Warm paper, white border, a hand-written feel.',
    backdrop: { colors: ['#FFFDF8', '#F7E4CE'], angle: 165 },
    frame: {
      width: 0.66,
      aspect: 0.8,
      shape: 'square',
      mat: 0.038,
      matColor: '#FFFFFF',
      ring: { color: 'rgba(32,33,38,0.06)', width: 0.004 },
      tilt: -2.4,
      strip: true,
      stripHeight: 0.19,
      captionPlacement: 'strip',
      depth: 0.2,
    },
    layers: [
      { kind: 'blob', color: '#FF6B78', opacity: 0.16, size: 0.44, x: 0.04, y: 0.08 },
      { kind: 'blob', color: '#246BFD', opacity: 0.13, size: 0.5, x: 0.6, y: 0.01 },
      { kind: 'blob', color: '#FFD84D', opacity: 0.2, size: 0.46, x: 0.68, y: 0.64 },
      { kind: 'glyph', glyph: '🐾', color: '#B9A88F', opacity: 0.55, size: 0.075, x: 0.06, y: 0.78, rotate: -18 },
      { kind: 'glyph', glyph: '✦', color: '#FF9548', opacity: 0.5, size: 0.05, x: 0.86, y: 0.4 },
      { kind: 'vignette', strength: 0.06, reach: 0.14 },
    ],
    ink: '#202126',
    inkSoft: 'rgba(32,33,38,0.62)',
    footerInk: 'rgba(32,33,38,0.45)',
    accent: '#FF6B78',
  },
  {
    id: 'watercolor',
    title: 'Watercolor wash',
    hint: 'Soft painted blotches behind a clean white mat.',
    blurb: 'Loose colour, calm and painterly.',
    backdrop: { colors: ['#FFFDF8', '#EFF4FF'], angle: 160 },
    frame: {
      width: 0.6,
      aspect: 1.06,
      shape: 'square',
      mat: 0.05,
      matColor: '#FFFFFF',
      ring: { color: 'rgba(155,120,255,0.35)', width: 0.005 },
      tilt: 0,
      strip: false,
      stripHeight: 0,
      captionPlacement: 'below',
      depth: 0.16,
    },
    layers: [
      { kind: 'blob', color: '#9B78FF', opacity: 0.3, size: 0.62, x: 0.02, y: 0.03 },
      { kind: 'blob', color: '#246BFD', opacity: 0.22, size: 0.52, x: 0.64, y: 0.0 },
      { kind: 'blob', color: '#31D7D7', opacity: 0.26, size: 0.5, x: 0.0, y: 0.56 },
      { kind: 'blob', color: '#55C98D', opacity: 0.22, size: 0.54, x: 0.68, y: 0.6 },
      { kind: 'blob', color: '#FF6B78', opacity: 0.16, size: 0.44, x: 0.36, y: 0.84 },
      { kind: 'vignette', strength: 0.08, reach: 0.16 },
    ],
    ink: '#202126',
    inkSoft: 'rgba(32,33,38,0.6)',
    footerInk: 'rgba(32,33,38,0.45)',
    accent: '#6B45D9',
  },
  {
    id: 'midnight',
    title: 'Midnight portrait',
    hint: 'Deep navy and violet, your pet in a glowing circle.',
    blurb: 'Dark, starry and a little bit glamorous.',
    backdrop: { colors: ['#22307A', '#8A4DFF'], angle: 150 },
    frame: {
      width: 0.56,
      aspect: 1,
      shape: 'circle',
      mat: 0.018,
      matColor: 'rgba(255,255,255,0.10)',
      ring: { color: '#FFFFFF', width: 0.006 },
      tilt: 0,
      strip: false,
      stripHeight: 0,
      captionPlacement: 'below',
      depth: 0.45,
    },
    layers: [
      { kind: 'blob', color: '#9B78FF', opacity: 0.4, size: 0.92, x: 0.5, y: 0.4 },
      { kind: 'blob', color: '#31D7D7', opacity: 0.18, size: 0.5, x: 0.56, y: 0.64 },
      { kind: 'blob', color: '#22307A', opacity: 0.35, size: 0.7, x: 0.0, y: 0.9 },
      { kind: 'glyph', glyph: '✦', color: '#FFD84D', opacity: 0.95, size: 0.055, x: 0.12, y: 0.12 },
      { kind: 'glyph', glyph: '✦', color: '#FFFFFF', opacity: 0.8, size: 0.032, x: 0.82, y: 0.2 },
      { kind: 'glyph', glyph: '✦', color: '#31D7D7', opacity: 0.9, size: 0.04, x: 0.08, y: 0.62 },
      { kind: 'glyph', glyph: '✦', color: '#FFD84D', opacity: 0.7, size: 0.028, x: 0.9, y: 0.7 },
      { kind: 'dot', color: '#FFFFFF', opacity: 0.6, size: 0.012, x: 0.3, y: 0.06 },
      { kind: 'dot', color: '#FFD84D', opacity: 0.7, size: 0.016, x: 0.72, y: 0.08 },
      { kind: 'dot', color: '#31D7D7', opacity: 0.6, size: 0.012, x: 0.2, y: 0.3 },
      { kind: 'dot', color: '#FFFFFF', opacity: 0.5, size: 0.01, x: 0.88, y: 0.46 },
      { kind: 'dot', color: '#9B78FF', opacity: 0.7, size: 0.018, x: 0.14, y: 0.86 },
      { kind: 'dot', color: '#FFFFFF', opacity: 0.5, size: 0.01, x: 0.62, y: 0.92 },
      { kind: 'vignette', strength: 0.2, reach: 0.18 },
    ],
    ink: '#FFFFFF',
    inkSoft: 'rgba(255,255,255,0.78)',
    footerInk: 'rgba(255,255,255,0.6)',
    accent: '#FFD84D',
  },
  {
    id: 'golden',
    title: 'Golden days',
    hint: 'Sunshine and tangerine light behind an arch.',
    blurb: 'Warm, sunlit, golden-hour glow.',
    backdrop: { colors: ['#FFD84D', '#FF9548'], angle: 200 },
    frame: {
      width: 0.6,
      aspect: 1.14,
      shape: 'arch',
      mat: 0.042,
      matColor: '#FFFDF8',
      ring: { color: '#FFFFFF', width: 0.006 },
      tilt: 0,
      strip: false,
      stripHeight: 0,
      captionPlacement: 'below',
      depth: 0.22,
    },
    layers: [
      { kind: 'beam', color: '#FFFFFF', opacity: 0.22, width: 0.56, aspect: 3.4, x: 0.06, y: 0.02, rotate: -22 },
      { kind: 'beam', color: '#FFFFFF', opacity: 0.16, width: 0.36, aspect: 3.0, x: 0.5, y: 0.34, rotate: -22 },
      { kind: 'blob', color: '#FFD84D', opacity: 0.32, size: 0.52, x: 0.6, y: 0.02 },
      { kind: 'blob', color: '#FF6B78', opacity: 0.12, size: 0.46, x: -0.06, y: 0.66 },
      { kind: 'glyph', glyph: '☀️', color: '#FFFFFF', opacity: 0.85, size: 0.075, x: 0.1, y: 0.1 },
      { kind: 'glyph', glyph: '🐾', color: '#FFFFFF', opacity: 0.5, size: 0.06, x: 0.86, y: 0.78, rotate: 14 },
      { kind: 'vignette', strength: 0.1, reach: 0.16 },
    ],
    ink: '#5A3208',
    inkSoft: 'rgba(90,50,8,0.78)',
    footerInk: 'rgba(90,50,8,0.6)',
    accent: '#8A4A0A',
  },
  {
    id: 'pawframe',
    title: 'Paw print frame',
    hint: 'A cream mat, a green rule and paws in the corners.',
    blurb: 'Playful and tidy — paws all around.',
    backdrop: { colors: ['#FFFDF8', '#E7F7EE'], angle: 150 },
    frame: {
      width: 0.62,
      aspect: 1,
      shape: 'square',
      mat: 0.055,
      matColor: '#FFFFFF',
      ring: { color: '#55C98D', width: 0.007 },
      tilt: 0,
      strip: false,
      stripHeight: 0,
      captionPlacement: 'below',
      depth: 0.16,
    },
    layers: [
      { kind: 'glyph', glyph: '🐾', color: '#55C98D', opacity: 0.9, size: 0.085, x: 0.04, y: 0.04, rotate: -16 },
      { kind: 'glyph', glyph: '🐾', color: '#246BFD', opacity: 0.75, size: 0.072, x: 0.82, y: 0.06, rotate: 18 },
      { kind: 'glyph', glyph: '🐾', color: '#FF9548', opacity: 0.8, size: 0.075, x: 0.05, y: 0.78, rotate: 12 },
      { kind: 'glyph', glyph: '🐾', color: '#9B78FF', opacity: 0.75, size: 0.08, x: 0.84, y: 0.76, rotate: -20 },
      { kind: 'dot', color: '#31D7D7', opacity: 0.55, size: 0.022, x: 0.28, y: 0.14 },
      { kind: 'dot', color: '#FFD84D', opacity: 0.7, size: 0.028, x: 0.7, y: 0.9 },
      { kind: 'vignette', strength: 0.07, reach: 0.15 },
    ],
    ink: '#202126',
    inkSoft: 'rgba(32,33,38,0.6)',
    footerInk: 'rgba(32,33,38,0.45)',
    accent: '#1C7A4B',
  },
];

/** The treatment a new artwork starts in (the first one on the picker). */
export const DEFAULT_ARTWORK_TEMPLATE_ID: ArtworkTemplateId = 'polaroid';

/** Look a treatment up by id (undefined for an unknown id). */
export function artworkTemplate(id: ArtworkTemplateId): ArtworkTemplate | undefined {
  return ARTWORK_TEMPLATES.find((template) => template.id === id);
}

/**
 * The treatment for an id, falling back to the default — so a stored or
 * navigated id that no longer exists can never leave the canvas blank.
 */
export function artworkTemplateOrDefault(id: string | undefined | null): ArtworkTemplate {
  const found = id ? ARTWORK_TEMPLATES.find((template) => template.id === id) : undefined;
  return found ?? ARTWORK_TEMPLATES[0];
}

/** The small-caps line printed under every pet's name. */
export const ARTWORK_KICKER = 'Custom artwork';

/**
 * The caption block's one set of measurements, shared by both renderers so the
 * words sit in the same place at the same size on screen and on paper.
 * Fractions of the canvas width, like everything else here.
 */
export const ARTWORK_TYPE = {
  /** The pet's name (the piece's only serif line). */
  name: 0.052,
  /** The short accent rule under the name. */
  ruleWidth: 0.08,
  ruleHeight: 0.0038,
  /** The owner's own caption. */
  caption: 0.025,
  /** "Custom artwork". */
  kicker: 0.0185,
  /** The quiet line at the foot of the sheet. */
  footer: 0.017,
  /** Padding inside a polaroid strip. */
  stripPad: 0.02,
  /** Side inset of the caption block when it sits below the frame. */
  blockInset: 0.12,
  /** How far the caption block sits above the bottom edge (below mode). */
  blockBottom: 0.072,
  /** How far the frame is lifted so the block and the footer have room. */
  stageLift: 0.17,
  /** How far the footer sits above the bottom edge. */
  footerBottom: 0.03,
} as const;

/** The quiet line at the foot of every sheet. */
export const ARTWORK_FOOTER =
  'Made with 💛 by Pet Parent Tracker — framed on this device. Nothing was uploaded.';
