/**
 * The Command Center building blocks (design Phase A).
 *
 * Five lean components that every screen refresh from here on reuses, so the
 * look is built once instead of copied per screen:
 *
 *  - `CCCard`         — the white card: 18–24px corners, soft ambient shadow,
 *                       optional tinted glow, optional 4px top accent stripe.
 *  - `CCGradientCard` — a hero card painted with one of the owner's five
 *                       gradients (pet / health / memories / achievements /
 *                       premium). Use it sparingly — hero, milestone, premium.
 *  - `CCSectionTitle` — a serif small-caps eyebrow + a strong title, with an
 *                       optional trailing slot and a paw/emoji accent.
 *  - `CCPill`         — a rounded state badge in one of the palette tones.
 *  - `CCButton`       — the primary (Blueprint Blue) / secondary / tinted
 *                       button, 14–18px corners, soft blue-shadow.
 *  - `CCEmptyState`   — the illustrated prompt that replaces a boring empty
 *                       state: emoji mascot, friendly line, one strong action
 *                       ("Who runs your house?" → "+ Add My Pet").
 *
 * Every colour, radius and shadow comes from `../theme` — no literal hex
 * values here. `CCGradientCard` is the only component that uses
 * `expo-linear-gradient` (an Expo SDK module, fully offline); the rest are
 * plain Views, so they stay cheap and portable. On platforms where the
 * gradient module cannot paint (it degrades to a flat fill), the first
 * gradient colour still carries the card.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SHADOW, SPACE, TONE } from '../theme';
import { gradientColors } from '../theme';
import type { GradientName, ToneName } from '../theme';

/* ------------------------------------------------------------------ card -- */

