/**
 * Central app theme — the "Broadsheet" design system, tweak once to re-theme
 * everything.
 *
 * Ported from the owner's Claude Design prototype (`PetBlueprintApp.js`): a
 * print-inspired, editorial palette — newsprint-grey paper, near-black ink,
 * a single teal accent for actions and a magenta second accent for alerts and
 * premium. Everything the app renders draws from the tokens below; screens
 * never hard-code a hex value.
 *
 * Exports:
 *  - `COLOR`  — the palette.
 *  - `SPACE` / `S` — the 5/10/15/20/30 spacing scale.
 *  - `FONT_HEAD` — the display serif used by headings and buttons.
 *  - `BS` — the shared style sheet (46 named styles) that screens compose.
 *  - Individual named constants (`h1`, `kicker`, `divRowBetween`, …) for the
 *    same styles, so a screen can import just what it uses.
 *  - `AppColors` / `cardShadow` — the previous warm-palette names, kept as
 *    deprecated aliases that now resolve to the Broadsheet tokens. Older
 *    screens keep working (and immediately look like the new design) while
 *    later phases migrate them to `BS` + `COLOR` directly.
 *
 * Font note: the design's headings are set in Source Serif 4. Bundling the
 * actual .ttf needs `expo-font` plus the font file (neither is in the project
 * yet, and adding either needs a package/asset download), so this phase keeps
 * `FONT_HEAD` on the platform serif — Android renders it with Noto Serif,
 * which is close to Source Serif 4. Swapping in the bundled font later is a
 * one-line change here plus `expo-font`'s `useFonts` in App.tsx.
 */
import { Platform, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

/** The Broadsheet palette. */
export const COLOR = {
  /** Paper — the app background. */
  bg: '#f3f2f2',
  /** Slightly darker paper — inputs, cards, photo boxes, tags. */
  surface: '#eae9e9',
  /** Ink. */
  text: '#201e1d',
  /** Secondary text (60% ink). */
  textMuted: 'rgba(32,30,29,0.6)',
  /** Tertiary/hint text (45% ink). */
  textFaint: 'rgba(32,30,29,0.45)',
  /** Teal — primary buttons, active segment, selected chips, links. */
  accent: '#0088b0',
  /** Deep teal — link text and active tab labels. */
  accent700: '#005e7c',
  /** Magenta — premium, alerts, "due" states. */
  accent2: '#d6006c',
  /** Deep magenta — premium kickers and price text on paper. */
  accent2_700: '#98014c',
  /** Hairline rules and borders (16% ink). */
  divider: 'rgba(32,30,29,0.16)',
  /** Neutral grey — dashed empty boxes, inert glyphs. */
  neutral500: '#8f8d8c',
};

/** The 5/10/15/20/30 spacing scale (a.k.a. `S`). */
export const SPACE = { s1: 5, s2: 10, s3: 15, s4: 20, s6: 30 };

/** Short alias for `SPACE`. */
export const S = SPACE;

/**
 * The display serif for headings and button labels.
 *
 * TODO(font): replace with the bundled "Source Serif 4" family once
 * `expo-font` + the .ttf asset can be added to the project (see file header).
 */
export const FONT_HEAD = Platform.select({
  ios: 'Source Serif Pro',
  android: 'serif',
  default: 'serif',
});

/** Shorthand for a full-bleed screen: fills its parent on the paper colour. */
const SCREEN: ViewStyle = { flex: 1, backgroundColor: COLOR.bg };

/**
 * The shared Broadsheet style sheet. Compose with `BS.h1`, `BS.divRowBetween`,
 * … or import the individual names re-exported below.
 */
export const BS = StyleSheet.create({
  /** Screen root: paper background, fills the navigator's content area. */
  screen: SCREEN,
  /** Standard scroll content padding, with room for the 5-item tab bar. */
  pad: { padding: SPACE.s4, paddingBottom: 100 },

  /* ---- type ---- */
  h1: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 30,
    color: COLOR.text,
    letterSpacing: -0.3,
    marginBottom: SPACE.s2,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  body: { fontSize: 16, lineHeight: 24, color: COLOR.text, marginVertical: SPACE.s2 },
  italic: { fontSize: 14, fontStyle: 'italic', color: COLOR.textMuted, paddingVertical: SPACE.s1 },
  caption: { fontSize: 12.5, color: COLOR.textMuted },
  link: { fontSize: 13, color: COLOR.accent700, fontWeight: '600' },
  rowLabel: { fontSize: 16, fontWeight: '600', color: COLOR.text },
  strike: { textDecorationLine: 'line-through', color: COLOR.textMuted },

  /* ---- layout ---- */
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACE.s3,
  },
  row: { flexDirection: 'row', gap: SPACE.s2 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  /** Stacked row with a hairline under it (list of rows). */
  divRow: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  /** Two-ended row with a hairline under it (label … value). */
  divRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },

  /* ---- forms ---- */
  field: { marginBottom: SPACE.s4 },
  fieldLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
    marginBottom: SPACE.s1,
  },
  input: {
    minHeight: 40,
    paddingHorizontal: SPACE.s2,
    fontSize: 15,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 2,
  },
  seg: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 2,
    overflow: 'hidden',
  },
  segOpt: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segOptActive: { backgroundColor: COLOR.accent },
  segText: { fontSize: 13, color: COLOR.text },
  segTextActive: { fontSize: 13, color: COLOR.bg, fontWeight: '600' },

  /* ---- buttons ---- */
  btnPrimary: {
    backgroundColor: COLOR.accent,
    borderRadius: 2,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: COLOR.bg,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: FONT_HEAD,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 2,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: COLOR.text,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: FONT_HEAD,
  },

  /* ---- tags / chips ---- */
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLOR.surface,
  },
  tagActive: { backgroundColor: COLOR.accent },
  tagText: { fontSize: 13, color: COLOR.text },
  tagTextActive: { fontSize: 13, color: COLOR.bg, fontWeight: '600' },
  tagAccent2: { backgroundColor: 'rgba(214,0,108,0.15)' },
  tagNeutral: { backgroundColor: COLOR.surface },
  tagTextAccent2: { fontSize: 12, color: COLOR.accent2_700, fontWeight: '600' },
  tagTextNeutral: { fontSize: 12, color: COLOR.text },

  /* ---- cards ---- */
  card: {
    borderWidth: 1.5,
    borderColor: COLOR.text,
    padding: SPACE.s4,
    marginTop: SPACE.s4,
    gap: SPACE.s2,
  },
  cardKicker: {
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLOR.accent2_700,
  },
  cardTitleLg: {
    fontFamily: FONT_HEAD,
    fontSize: 19,
    fontWeight: '700',
    color: COLOR.text,
    lineHeight: 25,
  },
  priceText: { fontSize: 19, fontWeight: '600', color: COLOR.accent2_700 },

  /* ---- media ---- */
  /** The big photo plate on a pet's page. */
  petPhotoBox: { height: 180, backgroundColor: COLOR.surface, marginBottom: SPACE.s3 },
  thumb: { width: 46, height: 58, borderRadius: 2 },
  thumbBlank: { backgroundColor: COLOR.surface },
  recordPreview: { width: '100%', height: 180, borderRadius: 2, marginBottom: SPACE.s3 },
  dashedBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLOR.neutral500,
    padding: 30,
    alignItems: 'center',
    marginBottom: SPACE.s3,
  },

  /* ---- tab bar ---- */
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
    backgroundColor: COLOR.bg,
    paddingVertical: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabText: { fontSize: 11, color: COLOR.textMuted },
  tabTextActive: { fontSize: 11, color: COLOR.accent700, fontWeight: '700' },
});

