/**
 * BackgroundCharacters — the calm decorative backdrop of the Command Center.
 *
 * The same friendly animal emoji as always (dog, cat, bunny, bird, fish,
 * hamster, plus paw prints and a bone) hugging the screen edges, but a step
 * quieter than the earlier "vibrant" pass. Owner direction 2026-09-19: under
 * the new white cards the characters are *decorative atmosphere inside the
 * layout*, not stickers floating over empty space — so this layer drops to
 * roughly 8–16% opacity, keeps every glyph on an edge or a corner, and leans
 * on the new palette (Aqua, Lavender, Sunshine, Coral, Leaf) for its glow.
 *
 * The coloured halo is now a soft, wide, low-saturation wash rather than a
 * saturated sticker outline: `textShadowRadius` 14–18 at a gentle tint, so a
 * glyph never competes with a card, a heading or body copy painted above it.
 * The glyph set, per-glyph positions and rotations are unchanged from the
 * previous phase — only weight and colour moved.
 *
 * Readability governs: if a glyph ever competes with copy, lower that glyph's
 * opacity — do not raise the others.
 *
 * Fully offline: pure RN Views/Text only. Emoji glyphs are rendered
 * client-side by the OS — no image assets, no network calls, no new
 * dependencies — and work on both Android and the web preview.
 *
 * Mount as the FIRST child of a screen's root container. The layer is
 * absolutely positioned and never intercepts touches
 * (`pointerEvents="none"`). Because it is the first sibling, later content
 * (scrollables, cards, buttons) paints above it on both native and web — no
 * zIndex tricks needed. All colour tokens come from `COLOR` — no literal hex
 * values in this file.
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
  /** Backdrop weight — decorative atmosphere, well under the ink. */
  opacity: number;
  /** Soft palette halo behind the glyph (a COLOR token). */
  glow: string;
  /** Halo spread in points; larger = wider, softer wash. */
  glowRadius: number;
}

/**
 * Species hugging the edges/corners — never center-screen under content, and
 * clustered toward the top and the lower thirds, where the hero and section
 * areas of the new layout give them room. Opacities sit in the 0.08–0.16 band:
 * present as atmosphere, never as a sticker.
 */
const CHARACTERS: BackgroundCharacter[] = [
  { glyph: '🐶', size: 62, top: '6%', left: '4%', rotation: -12,
    opacity: 0.14, glow: COLOR.blue, glowRadius: 18 },
  { glyph: '🐱', size: 56, top: '4%', right: '5%', rotation: 10,
    opacity: 0.13, glow: COLOR.lavender, glowRadius: 18 },
  { glyph: '🐾', size: 28, top: '16%', right: '26%', rotation: 24,
    opacity: 0.10, glow: COLOR.aqua, glowRadius: 14 },
  { glyph: '🐰', size: 50, top: '29%', left: '3%', rotation: -8,
    opacity: 0.11, glow: COLOR.lavender, glowRadius: 16 },
  { glyph: '🐦', size: 48, top: '31%', right: '3%', rotation: 8,
    opacity: 0.12, glow: COLOR.sunshine, glowRadius: 16 },
  { glyph: '🦴', size: 42, top: '52%', left: '6%', rotation: -24,
    opacity: 0.09, glow: COLOR.tangerine, glowRadius: 14 },
  { glyph: '🐟', size: 52, top: '67%', left: '4%', rotation: 12,
    opacity: 0.12, glow: COLOR.aqua, glowRadius: 16 },
  { glyph: '🐹', size: 54, top: '65%', right: '5%', rotation: -10,
    opacity: 0.14, glow: COLOR.coral, glowRadius: 18 },
  { glyph: '🐾', size: 32, bottom: '9%', left: '38%', rotation: -18,
    opacity: 0.09, glow: COLOR.leaf, glowRadius: 14 },
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
              textShadowRadius: character.glowRadius,
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
    // Baseline halo spread; each glyph overrides this (14–18).
    textShadowRadius: 16,
  },
});
