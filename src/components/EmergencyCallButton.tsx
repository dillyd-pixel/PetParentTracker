/**
 * The one button Emergency Mode needs: a Call button that only exists when
 * there is a real number behind it.
 *
 * Native: a `Pressable` that hands `tel:<number>` to the platform through
 * `Linking.openURL` — nothing else, no messaging, no share, no network.
 *
 * Web (the browser preview): a real anchor carrying the same `tel:` href, so
 * the number is visible and verifiable in the DOM (`[data-testid]` → `href`)
 * and a phone-shaped browser can hand it to the dialler. `react-native-web`
 * renders a `Text` with an `href` as an `<a>`; the visual styling stays in the
 * same `StyleSheet` as the native branch, so the two look identical.
 *
 * The caller passes the href from `phoneCallHref()`, which returns null for
 * anything that is not a callable number — so this component is never rendered
 * with a dead target.
 */
import React from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SHADOW, SPACE } from '../theme';

export interface EmergencyCallButtonProps {
  /** Button text, e.g. "Call the vet". */
  label: string;
  /** The `tel:` URL, from `phoneCallHref()` — never empty. */
  href: string;
  /** The number as the owner typed it, shown under the button. */
  phone: string;
  /** The stable testID for this call target. */
  testID: string;
  /** What a screen reader hears, e.g. "Call the vet at 555 0100". */
  accessibilityLabel: string;
  /** Optional line under the button (who it reaches). */
  caption?: string;
}

/** `href` on a React Native `Text` — a react-native-web extension. */
type WebLinkProps = { href: string };

export default function EmergencyCallButton({
  label,
  href,
  phone,
  testID,
  accessibilityLabel,
  caption,
}: EmergencyCallButtonProps): React.JSX.Element {
  const text = `📞 ${label}`;

  return (
    <View style={styles.wrap}>
      {Platform.OS === 'web' ? (
        <Text
          {...(({ href } as unknown) as WebLinkProps)}
          style={styles.button}
          testID={testID}
          accessibilityRole="link"
          accessibilityLabel={accessibilityLabel}
        >
          {text}
        </Text>
      ) : (
        <Pressable
          style={styles.button}
          onPress={() => {
            // The only outward act in this feature: hand the number to the
            // dialler. A platform with no dialler simply does nothing.
            void Linking.openURL(href);
          }}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          testID={testID}
        >
          <Text style={styles.buttonText}>{text}</Text>
        </Pressable>
      )}
      <Text style={styles.number} accessibilityLabel={`Number ${phone}`}>
        {phone}
        {caption ? ` · ${caption}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', marginTop: SPACE.s3 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: COLOR.accent2,
    color: COLOR.white,
    borderRadius: RADIUS.button,
    paddingVertical: 12,
    paddingHorizontal: SPACE.s4,
    fontFamily: FONT_HEAD,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'none',
    ...SHADOW.button,
  },
  buttonText: {
    fontFamily: FONT_HEAD,
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.white,
  },
  number: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLOR.textMuted,
    marginTop: SPACE.s1,
  },
});
