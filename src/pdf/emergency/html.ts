/**
 * Emergency Pet Card pack — the print template.
 *
 * `buildEmergencyCardsHtml()` turns an `EmergencyCardDeck` (see ./document) into
 * ONE self-contained HTML string: inline CSS only, no scripts, no webfonts, no
 * remote anything. `expo-print`'s `printToFileAsync` renders it into a PDF on
 * the device, and the browser preview shows the very same string in an inline
 * frame — so the preview, the printed pack and the saved PDF are one document.
 *
 * Two ways onto paper, both at the card's TRUE size (85.6 × 54 mm, ID-1):
 *  - `'card'` — the page IS the card: `@page { size: 85.6mm 54mm }`, one face
 *    per page, printed at 100% with nothing scaled.
 *  - `'letter'` / `'a4'` — eight faces per sheet at the same real size, 2 × 4,
 *    each with grey corner marks to cut along and a caption ("Bella · front")
 *    outside the trim area. An ordinary printer can feed a Letter sheet, which
 *    it cannot do with a 54 mm page.
 *
 * Every figure on a card is measured in millimetres, so the printed card is
 * exactly the size of a bank card whatever the paper it sits on. The QR is drawn
 * as an inline SVG of the encoder's own matrix (dark modules on white, with a
 * four-module quiet zone) — no image, no script, nothing fetched. A card with no
 * encodable payload simply has no QR block.
 *
 * 100% offline: a local string with no remote origin, no script and no font.
 */
import { CARD_HEIGHT_MM, CARD_WIDTH_MM, SHEET_LABEL_HEIGHT_MM, sheetSlots } from './card';
import { QR_QUIET_ZONE, type EmergencyQr } from './qr';
import type { EmergencyCard, EmergencyCardDeck, EmergencyCardFace } from './document';
import { extraMedicationsNote } from './document';

/* ------------------------------------------------------------- palette ---- */
const INK = '#202126';
const MUTED = '#6B6C75';
const SOFT = '#4A4B52';
const BLUE = '#246BFD';
const CORAL = '#FF6B78';
const LINE = '#E3DED3';
/** The trim marks on a cut-out sheet — a quiet grey, never a printed border. */
const TRIM = '#B9B4AA';

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Helvetica, Arial, "Helvetica Neue", sans-serif';

