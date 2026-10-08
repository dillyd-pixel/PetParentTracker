/**
 * Custom Pet Artwork — the print template.
 *
 * `buildArtworkHtml()` turns an `ArtworkDocument` (see ./document) into ONE
 * self-contained HTML string: inline CSS only, no scripts, no webfonts, no
 * remote anything. `expo-print`'s `printToFileAsync` renders it into a
 * single-page PDF on the device, and the browser preview shows the very same
 * string in an inline frame — so the preview, the printed sheet and the saved
 * PDF are one picture.
 *
 * The one image on the sheet is the pet's OWN photo, carried inline as a `data:`
 * URI (the caller resolves the local file into one, see ./photoData). Nothing is
 * fetched: the sheet cannot reach the network because it never names a URL.
 *
 * Geometry: the sheet is set up so 1em is 1% of the paper's width — the same
 * unit the template data uses (see ./templates). Every size, radius, gap and
 * name in this file is therefore the identical fraction the on-screen canvas
 * draws, and the two agree by construction rather than by hand.
 *
 * Colour: full-bleed, edge to edge, on the chosen sheet (US Letter or A4). The
 * palette lives in ./templates with the rest of the treatment data.
 */
import { paperSizeDef } from '../planner/sections';
import {
  ARTWORK_TYPE,
  type ArtworkFrame,
  type ArtworkLayer,
  type ArtworkTemplate,
} from './templates';
import type { ArtworkDocument } from './document';

/** Escape user text (the pet's name, the owner's caption) for the page. */
function esc(value: string | number | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A fraction of the canvas width as CSS `em` (1em = 1% of the sheet width). */
function em(fraction: number): string {
  return `${round(fraction * 100)}em`;
}

/** A fraction as a CSS percentage. */
function pct(fraction: number): string {
  return `${round(fraction * 100)}%`;
}

/** Trim floating-point noise so the emitted CSS stays readable. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * A colour with an opacity applied. Handles the two forms the templates use:
 * `#RRGGBB` (turned into `rgba(...)`) and an `rgba(...)` that already carries
 * its own alpha (returned as it is, so a translucent mat stays translucent).
 */
function alpha(color: string, opacity: number): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${round(opacity)})`;
  }
  return hex;
}

/** A safe font stack: the house serif for the name, plain sans for everything. */
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Helvetica, Arial, "Helvetica Neue", sans-serif';

/** One decorative layer, positioned and sized exactly as the canvas does. */
function layerHtml(layer: ArtworkLayer): string {
  const at = `left:${pct(layer.x)};top:${pct(layer.y)};`;
  switch (layer.kind) {
    case 'blob':
      // A soft painted blot: one radial gradient, fading out from the middle.
      return `<div style="${at}width:${em(layer.size)};aspect-ratio:1;border-radius:50%;background-image:radial-gradient(closest-side, ${alpha(
        layer.color,
        layer.opacity,
      )}, ${alpha(layer.color, layer.opacity * 0.72)} 55%, ${alpha(
        layer.color,
        layer.opacity * 0.32,
      )} 76%, ${alpha(layer.color, 0)} 100%)"></div>`;
    case 'beam':
      // A soft shaft of light: a long translucent bar, faded at both ends.
      return `<div style="${at}width:${em(layer.width)};aspect-ratio:${round(
        layer.aspect,
      )};transform:rotate(${round(layer.rotate)}deg);border-radius:999px;background-image:linear-gradient(90deg, ${alpha(
        layer.color,
        0,
      )}, ${alpha(layer.color, layer.opacity)} 48%, ${alpha(layer.color, 0)})"></div>`;
    case 'glyph':
      return `<div style="${at}font-size:${em(layer.size)};line-height:1;color:${esc(
        layer.color,
      )};opacity:${round(layer.opacity)};${
        layer.rotate ? `transform:rotate(${round(layer.rotate)}deg);` : ''
      }">${esc(layer.glyph)}</div>`;
    case 'dot':
      return `<div style="${at}width:${em(layer.size)};aspect-ratio:1;border-radius:50%;background:${alpha(
        layer.color,
        layer.opacity,
      )}"></div>`;
    case 'vignette':
      // Four edge bands — the same primitive the canvas has, so the two match.
      return [
        `<div style="left:0;right:0;top:0;height:${pct(layer.reach)};background-image:linear-gradient(180deg, ${alpha(
          '#000000',
          layer.strength,
        )}, ${alpha('#000000', 0)})"></div>`,
        `<div style="left:0;right:0;bottom:0;height:${pct(layer.reach)};background-image:linear-gradient(0deg, ${alpha(
          '#000000',
          layer.strength,
        )}, ${alpha('#000000', 0)})"></div>`,
        `<div style="top:0;bottom:0;left:0;width:${pct(layer.reach)};background-image:linear-gradient(90deg, ${alpha(
          '#000000',
          layer.strength,
        )}, ${alpha('#000000', 0)})"></div>`,
        `<div style="top:0;bottom:0;right:0;width:${pct(layer.reach)};background-image:linear-gradient(270deg, ${alpha(
          '#000000',
          layer.strength,
        )}, ${alpha('#000000', 0)})"></div>`,
      ].join('');
    default:
      return '';
  }
}

/**
 * The rounded shape of the frame/photo box, in CSS terms. `corner` is a
 * fraction of the canvas width (1.4% of it is a soft printed corner), ignored
 * for the circle and used only along the bottom of the arch.
 */
function cssRadius(shape: ArtworkFrame['shape'], corner: number): string {
  const small = em(corner);
  if (shape === 'circle') return '50%';
  if (shape === 'arch') return `50% 50% ${small} ${small} / 32% 32% ${small} ${small}`;
  return small;
}