/* Individual named styles, for screens that import only what they use. */
export const {
  screen,
  pad,
  h1,
  kicker,
  body,
  italic,
  caption,
  link,
  rowLabel,
  strike,
  rowBetween,
  row,
  rowWrap,
  divRow,
  divRowBetween,
  field,
  fieldLabel,
  input,
  seg,
  segOpt,
  segOptActive,
  segText,
  segTextActive,
  btnPrimary,
  btnPrimaryText,
  btnSecondary,
  btnSecondaryText,
  tag,
  tagActive,
  tagText,
  tagTextActive,
  tagAccent2,
  tagNeutral,
  tagTextAccent2,
  tagTextNeutral,
  card,
  cardKicker,
  cardTitleLg,
  priceText,
  petPhotoBox,
  thumb,
  thumbBlank,
  recordPreview,
  dashedBox,
  tabBar,
  tabItem,
  tabText,
  tabTextActive,
} = BS;

/**
 * Legacy palette names, mapped onto the Broadsheet tokens.
 *
 * @deprecated Use `COLOR` (colours) and `BS` (styles) instead. Kept so the
 * screens this phase did not rewrite still compile — and still pick up the new
 * design, because every value here points at a Broadsheet token.
 */
export const AppColors = {
  /** @deprecated `COLOR.accent` (teal) — buttons, active/selected state. */
  primary: COLOR.accent,
  /** @deprecated `COLOR.accent700` (deep teal). */
  primaryDark: COLOR.accent700,
  /** @deprecated `COLOR.accent2` (magenta) — premium and highlights. */
  accent: COLOR.accent2,
  /** @deprecated `COLOR.neutral500` — cards stay on paper now. */
  sage: COLOR.neutral500,
  /** @deprecated `COLOR.bg` (paper). */
  background: COLOR.bg,
  /** @deprecated `COLOR.surface` — cards and inputs sit on darker paper. */
  card: COLOR.surface,
  /** @deprecated `COLOR.divider`. */
  border: COLOR.divider,
  /** @deprecated `COLOR.text` (ink). */
  text: COLOR.text,
  /** @deprecated `COLOR.textMuted`. */
  textMuted: COLOR.textMuted,
  /** @deprecated `COLOR.textFaint`. */
  placeholder: COLOR.textFaint,
  /** @deprecated `COLOR.divider`. */
  trackOff: COLOR.divider,
  /** @deprecated No scrims in the Broadsheet design; ink at 45%. */
  overlay: 'rgba(32,30,29,0.45)',
  /** @deprecated `COLOR.accent2_700` (deep magenta) — destructive/alert. */
  danger: COLOR.accent2_700,
  /** @deprecated `COLOR.bg` — text on an accent-filled button. */
  white: COLOR.bg,
};

/**
 * The design is flat print: no drop shadows. Exported as an empty style so
 * screens that still spread it keep compiling.
 *
 * @deprecated Card outlines (`BS.card`) carry the hierarchy now.
 */
export const cardShadow: ViewStyle = {};
