/**
 * BackgroundCharacters — vibrant, playful pet-character backdrop.
 *
 * A subtle background decoration layer: large friendly animal emoji
 * (dog, cat, bunny, bird, fish, hamster, plus paw prints and a bone)
 * scattered around the screen edges at low opacity, with playful color
 * pops from the warm app palette via soft glows.
 *
 * Fully offline: pure RN Views/Text only. Emoji glyphs are rendered
 * client-side by the OS — no image assets, no network calls, no new
 * dependencies — and work on both Android and the web preview.
 *
 * Mount as the FIRST child of a screen's root container. The layer is
 * absolutely positioned (`absoluteFill`) and never intercepts touches
 * (`pointerEvents="none"`). Because it is the first sibling, later content
 * (scrollables, cards, buttons) naturally paints above it on both native
 * and web — no zIndex tricks needed. All color tokens come from `AppColors` — no
 * literal hex values in this file.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { AppColors } from '../theme';

interface BackgroundCharacter {
  /** The emoji glyph — rendered by the OS, no asset needed. */
  glyph: string;
  /** Glyph size in points. */
  size: number;
  /** Edge-anchored position (percent strings are valid DimensionValues). */
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  /** Tilt in degrees, e.g. -12. */
  rotation: number;
  /** Low-to-medium so text and cards stay perfectly readable. */
  opacity: number;
  /** Warm-palette glow (an AppColors token) for the color pop. */
  glow: string;
}

/**
 * Distinct species hugging the edges/corners — never center-screen under
 * content. Two small paw prints fill the gaps between the larger animals.
 */
const CHARACTERS: BackgroundCharacter[] = [
  { glyph: '🐶', size: 64, top: '7%', left: '5%', rotation: -12, opacity: 0.16, glow: AppColors.primary },
  { glyph: '🐱', size: 58, top: '5%', right: '6%', rotation: 10, opacity: 0.15, glow: AppColors.accent },
  { glyph: '🐾', size: 30, top: '17%', right: '24%', rotation: 24, opacity: 0.12, glow: AppColors.textMuted },
  { glyph: '🐰', size: 52, top: '30%', left: '3%', rotation: -8, opacity: 0.14, glow: AppColors.sage },
  { glyph: '🐦', size: 50, top: '32%', right: '4%', rotation: 8, opacity: 0.14, glow: AppColors.accent },
  { glyph: '🦴', size: 44, top: '53%', left: '7%', rotation: -24, opacity: 0.12, glow: AppColors.primary },
  { glyph: '🐟', size: 54, top: '68%', left: '5%', rotation: 12, opacity: 0.14, glow: AppColors.sage },
  { glyph: '🐹', size: 56, top: '66%', right: '6%', rotation: -10, opacity: 0.15, glow: AppColors.primary },
  { glyph: '🐾', size: 34, bottom: '10%', left: '38%', rotation: -18, opacity: 0.1, glow: AppColors.textMuted },
];

export default function BackgroundCharacters(): React.JSX.Element {
  return (
    <View style={styles.layer} pointerEvents="none">
      {CHARACTERS.map((character) => (
        <Text
          key={`${character.glyph}-${character.rotation}`}
          style={[
            styles.character,
            {
              fontSize: character.size,
              top: character.top,
              bottom: character.bottom,
              left: character.left,
              right: character.right,
              opacity: character.opacity,
              transform: [{ rotate: `${character.rotation}deg` }],
              textShadowColor: character.glow,
            },
          ]}
        >
          {character.glyph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  character: {
    position: 'absolute',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
});
