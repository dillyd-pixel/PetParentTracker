/**
 * Emergency Pet Card pack — the card's physical geometry.
 *
 * A wallet card is ID-1 (ISO/IEC 7810): exactly 85.6 × 54 mm, the size of a
 * bank card. This module owns that fact, plus the two ways a pack is put on
 * paper:
 *
 *  - `'card'` — the sheet IS the card: one card face per page, page size
 *    85.6 × 54 mm, printed at 100% with no scaling. The truest possible card,
 *    for a print shop or a PDF kept on the phone.
 *  - `'letter'` / `'a4'` — eight card faces per sheet at the SAME real size,
 *    2 × 4 with corner marks to cut along, so an ordinary home printer (which
 *    cannot feed a 54 mm page) can still make the cards. Nothing is scaled
 *    down: each card is 85.6 × 54 mm on the sheet.
 *
 * The card size is defined HERE rather than in the planner's `PAPER_SIZES`:
 * the keepsakes' shared `PaperSizeDef` stays a list of sheet sizes, and the two
 * sheet sizes below are read from it (`paperSizeDef`) so Letter and A4 keep the
 * app's single source of truth for their real dimensions.
 *
 * 100% offline: constants and pure arithmetic, nothing else.
 */
import { paperSizeDef, type PaperSizeDef } from '../planner/sections';

/** The card's real-world size: ID-1, exactly 85.6 × 54 mm. */
export const CARD_WIDTH_MM = 85.6;
/** The card's real-world height: ID-1, exactly 54 mm. */
export const CARD_HEIGHT_MM = 54;
/** Width ÷ height — the card's shape, used by the on-device preview. */
export const CARD_ASPECT = CARD_WIDTH_MM / CARD_HEIGHT_MM;

/** How a pack is laid out on paper. */
export type EmergencyCardPaper = 'card' | 'letter' | 'a4';

/** One page size, in every unit the renderers need. */
export interface EmergencySheetDef {
  id: EmergencyCardPaper;
  /** Human label, e.g. "Card size · 85.6 × 54 mm (ID-1)". */
  label: string;
  /** Short label, e.g. "Card size". */
  short: string;
  /** The CSS `@page { size: … }` value. */
  cssPageSize: string;
  /** Page width in pixels at 72 PPI — what `printToFileAsync` wants. */
  widthPx: number;
  /** Page height in pixels at 72 PPI. */
  heightPx: number;
  /** Page width in millimetres. */
  widthMm: number;
  /** Page height in millimetres. */
  heightMm: number;
}

/**
 * One card face per page, page exactly the card's size (85.6 × 54 mm).
 * 243 × 153 px is the same size at 72 PPI, which `expo-print` renders at.
 */
export const CARD_SHEET: EmergencySheetDef = {
  id: 'card',
  label: 'Card size · 85.6 × 54 mm (ID-1)',
  short: 'Card size',
  cssPageSize: `${CARD_WIDTH_MM}mm ${CARD_HEIGHT_MM}mm`,
  widthPx: 243,
  heightPx: 153,
  widthMm: CARD_WIDTH_MM,
  heightMm: CARD_HEIGHT_MM,
};

/** The three choices the screen offers, in the order it shows them. */
export const EMERGENCY_PAPERS: readonly EmergencySheetDef[] = [
  CARD_SHEET,
  { ...fromPlanner('letter'), short: 'Letter sheet', label: 'US Letter sheet · 8 cards per page' },
  { ...fromPlanner('a4'), short: 'A4 sheet', label: 'A4 sheet · 8 cards per page' },
];

/** Letter/A4 as an `EmergencySheetDef` (the planner owns their dimensions). */
function fromPlanner(id: 'letter' | 'a4'): EmergencySheetDef {
  const def: PaperSizeDef = paperSizeDef(id);
  return {
    id,
    label: def.label,
    short: def.short,
    cssPageSize: def.cssPageSize,
    widthPx: def.widthPx,
    heightPx: def.heightPx,
    widthMm: def.widthMm,
    heightMm: def.heightMm,
  };
}

/** The page definition for a choice (an unknown value falls back to card size). */
export function emergencySheetDef(paper: EmergencyCardPaper | string): EmergencySheetDef {
  return EMERGENCY_PAPERS.find((entry) => entry.id === paper) ?? CARD_SHEET;
}

/* ------------------------------------------------------ the 8-up grid ---- */

/** Card faces per sheet in the sheet layouts (2 columns × 4 rows). */
export const CARDS_PER_SHEET = 8;
/** The sheet's own edge margin, in millimetres. */
const SHEET_MARGIN_MM = 10;
/** Clear space beside each card on a sheet, in millimetres. */
const SHEET_GAP_X_MM = 11;
/** Clear space between card rows, in millimetres (room for the trim marks). */
const SHEET_GAP_Y_MM = 7;
/** The grey caption line under each card ("Bella · front"), in millimetres. */
const SHEET_LABEL_MM = 5;

/** Where one card face sits on a sheet, in millimetres from the top-left. */
export interface SheetSlot {
  /** Column (0 = left). */
  col: number;
  /** Row (0 = top). */
  row: number;
  /** Left edge of the card itself, mm. */
  xMm: number;
  /** Top edge of the card itself, mm. */
  yMm: number;
}

/**
 * The eight card positions on one sheet: 2 columns × 4 rows, centred, each card
 * its true 85.6 × 54 mm with a caption line beneath it outside the trim area.
 * Pure arithmetic, so a sheet is laid out identically every time it prints.
 */
export function sheetSlots(sheet: EmergencySheetDef): SheetSlot[] {
  const columns = 2;
  const rows = Math.ceil(CARDS_PER_SHEET / columns);
  const gridWidth = columns * CARD_WIDTH_MM + (columns - 1) * SHEET_GAP_X_MM;
  const gridHeight =
    rows * (CARD_HEIGHT_MM + SHEET_LABEL_MM) + (rows - 1) * SHEET_GAP_Y_MM;
  const originX = Math.max(SHEET_MARGIN_MM, (sheet.widthMm - gridWidth) / 2);
  const originY = Math.max(SHEET_MARGIN_MM, (sheet.heightMm - gridHeight) / 2);
  const slots: SheetSlot[] = [];
  for (let index = 0; index < CARDS_PER_SHEET; index += 1) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    slots.push({
      col,
      row,
      xMm: round(originX + col * (CARD_WIDTH_MM + SHEET_GAP_X_MM)),
      yMm: round(originY + row * (CARD_HEIGHT_MM + SHEET_LABEL_MM + SHEET_GAP_Y_MM)),
    });
  }
  return slots;
}

/** The height of one caption line under a card, in millimetres. */
export const SHEET_LABEL_HEIGHT_MM = SHEET_LABEL_MM;

/** Trim a floating-point value so the emitted CSS stays clean. */
export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
