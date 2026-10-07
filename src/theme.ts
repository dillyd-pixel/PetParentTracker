/**
 * Central app theme — the "Pet Parent Command Center" design system (Phase A).
 *
 * The owner's 2026-09-19 direction replaces the print-inspired Broadsheet look
 * with a bright, dimensional, premium command centre: a warm ivory canvas, one
 * white card per idea, a vivid core palette, soft layered shadows with subtle
 * coloured glows, and generous 18–24px corners. The Blueprint brand stays — the
 * editorial serif is still used for "The Blueprint" and for headings — but the
 * pets, not a calendar, are the visual focus.
 *
 * Everything the app renders draws from the tokens below; screens never
 * hard-code a hex value. `COLOR` keeps every token name the Broadsheet phase
 * introduced (so all existing screens immediately pick up the new palette),
 * and adds the new named hues. New code should prefer the named tokens
 * (`COLOR.blue`, `COLOR.aqua`, …) and the `RADIUS` / `SHADOW` / `GRADIENT`
 * scales.
 *
 * Exports:
 *  - `COLOR`     — the palette (map of old token → new hue is documented inline).
 *  - `RADIUS`    — corner scale (cards 18–24, buttons 14–18, pills 999).
 *  - `SHADOW`    — soft layered shadows; `glow(tint)` for the coloured halo
 *                  behind hero cards and primary buttons.
 *  - `GRADIENT`  — the owner's five gradients, as [from, to] colour pairs.
 *  - `SPACE`/`S` — the 5/10/15/20/30 spacing scale.
 *  - `FONT_HEAD` — the display serif for "The Blueprint", headings, big numbers.
 *  - `FONT_BODY` — the clean sans for body, forms, buttons and nav.
 *  - `BS`        — the shared style sheet screens compose.
 *  - Individual named constants (`h1`, `kicker`, `divRowBetween`, …).
 *  - `AppColors` / `cardShadow` — the older warm-palette names, kept as
 *    deprecated aliases that now resolve to these tokens.
 *
 * Font note: the design's headings are set in Source Serif 4. Bundling the
 * actual .ttf needs `expo-font` plus the font file (neither is in the project),
 * so this phase keeps `FONT_HEAD` on the platform serif — Android renders it
 * with Noto Serif, which is close to Source Serif 4. Swapping in the bundled
 * font later is a one-line change here plus `expo-font`'s `useFonts` in App.tsx.
 */
import { Platform, StyleSheet } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

/**
 * The Command Center palette.
 *
 * Mapping from the Broadsheet tokens this replaced:
 *  - `accent`     teal #0088b0 → Blueprint Blue #246BFD (primary actions, links)
 *  - `accent700`  deep teal    → deep Blueprint Blue (text-weight blue)
 *  - `accent2`    magenta      → Coral #FF6B78 (attention, reminders, premium)
 *  - `bg`         newsprint    → Warm Ivory #FFFDF8 (the app canvas — the exact
 *                  colour the wallpaper's pads end on)
 *  - `surface`    darker paper → white (cards) — `surfaceSoft` keeps the tinted
 *                  fill that tags, inputs and photo blanks used to get
 *  - `text`       near-black   → Deep Ink #202126
 * The success/nutrition/achievement hues are new named tokens rather than
 * re-purposed aliases, so later phases can reach for them directly.
 */
