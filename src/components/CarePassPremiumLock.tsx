/**
 * The Blueprint Premium gate for Sitter Mode's *creator* side.
 *
 * Creating a care pass is a premium feature, so it uses the app's existing
 * gate: `usePremium().isPremium()` (the 14-day free trial or the one-time
 * unlock). Non-entitled users are never blocked from finding the feature —
 * they see the button and land on the premium screen — which is what
 * `useGoToPremium` wires up, mirroring the co-parent share rows' lock.
 *
 * Opening a pass a pet parent shares with you is deliberately NOT gated: the
 * sitter's side stays free, account-free and premium-free (see
 * `OpenCarePassScreen`), exactly like importing a co-parent's share.
 *
 * 100% offline: local premium state + navigation only.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BS } from '../theme';

/**
 * Route to the Blueprint Premium screen nested in the Shop tab. The current
 * navigator doesn't own that screen, so react-navigation bubbles the action up
 * to the tab navigator — the same hop the co-parent share rows make.
 */
export function useGoToPremium(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  return () => {
    try {
      navigation.navigate('Shop', { screen: 'Premium' });
    } catch {
      // Navigation must never crash a screen — the lock copy stays visible.
    }
  };
}

/**
 * The lock card shown where the create form would be. `title`/`body` let each
 * entry point say what is gated in its own words.
 */
export function CarePassPremiumLock({
  title = 'Creating a Care Pass — Blueprint Premium',
  body = 'Hand a trusted sitter their own pass: pick the pets, the dates and what they may do. Part of Blueprint Premium — start your 14-day free trial.',
}: {
  title?: string;
  body?: string;
}): React.JSX.Element {
  const goToPremium = useGoToPremium();
  return (
    <View style={BS.card}>
      <Text style={BS.cardKicker}>Blueprint Premium</Text>
      <Text style={BS.cardTitleLg}>🔒 {title}</Text>
      <Text style={BS.body}>{body}</Text>
      <TouchableOpacity
        style={BS.btnPrimary}
        onPress={goToPremium}
        accessibilityRole="button"
        accessibilityLabel="Start free for 14 days"
      >
        <Text style={BS.btnPrimaryText}>Start free for 14 days</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={BS.btnSecondary}
        onPress={goToPremium}
        accessibilityRole="button"
        accessibilityLabel="Unlock Blueprint Premium"
      >
        <Text style={BS.btnSecondaryText}>Unlock Blueprint Premium</Text>
      </TouchableOpacity>
      <Text style={[BS.caption, { textAlign: 'center' }]}>
        Opening a pass a pet parent shares with you is always free.
      </Text>
    </View>
  );
}