/** Escape user text (names, numbers, notes) for the page. */
function esc(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A millimetre length as CSS (plain numbers stay readable). */
function mm(value: number): string {
  return `${Math.round(value * 1000) / 1000}mm`;
}

/* ----------------------------------------------------------------- QR ---- */

/**
 * The QR as inline SVG: a white tile with the quiet zone built in, then the
 * encoder's dark modules as horizontal runs (one rect per run — compact, crisp
 * and deterministic). `sizeMm` is the code's own edge, excluding the quiet zone.
 */
export function qrSvg(qr: EmergencyQr, sizeMm: number): string {
  const quiet = QR_QUIET_ZONE;
  const span = qr.size + quiet * 2;
  const rects = qr.runs
    .map((run) => `<rect x="${run.x}" y="${run.y}" width="${run.width}" height="1"/>`)
    .join('');
  return `<svg class="qr" xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${span} ${span}" width="${mm(
    sizeMm,
  )}" height="${mm(sizeMm)}" shape-rendering="crispEdges"><rect x="${-quiet}" y="${-quiet}" width="${span}" height="${span}" fill="#FFFFFF"/><g fill="${INK}">${rects}</g></svg>`;
}

/* --------------------------------------------------------------- faces ---- */

/** The photo plate: the pet's own photo, or the illustrated initial. */
function plateHtml(card: EmergencyCard): string {
  if (card.photo) {
    return `<div class="plate"><img src="${esc(card.photo)}" alt="${esc(
      card.petName,
    )}" /></div>`;
  }
  return `<div class="plate"><div class="initial">${esc(card.initial)}</div></div>`;
}

/** One alert chip (allergy, medication) on the front. */
function chipHtml(text: string): string {
  const kind = text.startsWith('ALLERGIC') ? 'chip allergy' : 'chip meds';
  return `<span class="${kind}">${esc(text)}</span>`;
}

/** The front of one card: who this is, and how to help. */
function frontHtml(card: EmergencyCard): string {
  const chips =
    card.alerts.length > 0
      ? card.alerts.map(chipHtml).join('')
      : `<span class="alertNote">${esc(card.alertsNote)}</span>`;
  const microchip = card.microchip ? `<div class="idline">${esc(card.microchip)}</div>` : '';
  return `
  <div class="card front">
    <div class="bar" style="background-image:linear-gradient(90deg, ${BLUE}, #31D7D7)"></div>
    <div class="eyebrow">If found · please help</div>
    ${plateHtml(card)}
    <div class="info">
      <div class="name">${esc(card.petName)}</div>
      <div class="species">${esc(card.speciesLine)}</div>
      <div class="facts">${esc(card.factsLine)}</div>
      ${microchip}
    </div>
    <div class="chips">${chips}</div>
    <div class="foot">${esc(card.ifFound)}</div>
  </div>`;
}

/** One contact block on the back. */
function contactHtml(card: EmergencyCard, index: number): string {
  const contact = card.contacts[index];
  if (!contact) return '';
  const detail = contact.detail
    ? `<div class="cdetail">${esc(contact.detail)}</div>`
    : '';
  return `
    <div class="contact c${index}">
      <div class="clabel">${esc(contact.label)}</div>
      <div class="cname">${esc(contact.name)}</div>
      ${detail}
      <div class="cphone">${esc(contact.phone)}</div>
    </div>`;
}

/** One titled list block (medications, notes). */
function listHtml(
  label: string,
  lines: string[],
  empty: string,
  extra = '',
): string {
  const body =
    lines.length > 0
      ? lines.map((line) => `<div class="lline">${esc(line)}</div>`).join('')
      : `<div class="lnone">${esc(empty)}</div>`;
  const more = extra ? `<div class="lnone">${esc(extra)}</div>` : '';
  return `
    <div class="clabel">${esc(label)}</div>
    ${body}
    ${more}`;
}

/** The back of one card: who to call, what they take, how they behave. */
function backHtml(card: EmergencyCard): string {
  const qr = card.qr
    ? `${qrSvg(card.qr, 20)}<div class="qrcap">Scan for a plain-text<br/>summary — no link, no app</div>`
    : `<div class="qrbox" style="border:0.25mm dashed ${LINE};border-radius:1.5mm"></div>`;
  return `
  <div class="card back">
    <div class="bar" style="background-image:linear-gradient(90deg, ${BLUE}, #31D7D7)"></div>
    <div class="bhead"><span class="bk">Emergency information</span><span class="bp">${esc(
      card.petName,
    )}</span></div>
    ${contactHtml(card, 0)}
    ${contactHtml(card, 1)}
    ${contactHtml(card, 2)}
    ${contactHtml(card, 3)}
    <div class="meds">${listHtml(
      'Medications',
      card.medications,
      card.medsNote,
      extraMedicationsNote(card),
    )}</div>
    <div class="notes">${listHtml('Behaviour', card.notes, card.notesNote)}</div>
    <div class="qrbox">${qr}</div>
  </div>`;
}

/** One face of one card. */
export function emergencyCardFaceHtml(face: EmergencyCardFace): string {
  return face.kind === 'front' ? frontHtml(face.card) : backHtml(face.card);
}

/* ------------------------------------------------------------ the pack ---- */

/**
 * The eight grey trim marks around one card, drawn OUTSIDE the card's own box
 * (the card sits at 0,0 inside its slot, so the marks use negative offsets).
 */
function trimMarks(): string {
  const gap = 1.2;
  const len = 2;
  const thick = 0.12;
  const w = CARD_WIDTH_MM;
  const h = CARD_HEIGHT_MM;
  const bars: Array<[number, number, number, number]> = [
    [-len, -gap - thick / 2, len, thick],
    [-gap - thick / 2, -len, thick, len],
    [w, -gap - thick / 2, len, thick],
    [w + gap - thick / 2, -len, thick, len],
    [-len, h + gap - thick / 2, len, thick],
    [-gap - thick / 2, h, thick, len],
    [w, h + gap - thick / 2, len, thick],
    [w + gap - thick / 2, h, thick, len],
  ];
  return bars
    .map(
      ([left, top, width, height]) =>
        `<div class="trim" style="left:${mm(left)};top:${mm(top)};width:${mm(
          width,
        )};height:${mm(height)}"></div>`,
    )
    .join('');
}

/** One sheet of eight cards, each exactly 85.6 × 54 mm, with trim marks. */
function sheetHtml(deck: EmergencyCardDeck, faces: EmergencyCardFace[], index: number): string {
  const slots = sheetSlots(deck.sheet);
  const cells = faces
    .map((face, slot) => {
      const at = slots[slot];
      if (!at) return '';
      return `
      <div class="slot" style="left:${mm(at.xMm)};top:${mm(at.yMm)}">
        ${trimMarks()}
        ${emergencyCardFaceHtml(face)}
        <div class="slotLabel">${esc(face.label)}</div>
      </div>`;
    })
    .join('');
  return `
  <div class="sheet">
    <div class="sheetHead" style="left:${mm(slots[0]?.xMm ?? 10)};top:3.2mm;width:${mm(
      CARD_WIDTH_MM * 2 + 11 + 3.2,
    )}">${esc(deck.printNote)}</div>
    ${cells}
    <div class="sheetFoot" style="left:${mm(slots[0]?.xMm ?? 10)};bottom:2.6mm;width:${mm(
      CARD_WIDTH_MM * 2 + 11 + 3.2,
    )}">${esc(deck.title)} — sheet ${index + 1} of ${deck.sheets} · ${esc(deck.footer)}</div>
  </div>`;
}

/** Pages, grouped by how many faces fit on one page. */
function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * The complete pack as print HTML. Deterministic: the same deck always produces
 * the same string.
 */
export function buildEmergencyCardsHtml(deck: EmergencyCardDeck): string {
  const sheet = deck.sheet;
  const pages =
    deck.paper === 'card'
      ? chunk(deck.faces, 1)
          .map(
            ([face]) => `
  <div class="page">
    ${face ? emergencyCardFaceHtml(face) : ''}
  </div>`,
          )
          .join('')
      : chunk(deck.faces, deck.perSheet)
          .map((faces, index) => sheetHtml(deck, faces, index))
          .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(deck.title)}</title>
<style>
  @page { size: ${sheet.cssPageSize}; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #FFFFFF; }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-family: ${SANS};
    color: ${INK};
  }
  /* ---- one card, at its real size: 85.6 × 54 mm, ID-1 ---- */
  .card {
    position: relative;
    width: ${mm(CARD_WIDTH_MM)};
    height: ${mm(CARD_HEIGHT_MM)};
    background: #FFFFFF;
    overflow: hidden;
    font-family: ${SANS};
    color: ${INK};
  }
  .card .bar { position: absolute; left: 0; top: 0; width: 100%; height: 2mm; }
  .card .eyebrow {
    position: absolute; left: 4mm; top: 3.1mm; width: 77.6mm;
    font-size: 1.75mm; line-height: 2mm; letter-spacing: 0.22mm;
    font-weight: 700; text-transform: uppercase; color: ${CORAL};
  }
  .card .plate {
    position: absolute; left: 4mm; top: 7.6mm;
    width: 24mm; height: 26mm; border-radius: 2mm; overflow: hidden;
    border: 0.3mm solid ${LINE};
    background-image: linear-gradient(135deg, #EAF1FF, #FFF1E3);
  }
  .card .plate img { display: block; width: 100%; height: 100%; object-fit: cover; }
  .card .initial {
    font-family: ${SERIF}; font-weight: 700; font-size: 15mm;
    line-height: 25.4mm; text-align: center; color: ${BLUE};
  }
  .card .info { position: absolute; left: 31mm; top: 7.2mm; width: 50.6mm; }
  .card .name {
    font-family: ${SERIF}; font-weight: 700; font-size: 6mm; line-height: 6.4mm;
    word-break: break-word;
  }
  .card .species {
    font-size: 2.3mm; line-height: 2.8mm; letter-spacing: 0.12mm;
    color: ${SOFT}; margin-top: 0.6mm;
  }
  .card .facts { font-size: 2.35mm; line-height: 2.9mm; font-weight: 700; margin-top: 0.5mm; }
  .card .idline {
    font-size: 2.2mm; line-height: 2.7mm; margin-top: 0.5mm;
    color: ${BLUE}; font-weight: 700; letter-spacing: 0.06mm;
  }
  .card .chips { position: absolute; left: 4mm; top: 34.8mm; width: 77.6mm; }
  .card .chip {
    display: inline-block; margin: 0 1mm 1mm 0; padding: 0.7mm 1.5mm;
    border-radius: 5mm; font-size: 2.05mm; line-height: 2.5mm;
    font-weight: 700; letter-spacing: 0.06mm;
  }
  .card .chip.allergy { background: #FFE9EB; color: #B3202E; border: 0.25mm solid #FFC4CA; }
  .card .chip.meds { background: #FFF0E4; color: #A2500F; border: 0.25mm solid #FFD3B0; }
  .card .alertNote { font-size: 2.05mm; line-height: 2.6mm; color: ${MUTED}; }
  .card .foot {
    position: absolute; left: 4mm; bottom: 2.6mm; width: 77.6mm;
    font-size: 2.25mm; line-height: 2.9mm; color: ${SOFT};
  }
  /* ---- the back ---- */
  .card .bhead {
    position: absolute; left: 4mm; top: 3.05mm; width: 77.6mm;
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 1.75mm; line-height: 2mm; letter-spacing: 0.2mm; text-transform: uppercase;
  }
  .card .bhead .bk { color: ${BLUE}; font-weight: 700; }
  .card .bhead .bp { color: ${INK}; font-weight: 700; }
  .card .contact { position: absolute; width: 36.6mm; }
  .card .c0 { left: 4mm; top: 7.4mm; }
  .card .c1 { left: 45mm; top: 7.4mm; }
  .card .c2 { left: 4mm; top: 19mm; }
  .card .c3 { left: 45mm; top: 19mm; }
  .card .clabel {
    font-size: 1.7mm; line-height: 2.2mm; letter-spacing: 0.18mm;
    font-weight: 700; text-transform: uppercase; color: ${MUTED};
  }
  .card .cname { font-size: 2.5mm; line-height: 2.9mm; font-weight: 700; margin-top: 0.3mm; }
  .card .cdetail { font-size: 1.9mm; line-height: 2.3mm; color: ${MUTED}; }
  .card .cphone { font-size: 2.9mm; line-height: 3.4mm; font-weight: 700; color: ${BLUE}; margin-top: 0.3mm; }
  .card .meds { position: absolute; left: 4mm; top: 29.4mm; width: 52mm; }
  .card .notes { position: absolute; left: 4mm; top: 40.4mm; width: 52mm; }
  .card .lline { font-size: 2.2mm; line-height: 2.8mm; }
  .card .lnone { font-size: 2.05mm; line-height: 2.6mm; color: ${MUTED}; }
  .card .qrbox { position: absolute; left: 59.6mm; top: 29.4mm; width: 22mm; }
  .card .qrcap { font-size: 1.45mm; line-height: 1.8mm; color: ${MUTED}; text-align: center; margin-top: 0.5mm; }
  /* ---- card mode: the page IS the card ---- */
  .page {
    width: ${mm(CARD_WIDTH_MM)}; height: ${mm(CARD_HEIGHT_MM)};
    overflow: hidden; page-break-after: always; break-after: page;
  }
  .page:last-child { page-break-after: auto; break-after: auto; }
  /* ---- sheet mode: eight cards per page, at the same real size ---- */
  .sheet {
    position: relative; width: ${mm(sheet.widthMm)}; height: ${mm(sheet.heightMm)};
    overflow: hidden; background: #FFFFFF;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .sheetHead { position: absolute; font-size: 1.9mm; line-height: 2.6mm; color: ${MUTED}; }
  .sheetFoot { position: absolute; font-size: 1.7mm; line-height: 2.4mm; color: ${MUTED}; }
  .slot { position: absolute; }
  .slot .card { border: 0.12mm solid ${LINE}; }
  .slotLabel {
    width: ${mm(CARD_WIDTH_MM)}; font-size: 1.9mm; line-height: ${mm(
      SHEET_LABEL_HEIGHT_MM,
    )}; color: ${MUTED};
  }
  .trim { position: absolute; background: ${TRIM}; }
</style>
</head>
<body>
${pages}
</body>
</html>`;
}