export const COLOR = {
  /* ---- canvas & surfaces ---- */
  /**
   * Warm Ivory #FFFDF8 — the app canvas, behind every screen and card, and the
   * exact colour the wallpaper masters' pads fade to (background-ref/make-bg-v2.py).
   */
  bg: '#FFFDF8',
  /** White — the card surface (white cards on warm ivory). */
  surface: '#FFFFFF',
  /** Soft warm tint — tags, inputs, photo blanks, dashed empty boxes. */
  surfaceSoft: '#F7F1E6',
  /** A hair darker than the canvas — use for subtle section bands. */
  canvasSoft: '#F1E9DC',

  /* ---- ink ---- */
  /** Deep Ink — main text and strong contrast. */
  text: '#202126',
  /** Secondary text (~62% ink) — still reads clearly on ivory. */
  textMuted: 'rgba(32,33,38,0.62)',
  /** Tertiary/hint text (~45% ink). */
  textFaint: 'rgba(32,33,38,0.45)',

  /* ---- primary: Blueprint Blue ---- */
  /** Blueprint Blue #246BFD — primary buttons, active nav, links. */
  accent: '#246BFD',
  /** Deep Blueprint Blue — link/keyline text that needs contrast on ivory. */
  accent700: '#1544B5',
  /** 12% Blueprint Blue — tinted fills, active chips, soft glows. */
  accentSoft: 'rgba(36,107,253,0.12)',

  /* ---- second accent: Coral (attention) ---- */
  /** Coral #FF6B78 — reminders, appointments, needs-attention states. */
  accent2: '#FF6B78',
  /** Deep Coral — coral-family text on ivory/white (never coral on white). */
  accent2_700: '#C33A4C',
  /** 14% Coral — attention fills and glows. */
  accent2Soft: 'rgba(255,107,120,0.14)',

  /* ---- the named core palette (the owner's exact hexes) ---- */
  /** Blueprint Blue #246BFD. */
  blue: '#246BFD',
  /** Electric Aqua #31D7D7 — wellness, water, health indicators. */
  aqua: '#31D7D7',
  /** Sunshine Yellow #FFD84D — achievements, happy moments. */
  sunshine: '#FFD84D',
  /** Coral #FF6B78 — reminders, attention. */
  coral: '#FF6B78',
  /** Lavender #9B78FF — memories, lifestyle, personalisation. */
  lavender: '#9B78FF',
  /** Leaf Green #55C98D — completed, positive health, success. */
  leaf: '#55C98D',
  /** Tangerine #FF9548 — food, nutrition, expenses, play. */
  tangerine: '#FF9548',
  /** Warm Ivory #FFFDF8 (alias of `bg`, for named-token call sites). */
  ivory: '#FFFDF8',
  /** Deep Ink #202126 (alias of `text`). */
  ink: '#202126',

  /* ---- premium ---- */
  /** Lavender — premium markers and kickers. */
  premium: '#9B78FF',
  /** Deep Violet — premium text on ivory/white. */
  premiumDeep: '#6B45D9',
  /** Deep Navy — the dark end of the premium gradient. */
  premiumNavy: '#22307A',
  /** Violet — the light end of the premium gradient. */
  premiumViolet: '#8A4DFF',

  /* ---- support ---- */
  /** Soft "brand" tint behind a pill or eyebrow (Lavender at 16%). */
  brandSoft: 'rgba(155,120,255,0.16)',
  /** Hairline rules and borders (~10% ink — lighter than the print look). */
  divider: 'rgba(32,33,38,0.10)',
  /** Neutral grey — inert glyphs. */
  neutral500: '#8F8D8C',
  /** Scrim behind modals — ink at 45%. */
  scrim: 'rgba(32,33,38,0.45)',
  /** Pure white — text/icons on a saturated fill. */
  white: '#FFFFFF',
};

/** The 5/10/15/20/30 spacing scale (a.k.a. `S`). */
export const SPACE = { s1: 5, s2: 10, s3: 15, s4: 20, s6: 30 };

/** Short alias for `SPACE`. */
export const S = SPACE;

/**
 * Corner scale. Major cards take 18–24px (they should feel soft and
 * dimensional, not printed), buttons 14–18px, chips and avatars stay round.
 */
export const RADIUS = {
  cardSm: 18,
  card: 22,
  cardLg: 24,
  sheet: 28,
  button: 16,
  buttonSm: 14,
  input: 14,
  thumb: 14,
  pill: 999,
};

/**
 * Soft layered shadows. Two ideas repeat across the design: an ambient drop
 * (very low opacity, wide blur, no harsh edge) and a tinted glow that hugs the
 * card in its own colour. `glow(tint)` builds the second.
 */