/**
 * The caption block — the pet's name in the house serif, the accent rule, the
 * owner's own words when they wrote any, and the small-caps line. Identical
 * markup in both placements (inside a polaroid strip, or below the frame).
 */
function captionHtml(doc: ArtworkDocument, template: ArtworkTemplate): string {
  const caption = doc.caption
    ? `<div class="cap" style="font-size:${em(ARTWORK_TYPE.caption)};color:${template.inkSoft}">${esc(
        doc.caption,
      )}</div>`
    : '';
  return `
    <div class="block">
      <div class="name" style="font-size:${em(ARTWORK_TYPE.name)};color:${template.ink}">${esc(
        doc.petName,
      )}</div>
      <div style="width:${em(ARTWORK_TYPE.ruleWidth)};height:${em(
        ARTWORK_TYPE.ruleHeight,
      )};border-radius:999px;background:${template.accent};margin-top:${em(
        ARTWORK_TYPE.kicker,
      )}"></div>
      ${caption}
      <div class="kicker" style="font-size:${em(ARTWORK_TYPE.kicker)};color:${template.inkSoft}">${esc(
        doc.kicker,
      )}</div>
    </div>`;
}

/** The photo, or the honest place it will go when there is none yet. */
function photoHtml(doc: ArtworkDocument, template: ArtworkTemplate): string {
  if (doc.photo) {
    return `<img class="photo" src="${esc(doc.photo)}" alt="${esc(doc.petName)}" />`;
  }
  return `<div class="ph" style="color:${template.inkSoft}">A photo of ${esc(
    doc.petName,
  )} goes here — add one on their page and it prints in this frame.</div>`;
}

/** The frame (mat, photo, polaroid strip) — the piece's centre. */
function frameHtml(doc: ArtworkDocument, template: ArtworkTemplate): string {
  const frame = template.frame;
  const strip = frame.strip
    ? `<div class="strip" style="height:${em(
        frame.stripHeight,
      )};padding:0 ${em(ARTWORK_TYPE.stripPad)}">${captionHtml(doc, template)}</div>`
    : '';

  return `
    <div class="frame" style="width:${em(frame.width)};aspect-ratio:${round(
      frame.aspect,
    )};background:${frame.matColor};border-radius:${cssRadius(frame.shape, 0.014)};padding:${em(
      frame.mat,
    )};transform:rotate(${round(frame.tilt)}deg);box-shadow:0 ${em(0.9 * frame.depth)} ${em(
      3.2 * frame.depth,
    )} ${alpha('#202126', frame.depth)}">
      <div class="mat" style="border-radius:${cssRadius(
        frame.shape,
        0.009,
      )};border:${em(frame.ring.width)} solid ${frame.ring.color}">
        ${photoHtml(doc, template)}
      </div>
      ${strip}
    </div>`;
}

/**
 * The complete artwork as print HTML. Deterministic: the same document always
 * produces the same string.
 */
export function buildArtworkHtml(doc: ArtworkDocument): string {
  const template = doc.template;
  const size = paperSizeDef(doc.paper);
  const below = template.frame.captionPlacement === 'below';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(doc.title)}</title>
<style>
  @page { size: ${size.cssPageSize}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #FFFDF8; }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: ${SANS};
  }
  /* The sheet: 1em is 1% of its width, the unit every template number uses. */
  .art {
    position: relative;
    width: ${size.widthMm}mm;
    height: ${size.heightMm}mm;
    font-size: calc(${size.widthMm}mm / 100);
    overflow: hidden;
    background: #FFFDF8;
  }
  .art .bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
  .art .stage {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: ${below ? pct(ARTWORK_TYPE.stageLift) : '0'};
  }
  .frame { display: flex; flex-direction: column; }
  .mat { flex: 1; overflow: hidden; position: relative; background: #F1E9DC; }
  .photo { display: block; width: 100%; height: 100%; object-fit: cover; }
  .ph {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: ${em(ARTWORK_TYPE.caption)};
    font-size: ${em(ARTWORK_TYPE.caption)};
    line-height: 1.4;
  }
  .block { display: flex; flex-direction: column; align-items: center; text-align: center; }
  .name { font-family: ${SERIF}; font-weight: 700; line-height: 1.16; }
  .cap { line-height: 1.35; margin-top: ${em(ARTWORK_TYPE.kicker * 0.5)}; }
  .kicker { letter-spacing: ${em(ARTWORK_TYPE.kicker * 0.16)}; text-transform: uppercase; line-height: 1.3; margin-top: ${em(
    ARTWORK_TYPE.kicker * 0.45,
  )}; }
  .strip { display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .below {
    position: absolute;
    left: ${pct(ARTWORK_TYPE.blockInset)};
    right: ${pct(ARTWORK_TYPE.blockInset)};
    bottom: ${pct(ARTWORK_TYPE.blockBottom)};
  }
  .footer {
    position: absolute;
    left: ${pct(0.06)};
    right: ${pct(0.06)};
    bottom: ${pct(ARTWORK_TYPE.footerBottom)};
    text-align: center;
    font-size: ${em(ARTWORK_TYPE.footer)};
    line-height: 1.35;
    color: ${template.footerInk};
  }
</style>
</head>
<body>
<div class="art" style="background:${template.backdrop.colors[0]}">
  <div class="bg" style="background-image:linear-gradient(${round(
    template.backdrop.angle,
  )}deg, ${template.backdrop.colors[0]}, ${template.backdrop.colors[1]})"></div>
  ${template.layers.map(layerHtml).join('')}
  <div class="stage">${frameHtml(doc, template)}</div>
  ${below ? `<div class="below">${captionHtml(doc, template)}</div>` : ''}
  <div class="footer">${esc(doc.footer)}</div>
</div>
</body>
</html>`;
}
