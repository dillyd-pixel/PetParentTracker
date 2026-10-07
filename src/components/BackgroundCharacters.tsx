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
 * Glyphs hug the top corners (bleeding off the top edge so they read as peeking
 * in above the header rather than sitting under the header copy), the left and
 * right margins, and the strip just above the bottom tab bar. Sizes run 26–42
 * points with a slight tilt each, and each carries a soft palette halo from
 * `COLOR` (`textShadowRadius` at 14–18, centred so it is a wash, never a sticker
 * outline). Opacity sits in the 0.30–0.36 band: the earlier 0.08–0.16 pass was,
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
 * Crop-proof fit (owner feedback 2026-10-07: "Adjust the background itself to
 * comply, fit perfectly and be compatible with each view so the image is not cut
 * off in any way"). One near-square master cannot cover both a 0.46 phone and a
 * 1.7 desktop without slicing the illustration: cover fits the image to the
 * viewport's *longest* side, so it cuts whichever side has canvas to spare. The
 * wallpaper is therefore three aspect-adaptive masters of the SAME illustration
 * — the art is copied in pixel for pixel, and only cream is added around it (see
 * /home/team/shared/background-ref/make-wallpaper-masters.py):
 *
 *   wallpaper-portrait.png   1213x2760   art + 732px cream top/bottom (460 fade)
 *   wallpaper.png            2013x1296   art + 400px cream left/right (380 fade)
 *   wallpaper-landscape.png  3111x1296   art + 949px cream left/right (460 fade)
 *
 * Each pad begins on the art's own edge pixels and eases into the app canvas
 * (#F7F1E7 = `COLOR.bg`) over its fade, so the join is invisible and the far end
 * of the pad is exactly the canvas colour — the wallpaper melts into the app
 * background at the screen edge instead of ending on a hard line. `cover` still
 * does the fitting; the master is now chosen so that the direction cover crops
 * holds only cream, which keeps the illustration whole on every screen:
 *
 *   aspect = width / height   band chosen              whole art visible for
 *   <= 0.936                  portrait master          aspect 0.44 – 0.94
 *   0.936 – 1.35              mid master               0.94 – 1.55
 *   > 1.35                    landscape master         1.35 – 2.40
 *
 * (Each master's safe band is `1213 / masterHeight` to `masterWidth / 1296` —
 * outside it the art itself is clipped, so the bands above stay inside them.)
 * On a phone the art now fills the viewport width with cream fades above and
 * below, keeping today's composition (pets over the top, wave landscape at the
 * bottom, cream centre behind the cards) with nothing cut; on desktop the art
 * fills the height and is flanked by the fades. `wallpaperSourceFor` does the
 * choice from `useWindowDimensions`, so a rotation or a resized browser window
 * re-picks the master on the spot.
 *
 * Fully offline: three bundled masters resolved with static `require`s plus
 * OS-rendered emoji — no network, no new dependencies — and it works on Android
 * and the web preview alike. All colour tokens come from `COLOR` — no literal hex values in
 * this file except the transparent-free glyph layer itself.
 */
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { DimensionValue, ImageSourcePropType } from 'react-native';

import { COLOR } from '../theme';

/**
 * The three wallpaper masters, differing only in how much cream canvas they
 * carry around the identical illustration. Static `require`s: no dynamic path
 * building, so the bundler ships exactly these three assets.
 */
const WALLPAPER = {
  /** 1213x2760 — art with 732px of cream above and below (tall/portrait). */
  portrait: require('../../assets/wallpaper-portrait.png'),
  /** 2013x1296 — art with 400px of cream either side (near-square). */
  mid: require('../../assets/wallpaper.png'),
  /** 3111x1296 — art with 949px of cream either side (wide/landscape). */
  landscape: require('../../assets/wallpaper-landscape.png'),
};

/**
 * Band edges for `aspect = width / height`. They sit on each master's safe
 * limit (`1213 / masterHeight` for tall windows, `masterWidth / 1296` for wide
 * ones), so the master in use always shows the whole illustration; within a
 * band the art is as large as the viewport allows.
 */
const PORTRAIT_MAX_ASPECT = 0.936;   // portrait master fills the width to here
const MID_MAX_ASPECT = 1.35;         // mid master fills the height past here

/**
 * Pick the master for a window aspect. Exported for the offline test harness:
 * it is pure, so the bands can be checked without a device.
 */
export function wallpaperSourceFor(aspect: number): ImageSourcePropType {
  if (!Number.isFinite(aspect) || aspect <= 0) return WALLPAPER.mid;
  if (aspect <= PORTRAIT_MAX_ASPECT) return WALLPAPER.portrait;
  if (aspect <= MID_MAX_ASPECT) return WALLPAPER.mid;
  return WALLPAPER.landscape;
}

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
  { glyph: '🐶', size: 40, top: -14, left: -8, rotation: -12,
    opacity: 0.32, glow: COLOR.blue, glowRadius: 18 },
  { glyph: '🐱', size: 34, top: -12, right: -8, rotation: 10,
    opacity: 0.30, glow: COLOR.lavender, glowRadius: 18 },
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
  // The layer covers the whole window, so the window's own shape decides which
  // master can be shown whole. Re-picking on every size change keeps rotation
  // and browser resizes crop-free.
  const { width, height } = useWindowDimensions();
  const source = wallpaperSourceFor(height > 0 ? width / height : 1);

  return (
    <View style={styles.layer} pointerEvents="none">
      <Image source={source} style={styles.wallpaper} resizeMode="cover" />
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