export const SHADOW: {
  card: ViewStyle;
  raised: ViewStyle;
  pop: ViewStyle;
  button: ViewStyle;
} = {
  /** Standard white card: soft ambient drop. */
  card: {
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  /** Hero / active card: a touch further off the canvas. */
  raised: {
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 5,
  },
  /** Floating surfaces (the centre nav button, quick-add sheet). */
  pop: {
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  /** Primary (blue) button. */
  button: {
    shadowColor: COLOR.blue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
};

/**
 * A coloured halo behind a card or pill — the "subtle coloured glow" of the
 * direction. Pass a palette token (e.g. `glow(COLOR.aqua)`); the tint only ever
 * shows as a soft halo, never as a fill.
 */
export function glow(tint: string, strength = 0.28, height = 10, radius = 22): ViewStyle {
  return {
    shadowColor: tint,
    shadowOffset: { width: 0, height },
    shadowOpacity: strength,
    shadowRadius: radius,
    elevation: 5,
  };
}

/**
 * The owner's five gradients, as [from, to] colour pairs (both hex strings, so
 * they can be handed straight to `expo-linear-gradient`).
 *
 * Use them selectively: the active pet's hero card, the health card, a
 * memories strip, a milestone/badge surface and the premium card. Never every
 * surface — the ivory canvas and white cards carry the layout.
 */
export const GRADIENT = {
  /** Pet / profile — Blueprint Blue → Lavender. */
  pet: [COLOR.blue, COLOR.lavender] as const,
  /** Health — Aqua → Leaf Green. */
  health: [COLOR.aqua, COLOR.leaf] as const,
  /** Memories — Coral → Lavender. */
  memories: [COLOR.coral, COLOR.lavender] as const,
  /** Achievements — Sunshine → Tangerine. */
  achievements: [COLOR.sunshine, COLOR.tangerine] as const,
  /** Premium / special — Deep Navy → Violet. */
  premium: [COLOR.premiumNavy, COLOR.premiumViolet] as const,
};

/** A named gradient, as a mutable tuple `expo-linear-gradient` accepts. */
export type GradientName = keyof typeof GRADIENT;

/** The `colors` array for a named gradient (widened for the gradient module). */
export function gradientColors(name: GradientName): [string, string] {
  return [GRADIENT[name][0], GRADIENT[name][1]];
}

/**
 * Per-hue pill/badge tones: a soft translucent fill plus a deep, readable text
 * colour from the same family (never a saturated hue straight onto white).
 * `TONE.blue.bg` behind `TONE.blue.fg` is contrast-checked on ivory and white.
 */
export const TONE = {
  blue: { bg: 'rgba(36,107,253,0.12)', fg: COLOR.accent700 },
  aqua: { bg: 'rgba(49,215,215,0.18)', fg: '#0F7C7C' },
  sunshine: { bg: 'rgba(255,216,77,0.30)', fg: '#7E5A0B' },
  coral: { bg: 'rgba(255,107,120,0.16)', fg: COLOR.accent2_700 },
  lavender: { bg: 'rgba(155,120,255,0.18)', fg: COLOR.premiumDeep },
  leaf: { bg: 'rgba(85,201,141,0.20)', fg: '#1C7A4B' },
  tangerine: { bg: 'rgba(255,149,72,0.18)', fg: '#A05212' },
  neutral: { bg: COLOR.surfaceSoft, fg: COLOR.textMuted },
} as const;

/** A tone name from `TONE`. */
export type ToneName = keyof typeof TONE;

/**
 * The display serif for "The Blueprint", headings and big numbers.
 *
 * TODO(font): replace with the bundled "Source Serif 4" family once
 * `expo-font` + the .ttf asset can be added to the project (see file header).
 */
export const FONT_HEAD = Platform.select({
  ios: 'Source Serif Pro',
  android: 'serif',
  default: 'serif',
});

/** The clean sans for body copy, forms, buttons and the nav bar. */
export const FONT_BODY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});

/**
 * Shorthand for a full-bleed screen: fills its parent.
 *
 * Transparent on purpose — the app root (App.tsx) paints the Warm Cream canvas
 * *behind* the wallpaper layer, so a screen root that filled itself with
 * `COLOR.bg` would hide the wallpaper. Real surfaces (cards, sheets, the paper
 * previews, modal scrims) still paint their own colour; only the full-screen
 * roots and the navigator scenes are see-through.
 */
const SCREEN: ViewStyle = { flex: 1, backgroundColor: 'transparent' };

/** The bottom tab bar's height, above the home indicator; screens pad for it. */
const TAB_BAR_SPACE = 108;

/**
 * The shared Command Center style sheet. Compose with `BS.h1`, `BS.card`, … or
 * import the individual names re-exported below.
 */
export const BS = StyleSheet.create({
  /** Screen root: ivory canvas, fills the navigator's content area. */
  screen: SCREEN,
  /** Standard scroll content padding, with room for the 5-slot tab bar. */
  pad: { padding: SPACE.s4, paddingBottom: TAB_BAR_SPACE },

  /* ---- type ---- */
  h1: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 30,
    color: COLOR.text,
    letterSpacing: -0.3,
    marginBottom: SPACE.s2,
  },
  /** Serif eyebrow above a screen title or section (“small caps serif”). */
  eyebrow: {
    fontFamily: FONT_HEAD,
    fontSize: 11.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLOR.accent,
    marginBottom: 2,
    fontStyle: 'normal',
  },
  kicker: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  body: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    lineHeight: 24,
    color: COLOR.text,
    marginVertical: SPACE.s2,
  },
  /** Quiet supporting line. Kept upright — italic is reserved for pet voice. */
  italic: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLOR.textMuted,
    paddingVertical: SPACE.s1,
  },
  caption: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted },
  link: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLOR.accent,
    fontWeight: '700',
    fontStyle: 'normal',
  },
  rowLabel: { fontFamily: FONT_BODY, fontSize: 16, fontWeight: '600', color: COLOR.text },
  strike: { textDecorationLine: 'line-through', color: COLOR.textMuted },

  /* ---- layout ---- */
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACE.s3,
  },
  row: { flexDirection: 'row', gap: SPACE.s2 },
  /** The tappable home title block in the Home header. */
  homeTitlePress: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s1, flexShrink: 1 },
  /** In-place rename: the h1 itself becomes the field. */
  homeTitleInput: {
    flex: 1,
    marginRight: SPACE.s2,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  /** The quiet "you can rename this" glyph beside the title. */
  homeTitlePencil: { fontSize: 14, color: COLOR.textFaint },
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
    fontFamily: FONT_HEAD,
    fontSize: 11.5,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLOR.accent,
    marginBottom: SPACE.s2,
  },
  input: {
    fontFamily: FONT_BODY,
    minHeight: 46,
    paddingHorizontal: SPACE.s3,
    fontSize: 15,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: RADIUS.input,
  },
  seg: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.buttonSm,
    overflow: 'hidden',
  },
  segOpt: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segOptActive: { backgroundColor: COLOR.accent },
  segText: { fontFamily: FONT_BODY, fontSize: 13, color: COLOR.text },
  segTextActive: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLOR.white,
    fontWeight: '700',
  },

  /* ---- buttons ---- */
  btnPrimary: {
    backgroundColor: COLOR.accent,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: SPACE.s4,
    alignItems: 'center',
    ...SHADOW.button,
  },
  btnPrimaryText: {
    color: COLOR.white,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: FONT_HEAD,
  },
  btnSecondary: {
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: SPACE.s4,
    alignItems: 'center',
    ...SHADOW.card,
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
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.surfaceSoft,
  },
  tagActive: { backgroundColor: COLOR.accent },
  tagText: { fontFamily: FONT_BODY, fontSize: 13, color: COLOR.text },
  tagTextActive: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: COLOR.white,
    fontWeight: '700',
  },
  tagAccent2: { backgroundColor: COLOR.accent2Soft },
  tagNeutral: { backgroundColor: COLOR.surfaceSoft },
  tagTextAccent2: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLOR.accent2_700,
    fontWeight: '700',
  },
  tagTextNeutral: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.text },

  /* ---- cards ---- */
  /** The standard white card: 22px corners, soft shadow, no hard rule. */
  card: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.card,
    padding: SPACE.s4,
    marginTop: SPACE.s4,
    gap: SPACE.s2,
    borderWidth: 1,
    borderColor: COLOR.divider,
    ...SHADOW.card,
  },
  cardKicker: {
    fontFamily: FONT_HEAD,
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: COLOR.premiumDeep,
  },
  cardTitleLg: {
    fontFamily: FONT_HEAD,
    fontSize: 19,
    fontWeight: '700',
    color: COLOR.text,
    lineHeight: 25,
  },
  priceText: { fontFamily: FONT_HEAD, fontSize: 19, fontWeight: '700', color: COLOR.premiumDeep },

  /* ---- media ---- */
  /** The big photo plate on a pet's page. */
  petPhotoBox: {
    height: 180,
    backgroundColor: COLOR.surfaceSoft,
    borderRadius: RADIUS.card,
    marginBottom: SPACE.s3,
    overflow: 'hidden',
  },
  /** Small round avatar used in list rows when a pet has a photo. */
  avatar: { width: 40, height: 40, borderRadius: RADIUS.pill, backgroundColor: COLOR.surfaceSoft },
  /** The emoji stand-in shown in the same slot when there is no photo. */
  avatarEmoji: { fontSize: 26, width: 40, textAlign: 'center' },
  thumb: { width: 46, height: 58, borderRadius: RADIUS.thumb },
  thumbBlank: { backgroundColor: COLOR.surfaceSoft },
  recordPreview: {
    width: '100%',
    height: 180,
    borderRadius: RADIUS.cardSm,
    marginBottom: SPACE.s3,
  },
  dashedBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    borderRadius: RADIUS.card,
    padding: 26,
    alignItems: 'center',
    marginBottom: SPACE.s3,
  },

  /* ---- tab bar (the shell draws its own; kept for completeness) ---- */
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
    backgroundColor: COLOR.surface,
    paddingVertical: 10,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabText: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textMuted },
  tabTextActive: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.accent, fontWeight: '700' },
});

