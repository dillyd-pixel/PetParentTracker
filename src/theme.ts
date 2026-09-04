/**
 * Central app theme — tweak once to re-theme everything.
 *
 * Warm pet-app palette: cream backgrounds, warm terracotta primary, soft
 * amber accent, calm sage secondary. All screens reference these tokens —
 * no literal hex values in screen stylesheets.
 */
import type { ViewStyle } from 'react-native';

export const AppColors = {
  /** Warm terracotta — primary buttons, active tab, selected chips. */
  primary: '#D96C47',
  primaryDark: '#B8552F',
  /** Soft amber — highlights, reminders, "due soon" states. */
  accent: '#E9A13B',
  /** Calm sage — secondary/positive states ("up to date", success). */
  sage: '#7D9B76',
  /** Cream/off-white app background. */
  background: '#FAF4EA',
  /** Warm white cards and sheets. */
  card: '#FFFDF8',
  /** Warm sand borders and disabled fills. */
  border: '#EBDDC8',
  /** Warm espresso body text. */
  text: '#3F3226',
  /** Warm muted secondary text. */
  textMuted: '#8A7663',
  /** Input placeholders and inactive glyphs. */
  placeholder: '#B3A48E',
  /** Off-state switch tracks. */
  trackOff: '#D9CBB4',
  /** Warm scrim behind bottom sheets. */
  overlay: 'rgba(63,50,38,0.45)',
  danger: '#C2492F',
  white: '#FFFFFF',
};

/** Soft warm drop shadow for cards and floating buttons. */
export const cardShadow: ViewStyle = {
  shadowColor: '#3F3226',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
};
