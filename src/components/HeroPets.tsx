/**
 * HeroPets — the app's two heroes, drawn as a real illustration layer.
 *
 * Owner direction 2026-10-07: "use the dog/cat as hero characters peeking over
 * the top card/header, rather than faint background stickers." The previous pass
 * put the pets in the wallpaper and floated flat emoji over the edges, which
 * read as stickers. This is the replacement: the cat and the dog — the actual
 * characters from the owner's reference art, cut out of it and bundled as
 * `assets/hero-pets.png` (see /home/team/shared/background-ref/extract-pets.py)
 * — peek over the top card on Home.
 *
 * How the peek works. The component renders nothing but an absolutely
 * positioned layer whose BOTTOM edge sits exactly on the top edge of the card it
 * is placed above (`bottom: '100%'` inside the card's wrapper), and the art's
 * own bottom edge is flush with that line. So:
 *
 *   * the heroes are never *drawn over* the card — the card's own top edge cuts
 *     them, which is what "peeking over" looks like and needs no z-index work;
 *   * the layer is a sibling that precedes the card, so the card (and every other
 *     screen element) paints above it if they ever touch;
 *   * the layer is mounted inside the scrolled content, so the heroes travel with
 *     the card instead of floating in the window while the page scrolls;
 *   * it never intercepts touches and is hidden from screen readers.
 *
 * Placement per breakpoint. The heroes fill the margin between the screen header
 * and the top card and nothing else, so they can never sit under a title, a
 * button or a link: the height below is the visible peek, tuned to that margin
 * (phone 54pt, tablet 62, desktop 70) and the right offset keeps them clear of
 * the header's own right-hand controls. Measured in the browser at 390x844,
 * 768x1024 and 1440x900 — see the probe numbers in the PR.
 *
 * Motion. One very gentle breath (a 2% scale, 2pt rise over ~5s) so the pair
 * feels alive. It animates transform only, on the native driver, and it is
 * decoration: with reduce-motion on, the art simply sits still.
 *
 * 100% offline: one bundled asset, no network, no new dependencies.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/** The cut-out pair (cat + dog), as it peeks in the owner's reference art. */
const HERO = require('../../assets/hero-pets.png');
/** The cut-out's own aspect ratio (379x172 at source), so the peek height sets the width. */
const HERO_ASPECT = 379 / 172;

/** How tall the visible peek is, and how far in from the window's right edge. */
type HeroLayout = { peek: number; right: number };

function layoutFor(width: number): HeroLayout {
  if (width >= 1024) return { peek: 70, right: 120 };
  if (width >= 700) return { peek: 62, right: 84 };
  return { peek: 54, right: 20 };
}

export default function HeroPets(): React.JSX.Element {
  const { width } = useWindowDimensions();
  const layout = layoutFor(width);
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const translateY = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });

  return (
    <View
      style={styles.layer}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID="home-hero-pets"
    >
      <Animated.Image
        source={HERO}
        resizeMode="contain"
        style={[
          styles.hero,
          {
            height: layout.peek,
            width: layout.peek * HERO_ASPECT,
            right: layout.right,
            transform: [{ translateY }, { scale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * A zero-height strip sitting on the top edge of the card it is placed above:
   * `bottom: '100%'` puts this layer's own bottom edge exactly on the wrapper's
   * top edge, which is the card's top edge.
   */
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '100%',
    height: 0,
  },
  hero: {
    position: 'absolute',
    bottom: 0,
    // Explicit size so react-native-web lays the art out from the style, not
    // from the asset's intrinsic pixels.
    aspectRatio: HERO_ASPECT,
  },
});
