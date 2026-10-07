/**
 * BackgroundCharacters — the app's wallpaper layer.
 *
 * Owner decision 2026-10-07: "Use the background reference image to restyle the
 * background and have it as a wallpaper." The reference image (staged at
 * /home/team/shared/background-ref/reference.png, derived asset committed as
 * `assets/wallpaper.png`) is now the atmosphere of every screen: warm cream
 * canvas, botanical clusters hugging the edges, the pets peeking over the top
 * band, and the soft wave / bone landscape along the bottom.
 *
 * The asset is the illustration only. The staged reference is a screenshot of
 * this app's own Keepsakes screen, so its pixels also contained four white
 * product cards, the "KEEPSAKES (ON HOLD)" title and an info card; painting that
 * raw would have put ghost card copy behind the live UI. The wallpaper keeps the
 * art untouched and repaints those UI areas with the surrounding canvas
 * (see /home/team/shared/background-ref/make-wallpaper.py, which produced it).
 *
 * The previous emoji-glyph pass is gone. At 8–16% opacity those glyphs read as
 * atmosphere over an empty canvas, but they fight a full illustration — the
 * reference already carries pets, paws, leaves and a bone, so the wallpaper is
 * the atmosphere now. Nothing else about the layer changed: it is still the
 * FIRST child of a screen's root container, absolutely positioned, and never
 * intercepts touches (`pointerEvents="none"`). Because it is the first sibling,
 * later content (scrollables, cards, buttons) paints above it on both native and
 * web — no zIndex tricks needed.
 *
 * Legibility: the reference keeps its centre clean cream exactly where the white
 * cards sit, and the art lives on the outer edges, so no overlay wash is used
 * and no copy treatment was needed. White cards, species art and photos inside
 * cards are untouched.
 *
 * Fully offline: one bundled asset resolved with `require` — no network, no new
 * dependencies, works on Android and the web preview. `resizeMode="cover"` means
 * a tall phone viewport crops the near-square art left/right (it keeps the cream
 * centre, the pets and the bottom landscape) while a wide desktop viewport crops
 * it top/bottom (it keeps the cream centre and the edge clusters).
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function BackgroundCharacters(): React.JSX.Element {
  return (
    <View style={styles.layer} pointerEvents="none">
      <Image
        source={require('../../assets/wallpaper.png')}
        style={styles.wallpaper}
        resizeMode="cover"
      />
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
});
