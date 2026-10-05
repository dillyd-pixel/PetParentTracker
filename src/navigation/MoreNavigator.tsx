/**
 * The "More" slot: one stack that hosts everything outside Home / Pets /
 * Records, so the five-slot shell keeps every screen reachable.
 *
 *   MoreHome      — the grouped destination screen (Your circle, Care &
 *                   handoff, Extras, Privacy).
 *   Shop          — the existing Shop stack nested here (Blueprint Premium,
 *                   search, settings and the keepsake placeholders). It used
 *                   to be its own tab.
 *   Sitter        — the existing Sitter Mode stack nested here (care passes,
 *                   the create form, the sitter's "open a pass", per-pet care
 *                   instructions). It used to be the sixth tab.
 *   EmergencyCard — the pet's emergency card. It used to be its own tab.
 *   ComingSoon    — the illustrated placeholder for Care Circle / Care Calendar.
 *
 * Nesting the Shop and Sitter stacks keeps those screens' own in-page headers,
 * premium gates and storage exactly as they were — this phase only moves where
 * they hang in the tree. Deep links push the nested navigator straight onto the
 * wanted screen, so Android's back gesture returns to MoreHome in one step.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import MoreScreen from '../screens/MoreScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';
import EmergencyCardScreen from '../screens/EmergencyCardScreen';
import { ShopNavigator } from './ShopNavigator';
import type { ShopStackParamList } from './ShopNavigator';
import { SitterNavigator } from './SitterNavigator';
import type { SitterStackParamList } from './SitterNavigator';
import type { NavigatorScreenParams } from '@react-navigation/native';

export type MoreStackParamList = {
  MoreHome: undefined;
  Shop: NavigatorScreenParams<ShopStackParamList> | undefined;
  Sitter: NavigatorScreenParams<SitterStackParamList> | undefined;
  EmergencyCard: undefined;
  ComingSoon: { title: string; emoji: string; message: string; accent?: string };
};

const Stack = createWebSafeStackNavigator<MoreStackParamList>();

/** The "More" slot: the grouped destination screen plus the stacks it hosts. */
export function MoreNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreHome" component={MoreScreen} />
      <Stack.Screen name="Shop" component={ShopNavigator} />
      <Stack.Screen name="Sitter" component={SitterNavigator} />
      <Stack.Screen name="EmergencyCard" component={EmergencyCardScreen} />
      <Stack.Screen name="ComingSoon" component={ComingSoonScreen} />
    </Stack.Navigator>
  );
}
