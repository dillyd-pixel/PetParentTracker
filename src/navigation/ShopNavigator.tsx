/**
 * The "Shop" tab: Blueprint Premium, co-parent share, PDF export, keepsakes.
 *
 *   ShopHome    — the design's shop page, restyled: the premium card (our
 *                 one-time unlock copy — no subscription price), the offline
 *                 co-parent share and PDF export entries, then the four
 *                 keepsake products as rows with no prices and no purchase flow.
 *   Premium     — the Blueprint Premium tier screen (14-day trial + one-time
 *                 unlock, gated on-device).
 *   Search      — the premium-gated global record search across all pets.
 *   PetPlanner, MemorialBook, Artwork, EmergencyCard — the upsell product
 *                 detail placeholders (on hold).
 *
 * Premium is not an upsell product: it is the app's paid tier, presented on its
 * own screen. The upsell products stay untouched and ON HOLD for the owner.
 *
 * Every screen here except Search draws the design's own in-page header (an
 * `h1` plus a back link), so the navigator header is hidden on those — one
 * header per screen. Search has no in-page title (the field is the page), so it
 * keeps the restyled paper header and its back button.
 *
 * Products: Printable Pet Planner, Memorial Book, Custom Pet Artwork,
 * Emergency Pet Card.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import { PAPER_HEADER } from './headerOptions';
import ShopScreen from '../screens/ShopScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import PremiumScreen from '../screens/PremiumScreen';
import SearchScreen from '../screens/SearchScreen';

export type ShopStackParamList = {
  ShopHome: undefined;
  Premium: undefined;
  Search: undefined;
  PetPlanner: undefined;
  MemorialBook: undefined;
  Artwork: undefined;
  EmergencyCard: undefined;
};

const Stack = createWebSafeStackNavigator<ShopStackParamList>();

/** The "Shop" tab: a stack whose first screen is the shop page itself. */
export function ShopNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={PAPER_HEADER}>
      <Stack.Screen name="ShopHome" component={ShopScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Premium"
        component={PremiumScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="PetPlanner" options={{ headerShown: false }}>
        {() => (
          <PlaceholderScreen
            title="Printable Pet Planner"
            noun="PDF that prints at home — generated on-device, no server"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="MemorialBook" options={{ headerShown: false }}>
        {() => (
          <PlaceholderScreen
            title="Memorial Book"
            noun="keepsake book generated on-device from your records"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Artwork" options={{ headerShown: false }}>
        {() => (
          <PlaceholderScreen
            title="Custom Pet Artwork"
            noun="artwork generated on-device from your pet photo"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="EmergencyCard" options={{ headerShown: false }}>
        {() => (
          <PlaceholderScreen
            title="Emergency Pet Card"
            noun="printable emergency info card, generated on-device"
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
