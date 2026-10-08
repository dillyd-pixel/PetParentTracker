/**
 * HeroPets — the app's two heroes, drawn as a real illustration layer.
 *
 * Owner direction 2026-10-07: "use the dog/cat as hero characters peeking over
 * the top card/header, rather than faint background stickers." The previous pass
 * put the pets in the wallpaper and floated flat emoji over the edges, which
 * read as stickers. This is the replacement: the cat AND the dog — the two
 * characters from the owner's reference art, cut out of it and bundled as
 * `assets/hero-pets.png` (see /home/team/shared/background-ref/extract-pets.py)
 * — peek over the top card on Home, side by side.
 *
 * Both characters, not one. The first cut framed the pair the way the reference
 * art happens to crop it (the dog filling the frame, a sliver of the cat's ear
 * at the left edge), which read as a dog hero with a stray ear. The art is now
 * reframed on the two heads: the cat's whole head — both ears, muzzle, whiskers
 * and paws — is in frame at the left, the dog's at the right, the cat in front
 * exactly as the reference layers them. Nothing about the layer's geometry
 * changed: same 58pt peek, same 2pt bottom tuck, same right insets.
 *
 * How the peek works. The component renders nothing but an absolutely
 * positioned layer whose BOTTOM edge sits exactly on the top edge of the card it
 * is placed above (`bottom: '100%'` inside the card's wrapper), and the art's
 * own bottom edge tucks `HERO_TUCK` below that line, into the card. So:
 *
 *   * the heroes are never *drawn over* the card — the card's own top edge cuts
 *     them, which is what "peeking over" looks like and needs no z-index work;
 *   * the layer is a sibling that precedes the card, so the card (and every other
 *     screen element) paints above it if they ever touch;
 *   * the layer is mounted inside the scrolled content, so the heroes travel with
 *     the card instead of floating in the window while the page scrolls;
 *   * it never intercepts touches and is hidden from screen readers.
 *
 * The art's bottom row is the line the card cuts the pets on — the cut-out is
 * cropped there rather than at the baked drop shadow's edge, so scaling the art
 * down cannot leave a gap between the pets and the card.
 *
 * Placement per breakpoint. The heroes fill the margin between the screen header
 * and the top card and nothing else, so they can never sit under a title, a
 * button or a link. That margin is a *fixed* 70pt at every window size (the
 * header is the same height and the card's top edge lands on y≈153 either way),
 * so the peek is the same on every breakpoint — 58pt of art, 56pt of it visible —
 * and only the right-hand inset changes, to keep the art inboard of the window
 * edge on a wide screen. Verified in the browser at 390x844, 768x1024 and
 * 1440x900: no hero rectangle intersects the header title, the Search link or the
 * Settings gear at any of the three — see the probe numbers in the PR.
 *
 * Motion. One very gentle breath (a 2% scale, 2pt rise over ~5s) so the pair
 * feels alive. It animates transform only, on the native driver, and it is
 * decoration: with reduce-motion on, the art simply sits still.
 *
 * 100% offline: one bundled asset, no network, no new dependencies.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

/** The cut-out pair (cat + dog), both characters fully in frame. */
const HERO = require('../../assets/hero-pets.png');
/** The cut-out's own aspect ratio (455x181 at source), so the peek height sets the width. */
const HERO_ASPECT = 455 / 181;

/** How tall the art is, and how far in from the content's right edge it sits. */
type HeroLayout = { peek: number; right: number };
/**
 * The art's height in points. The band above the card is the same 70pt at every
 * breakpoint (see the placement note above), so this is too: the art spans
 * y 94–154 while the header's lowest control (the gear) ends at y 83, which
 * leaves an 11pt clear gap *after* the breath animation's 1.02 scale. A taller
 * art on a wide screen would only eat that clearance in exchange for nothing.
 */
const HERO_PEEK = 58;
/**
 * How far the art's bottom edge tucks below the card's top edge. The card paints
 * after this layer, so the tuck is hidden and the art is cut exactly on the
 * card's top edge — the look of a pet standing behind the card. 2pt of tuck
 * absorbs sub-pixel rounding instead of leaving a hairline of canvas.
 */
const HERO_TUCK = 2;

function layoutFor(width: number): HeroLayout {
  if (width >= 1024) return { peek: HERO_PEEK, right: 120 };
  if (width >= 700) return { peek: HERO_PEEK, right: 84 };
  return { peek: HERO_PEEK, right: 20 };
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
    bottom: -HERO_TUCK,
    // Explicit size so react-native-web lays the art out from the style, not
    // from the asset's intrinsic pixels.
    aspectRatio: HERO_ASPECT,
  },
});