export interface CCCardProps {
  children: React.ReactNode;
  /** Tinted halo behind the card (a `COLOR` token) — the subtle coloured glow. */
  glowTint?: string;
  /** A 4px stripe across the card's top edge (a `COLOR` token). */
  accent?: string;
  /** Hero sizing: default `RADIUS.card`, pass `RADIUS.cardLg` for a hero. */
  radius?: number;
  /** Overrides the default 20px padding. */
  padding?: number;
  /** Makes the whole card a button. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** A white card on the ivory canvas, with soft shadow and optional accents. */
export function CCCard({
  children,
  glowTint,
  accent,
  radius = RADIUS.card,
  padding = SPACE.s4,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: CCCardProps): React.JSX.Element {
  const body = (
    <View
      style={[
        styles.card,
        { borderRadius: radius, padding },
        glowTint ? glowFor(glowTint) : SHADOW.card,
        style,
      ]}
    >
      {accent ? <View style={[styles.topAccent, { backgroundColor: accent, borderRadius: 2 }]} /> : null}
      {children}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** The glow recipe for a card tint — wide, low-opacity, hugs the card. */
function glowFor(tint: string): ViewStyle {
  return {
    shadowColor: tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 5,
  };
}

/* ---------------------------------------------------------- gradient card -- */

export interface CCGradientCardProps {
  children: React.ReactNode;
  /** Which of the owner's five gradients to paint with. */
  gradient: GradientName;
  radius?: number;
  padding?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * A hero card painted with a named gradient: pet (Blue→Lavender), health
 * (Aqua→Green), memories (Coral→Lavender), achievements (Sunshine→Tangerine)
 * or premium (Navy→Violet). Text inside should be white — see `ccOnGradient`.
 */
export function CCGradientCard({
  children,
  gradient,
  radius = RADIUS.card,
  padding = SPACE.s4,
  onPress,
  style,
  accessibilityLabel,
  testID,
}: CCGradientCardProps): React.JSX.Element {
  const body = (
    <LinearGradient
      colors={gradientColors(gradient)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientCard,
        { borderRadius: radius, padding },
        SHADOW.raised,
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}
    >
      {body}
    </Pressable>
  );
}

/** Text/eyebrow tones for copy sitting on a gradient (white, with soft alpha). */
export const ccOnGradient = StyleSheet.create({
  title: { fontFamily: FONT_HEAD, fontWeight: '700', fontSize: 20, color: COLOR.white },
  body: { fontFamily: FONT_BODY, fontSize: 13.5, color: 'rgba(255,255,255,0.92)' },
  eyebrow: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.9)',
  },
});

/* -------------------------------------------------------- section header -- */

export interface CCSectionTitleProps {
  /** The small-caps serif line above the title (e.g. "Care & handoff"). */
  eyebrow: string;
  /** The section's strong title. */
  title: string;
  /** Decorative emoji shown before the eyebrow (a paw, food bowl, heart…). */
  emoji?: string;
  /** Eyebrow tint (a `COLOR` token); defaults to Blueprint Blue. */
  accent?: string;
  /** Optional right-hand slot (a link, a count, a pill). */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** A serif small-caps eyebrow over a strong title — the section rhythm. */
export function CCSectionTitle({
  eyebrow,
  title,
  emoji,
  accent = COLOR.accent,
  right,
  style,
}: CCSectionTitleProps): React.JSX.Element {
  return (
    <View style={[styles.sectionTitle, style]}>
      <View style={styles.sectionHeadRow}>
        <Text style={[styles.sectionEyebrow, { color: accent }]}>
          {emoji ? `${emoji} ` : ''}
          {eyebrow}
        </Text>
        {right}
      </View>
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ pill -- */

export interface CCPillProps {
  label: string;
  /** Palette tone for the pill's soft fill and deep text. */
  tone?: ToneName;
  /** Optional leading emoji. */
  emoji?: string;
  /** Solid variant: saturated fill with white text (for status "Active"). */
  filled?: boolean;
  /** Which solid colour to fill with (a `COLOR` token); defaults to blue. */
  fill?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** A rounded state badge — soft tone by default, solid on request. */
export function CCPill({
  label,
  tone = 'neutral',
  emoji,
  filled,
  fill = COLOR.accent,
  style,
  textStyle,
}: CCPillProps): React.JSX.Element {
  const toneColors = TONE[tone];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: filled ? fill : toneColors.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          { color: filled ? COLOR.white : toneColors.fg },
          textStyle,
        ]}
      >
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------------- button -- */

export interface CCButtonProps {
  label: string;
  onPress: () => void;
  /** `primary` Blueprint Blue · `secondary` white · `tinted` custom fill. */
  variant?: 'primary' | 'secondary' | 'tinted';
  /** Fill for the `tinted` variant (a `COLOR` token). */
  tint?: string;
  /** Optional leading emoji. */
  emoji?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** The Command Center button: 16px corners, soft shadow, one clear action. */
export function CCButton({
  label,
  onPress,
  variant = 'primary',
  tint = COLOR.blue,
  emoji,
  disabled,
  style,
  accessibilityLabel,
  testID,
}: CCButtonProps): React.JSX.Element {
  const isPrimary = variant === 'primary';
  const isTinted = variant === 'tinted';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        isPrimary && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        isTinted && { backgroundColor: tint, ...SHADOW.button },
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: isPrimary || isTinted ? COLOR.white : COLOR.text },
        ]}
      >
        {emoji ? `${emoji} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------ empty state -- */

export interface CCEmptyStateProps {
  /** The mascot — one emoji, large. */
  emoji: string;
  /** The friendly line (a question works best: "Who runs your house?"). */
  title: string;
  /** One or two supporting sentences. */
  message?: string;
  /** The single strong action; omit for a read-only prompt. */
  actionLabel?: string;
  onAction?: () => void;
  /** Tint for the mascot halo and the action's fill. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The illustrated prompt that replaces a boring empty state. */
export function CCEmptyState({
  emoji,
  title,
  message,
  actionLabel,
  onAction,
  accent = COLOR.blue,
  style,
  testID,
}: CCEmptyStateProps): React.JSX.Element {
  return (
    <View style={[styles.emptyState, style]} testID={testID}>
      <View style={[styles.emptyHalo, { backgroundColor: haloFor(accent) }]}>
        <Text style={styles.emptyEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMessage}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <CCButton
          label={actionLabel}
          onPress={onAction}
          tint={accent}
          variant={accent === COLOR.blue ? 'primary' : 'tinted'}
          style={styles.emptyButton}
        />
      ) : null}
    </View>
  );
}

/** A 14%-alpha version of the accent for the mascot halo. */
function haloFor(accent: string): string {
  switch (accent) {
    case COLOR.aqua:
      return 'rgba(49,215,215,0.20)';
    case COLOR.sunshine:
      return 'rgba(255,216,77,0.28)';
    case COLOR.coral:
      return 'rgba(255,107,120,0.16)';
    case COLOR.lavender:
      return 'rgba(155,120,255,0.18)';
    case COLOR.leaf:
      return 'rgba(85,201,141,0.20)';
    case COLOR.tangerine:
      return 'rgba(255,149,72,0.18)';
    default:
      return COLOR.accentSoft;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    overflow: 'hidden',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  gradientCard: { overflow: 'hidden' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },

  sectionTitle: { marginTop: SPACE.s6, marginBottom: SPACE.s2 },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.s2,
  },
  sectionEyebrow: {
    fontFamily: FONT_HEAD,
    fontSize: 11.5,
    letterSpacing: 1.7,
    textTransform: 'uppercase',
  },
  sectionTitleText: {
    fontFamily: FONT_HEAD,
    fontSize: 21,
    fontWeight: '700',
    color: COLOR.text,
    letterSpacing: -0.2,
    marginTop: 3,
  },

  pill: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: RADIUS.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontFamily: FONT_BODY, fontSize: 12, fontWeight: '700' },

  button: {
    borderRadius: RADIUS.button,
    paddingVertical: 14,
    paddingHorizontal: SPACE.s4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: COLOR.accent, ...SHADOW.button },
  buttonSecondary: {
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    ...SHADOW.card,
  },
  buttonText: { fontFamily: FONT_HEAD, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.55 },

  emptyState: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.cardLg,
    borderWidth: 1,
    borderColor: COLOR.divider,
    paddingVertical: SPACE.s6,
    paddingHorizontal: SPACE.s4,
    alignItems: 'center',
    gap: SPACE.s2,
    ...SHADOW.card,
  },
  emptyHalo: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.s1,
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 20,
    fontWeight: '700',
    color: COLOR.text,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: COLOR.textMuted,
    textAlign: 'center',
  },
  emptyButton: { alignSelf: 'stretch', marginTop: SPACE.s2 },
});