/* Individual named styles, for screens that import only what they use. */
export const {
  screen,
  pad,
  h1,
  eyebrow,
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
  homeTitlePress,
  homeTitleInput,
  homeTitlePencil,
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
  avatar,
  avatarEmoji,
  thumb,
  thumbBlank,
  recordPreview,
  dashedBox,
  tabBar,
  tabItem,
  tabText,
  tabTextActive,
} = BS;

/** The muted, secondary-text tone as a `TextStyle` — handy in inline styles. */
export const MUTED_TEXT: TextStyle = { color: COLOR.textMuted };

/**
 * Legacy palette names, mapped onto the Command Center tokens.
 *
 * @deprecated Use `COLOR` (colours) and `BS` (styles) instead. Kept so the
 * screens an earlier phase did not rewrite still compile — and still pick up
 * the new design, because every value here points at a current token.
 */
export const AppColors = {
  /** @deprecated `COLOR.accent` (Blueprint Blue) — buttons, active state. */
  primary: COLOR.accent,
  /** @deprecated `COLOR.accent700` (deep Blueprint Blue). */
  primaryDark: COLOR.accent700,
  /** @deprecated `COLOR.accent2` (coral) — highlights and attention. */
  accent: COLOR.accent2,
  /** @deprecated `COLOR.neutral500` — kept for inert glyphs. */
  sage: COLOR.neutral500,
  /** @deprecated `COLOR.bg` (Warm Cream). */
  background: COLOR.bg,
  /** @deprecated `COLOR.surface` — white cards. */
  card: COLOR.surface,
  /** @deprecated `COLOR.divider`. */
  border: COLOR.divider,
  /** @deprecated `COLOR.text` (Deep Ink). */
  text: COLOR.text,
  /** @deprecated `COLOR.textMuted`. */
  textMuted: COLOR.textMuted,
  /** @deprecated `COLOR.textFaint`. */
  placeholder: COLOR.textFaint,
  /** @deprecated `COLOR.divider`. */
  trackOff: COLOR.divider,
  /** @deprecated `COLOR.scrim`. */
  overlay: COLOR.scrim,
  /** @deprecated `COLOR.accent2_700` (deep coral) — destructive/alert. */
  danger: COLOR.accent2_700,
  /** @deprecated white — text on an accent-filled button. */
  white: COLOR.white,
};

/**
 * Card elevation, as a style object screens can spread.
 *
 * The design is no longer flat print: white cards lift off the ivory canvas
 * with a soft ambient shadow. Spread it into a card style that draws its own
 * background and corners (see `BS.card` for the full recipe).
 */
export const cardShadow: ViewStyle = SHADOW.card;
