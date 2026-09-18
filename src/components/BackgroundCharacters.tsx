/**
 * BackgroundCharacters — the vibrant pet-character backdrop.
 *
 * The same friendly animal emoji as always (dog, cat, bunny, bird, fish,
 * hamster, plus paw prints and a bone) hugging the screen edges — but no
 * longer a whisper. Owner request: "keep the existing background, just make
 * the background images darker and more vibrant." So this layer is now a
 * present, colourful backdrop that gives the paper some life instead of a 5%
 * ghost of one.
 *
 * What changed (and why):
 *  - Opacity is roughly 4–5x higher: each glyph sits at 0.22–0.36 instead of
 *    0.05–0.07, tuned per glyph so the tray reads as a saturated backdrop and
 *    still never fights the ink.
 *  - The accent glow is much stronger: `textShadowRadius` 18–22 (was 12) and
 *    the glow now uses the vivid accent / accent2 tokens plus their deep
 *    700 variants for depth, so the saturated glyphs carry more weight and
 *    read darker against the paper.
 *  - Everything structural is untouched: same emoji set, same per-glyph
 *    positions, sizes and rotations, same mount order.
 *
 * The earlier "Phase 1 Broadsheet" rule (a whisper-quiet 5–7% opacity paper
 * texture) is superseded by the owner request above; the comments here
 * describe the current intent, not that retired rule.
 *
 * Readability still governs: every glyph hugs an edge or a corner, cards,
 * headings and body text stay free to paint above the layer, and the mix
 * leans on the darker 700 accents where text density is highest. If a glyph
 * ever competes with copy, lower that glyph's opacity — do not raise the
 * others.
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
  /** Backdrop weight — present, but still under the ink. */
  opacity: number;
  /** Vivid accent glow behind the glyph (a COLOR token). */
  glow: string;
  /** Glow spread in points; larger = more saturated halo. */
  glowRadius: number;
}

/**
 * Distinct species hugging the edges/corners — never center-screen under
 * content. Two small paw prints fill the gaps between the larger animals.
 * Opacities sit in the 0.22–0.36 band: a real backdrop, not paper texture.
 * The darker `accent700` / `accent2_700` glows are used where a glyph sits
 * closest to line after line of copy, so the vibrancy never costs legibility.
 */
const CHARACTERS: BackgroundCharacter[] = [
  { glyph: '🐶', size: 64, top: '7%', left: '5%', rotation: -12,
    opacity: 0.34, glow: COLOR.accent700, glowRadius: 22 },
  { glyph: '🐱', size: 58, top: '5%', right: '6%', rotation: 10,
    opacity: 0.32, glow: COLOR.accent2, glowRadius: 22 },
  { glyph: '🐾', size: 30, top: '17%', right: '24%', rotation: 24,
    opacity: 0.24, glow: COLOR.accent, glowRadius: 18 },
  { glyph: '🐰', size: 52, top: '30%', left: '3%', rotation: -8,
    opacity: 0.28, glow: COLOR.accent700, glowRadius: 20 },
  { glyph: '🐦', size: 50, top: '32%', right: '4%', rotation: 8,
    opacity: 0.30, glow: COLOR.accent2_700, glowRadius: 20 },
  { glyph: '🦴', size: 44, top: '53%', left: '7%', rotation: -24,
    opacity: 0.22, glow: COLOR.textMuted, glowRadius: 18 },
  { glyph: '🐟', size: 54, top: '68%', left: '5%', rotation: 12,
    opacity: 0.30, glow: COLOR.accent, glowRadius: 20 },
  { glyph: '🐹', size: 56, top: '66%', right: '6%', rotation: -10,
    opacity: 0.34, glow: COLOR.accent2, glowRadius: 22 },
  { glyph: '🐾', size: 34, bottom: '10%', left: '38%', rotation: -18,
    opacity: 0.22, glow: COLOR.accent2_700, glowRadius: 18 },
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
    // Baseline glow spread; each glyph overrides this (18–22).
    textShadowRadius: 20,
  },
});
