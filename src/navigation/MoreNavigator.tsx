/**
 * The "More" slot: one stack that hosts everything outside Home / Pets /
 * Records, so the five-slot shell keeps every screen reachable.
 *
 * There are exactly **four real tabs** — Home, Pets, Records and More
 * (`MainTabParamList` in RootNavigator) — plus the "+" the tab bar draws, which
 * opens the Quick Add modal and is not a route. Sitter Mode has **never been a
 * sixth tab** since the Command Center shell shipped: it is the `Sitter` stack
 * nested right here, and the More menu's HANDOFF group is its command surface.
 * The old "sixth tab" wording in older notes is history, not this tree.
 *
 *   MoreHome      — the HANDOFF command screen: Your circle / Handoff / Shop &
 *                   settings / Privacy (see the OS content map §2.5).
 *   Shop          — the existing Shop stack nested here (Blueprint Premium,
 *                   search, settings and the four live keepsake products). It
 *                   used to be its own tab.
 *   Sitter        — the existing Sitter Mode stack nested here (care passes,
 *                   the Leaving Town wizard, caregiver check-in, Travel / Vet /
 *                   Emergency Mode, the printable binder, the sitter's "open a
 *                   pass", per-pet care instructions). It is a top-level
 *                   destination with its own stack and its own premium gate —
 *                   reached as a stack under More, never as a tab.
 *   EmergencyCard — the pet's emergency card details. It used to be its own tab.
 *   ComingSoon    — the illustrated placeholder for Care Circle / Care Calendar.
 *
 * Nesting the Shop and Sitter stacks keeps those screens' own in-page headers,
 * premium gates and storage exactly as they were — this phase only moves where
 * they hang in the tree. Deep links push the nested navigator straight onto the
 * wanted screen, so Android's back gesture returns to MoreHome in one step:
 * every More-menu row does `navigate('Sitter', { screen })`, the child stack is
 * created *at* that screen, and a single back step pops the whole `Sitter`
 * route back to this menu (vetted in the chunk 1/5 walk at both widths).
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
