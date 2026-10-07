/**
 * BackgroundCharacters — the app's wallpaper layer (root-mounted) plus a
 * visible decorative animal layer on top of it.
 *
 * Owner direction 2026-10-07: "Use the background reference image to restyle the
 * background and have it as a wallpaper." Two pieces of the same-day preview
 * feedback shaped this revision:
 *
 *  - "I don't see the new wallpaper." The previous pass mounted this layer
 *    inside ~25 individual screens and Home — the screen the app opens on — was
 *    not one of them. It is now mounted ONCE, at the app root (App.tsx), as the
 *    first child of the root view, so every screen (Home/Today, Pets, Records,
 *    More, Shop, Sitter, onboarding and the modals) carries it, and no screen
 *    mounts it itself.
 *  - "Where are the animal images?" The wallpaper's own pet faces sit in the
 *    middle vertical bands of the art — exactly where the white cards sit, so
 *    the owner could not see them. The friendly emoji from the pre-wallpaper
 *    pass (dog, cat, bunny, bird, fish, hamster, plus paws and a bone) are back
 *    as a clearly visible layer ON TOP of the wallpaper, anchored to the screen
 *    edges and corners, never in the centre column where the content lives.
 *
 * Layer 1 — the wallpaper. The reference image (staged at
 * /home/team/shared/background-ref/reference.png, derived asset committed as
 * `assets/wallpaper.png`) is the atmosphere of every screen: warm cream canvas,
 * botanical clusters hugging the edges, the pets peeking over the top band, and
 * the soft wave / bone landscape along the bottom. The asset is the
 * illustration only: the staged reference is a screenshot of this app's own
 * Keepsakes screen, so its pixels also contained four white product cards, the
 * "KEEPSAKES (ON HOLD)" title and an info card; painting that raw would have put
 * ghost card copy behind the live UI. The wallpaper keeps the art untouched and
 * repaints those UI areas with the surrounding canvas (see
 * /home/team/shared/background-ref/make-wallpaper.py, which produced it).
 *
 * Layer 2 — the animals, drawn above the wallpaper and still under content.
 * Glyphs hug the top corners (bleeding a few points off the top edge so they
 * read as peeking in rather than sitting under the header), the left and right
 * margins, and the strip just above the bottom tab bar. Sizes run 26–44 points
 * with a slight tilt each, and each carries a soft palette halo from `COLOR`
 * (`textShadowRadius` at 14–18, centred so it is a wash, never a sticker
 * outline). Opacity sits in the 0.32–0.40 band: the earlier 0.08–0.16 pass was,
 * in the owner's words, invisible — these must be seen. Readability still
 * governs: if a glyph collides with a card edge or copy, move that glyph (the
 * centre column is off limits) rather than hiding the set again.
 *
 * Stacking contract: mount as the FIRST child of the app's root view, before the
 * navigator. The layer is absolutely positioned over the whole window and never
 * intercepts touches (`pointerEvents="none"`). Because it is the first sibling,
 * later content (the navigator, scrollables, cards, buttons) paints above it on
 * both native and web — no zIndex tricks needed. That is why screens and
 * navigator scenes paint no opaque background of their own: the app root holds
 * the Warm Cream canvas (`COLOR.bg`) *behind* this layer, the navigator theme's
 * `background` is transparent, and the shared screen root style (`BS.screen`) is
 * transparent too.
 *
 * `resizeMode="cover"` means a tall phone viewport crops the near-square art
 * left/right (it keeps the cream centre, the pets and the bottom landscape)
 * while a wide desktop viewport crops it top/bottom (it keeps the cream centre
 * and the edge clusters).
 *
 * Fully offline: one bundled asset resolved with `require` plus OS-rendered
 * emoji — no network, no new dependencies — and it works on Android and the web
 * preview alike. All colour tokens come from `COLOR` — no literal hex values in
 * this file except the transparent-free glyph layer itself.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { COLOR } from '../theme';

interface BackgroundCharacter {
  /** The emoji glyph — rendered by the OS, no asset needed. */
  glyph: string;
  /** Glyph size in points (26–44: visible, never a hero). */
  size: number;
  /** Edge-anchored position (percent strings are valid DimensionValues). */
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
  /** Tilt in degrees, e.g. -12. */
  rotation: number;
  /** Backdrop weight — visible and quiet, never under the ink. */
  opacity: number;
  /** Soft palette halo behind the glyph (a COLOR token). */
  glow: string;
  /** Halo spread in points; larger = wider, softer wash. */
  glowRadius: number;
}

/**
 * The animals, on the outer edges only: the two top corners (a few points off
 * the top edge), the left and right margins down the page, and the strip just
 * above the bottom tab bar (`bottom: 112` clears the tab bar and the 108pt
 * content padding the screens reserve for it). Nothing sits between
 * `left: '10%'` and `right: '10%'` — that is the content column.
 */
const CHARACTERS: BackgroundCharacter[] = [
  { glyph: '🐶', size: 40, top: -6, left: -6, rotation: -12,
    opacity: 0.40, glow: COLOR.blue, glowRadius: 18 },
  { glyph: '🐱', size: 34, top: -4, right: -6, rotation: 10,
    opacity: 0.38, glow: COLOR.lavender, glowRadius: 18 },
  { glyph: '🐰', size: 42, top: '29%', left: -10, rotation: -8,
    opacity: 0.34, glow: COLOR.lavender, glowRadius: 16 },
  { glyph: '🐦', size: 38, top: '32%', right: -8, rotation: 8,
    opacity: 0.34, glow: COLOR.sunshine, glowRadius: 16 },
  { glyph: '🦴', size: 32, top: '48%', left: -2, rotation: -24,
    opacity: 0.32, glow: COLOR.tangerine, glowRadius: 14 },
  { glyph: '🐾', size: 26, top: '51%', right: '2%', rotation: 24,
    opacity: 0.32, glow: COLOR.aqua, glowRadius: 14 },
  { glyph: '🐟', size: 40, top: '69%', left: -10, rotation: 12,
    opacity: 0.34, glow: COLOR.aqua, glowRadius: 16 },
  { glyph: '🐹', size: 42, top: '67%', right: -10, rotation: -10,
    opacity: 0.36, glow: COLOR.coral, glowRadius: 16 },
  { glyph: '🐾', size: 28, bottom: 118, left: '5%', rotation: -18,
    opacity: 0.32, glow: COLOR.leaf, glowRadius: 14 },
  { glyph: '🐾', size: 26, bottom: 112, right: '6%', rotation: 16,
    opacity: 0.32, glow: COLOR.coral, glowRadius: 14 },
];

export default function BackgroundCharacters(): React.JSX.Element {
  return (
    <View style={styles.layer} pointerEvents="none">
      <Image
        source={require('../../assets/wallpaper.png')}
        style={styles.wallpaper}
        resizeMode="cover"
      />
      {CHARACTERS.map((character, index) => (
        <Text
          key={`${character.glyph}-${index}`}
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
  wallpaper: {
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
