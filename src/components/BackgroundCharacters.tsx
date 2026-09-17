/**
 * BackgroundCharacters — the quiet pet-character backdrop.
 *
 * A whisper-quiet decoration layer: friendly animal emoji (dog, cat, bunny,
 * bird, fish, hamster, plus paw prints and a bone) hugging the screen edges,
 * with the faintest accent glow.
 *
 * Phase 1 of the Broadsheet port turned this layer right down: the design is
 * typographic and paper-flat, so the characters are now a texture (5–7%
 * opacity, no strong colour pops) that complements the ink-and-teal palette
 * instead of competing with it. They stay mounted on every screen.
 *
 * Fully offline: pure RN Views/Text only. Emoji glyphs are rendered
 * client-side by the OS — no image assets, no network calls, no new
 * dependencies — and work on both Android and the web preview.
 *
 * Mount as the FIRST child of a screen's root container. The layer is
 * absolutely positioned and never intercepts touches
 * (`pointerEvents="none"`). Because it is the first sibling, later content
 * (scrollables, cards, buttons) naturally paints above it on both native
 * and web — no zIndex tricks needed. All color tokens come from `COLOR` — no
 * literal hex values in this file.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { COLOR } from '../theme';

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
  /** Very low so text and rules stay perfectly readable. */
  opacity: number;
  /** Whisper-faint accent glow (a COLOR token). */
  glow: string;
}

/**
 * Distinct species hugging the edges/corners — never center-screen under
 * content. Two small paw prints fill the gaps between the larger animals.
 * Opacities are deliberately tiny: this is paper texture, not decoration.
 */
const CHARACTERS: BackgroundCharacter[] = [
  { glyph: '🐶', size: 64, top: '7%', left: '5%', rotation: -12, opacity: 0.07, glow: COLOR.accent },
  { glyph: '🐱', size: 58, top: '5%', right: '6%', rotation: 10, opacity: 0.07, glow: COLOR.accent2 },
  { glyph: '🐾', size: 30, top: '17%', right: '24%', rotation: 24, opacity: 0.06, glow: COLOR.textMuted },
  { glyph: '🐰', size: 52, top: '30%', left: '3%', rotation: -8, opacity: 0.06, glow: COLOR.accent },
  { glyph: '🐦', size: 50, top: '32%', right: '4%', rotation: 8, opacity: 0.06, glow: COLOR.accent2 },
  { glyph: '🦴', size: 44, top: '53%', left: '7%', rotation: -24, opacity: 0.05, glow: COLOR.textFaint },
  { glyph: '🐟', size: 54, top: '68%', left: '5%', rotation: 12, opacity: 0.06, glow: COLOR.accent },
  { glyph: '🐹', size: 56, top: '66%', right: '6%', rotation: -10, opacity: 0.07, glow: COLOR.accent2 },
  { glyph: '🐾', size: 34, bottom: '10%', left: '38%', rotation: -18, opacity: 0.05, glow: COLOR.textFaint },
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
