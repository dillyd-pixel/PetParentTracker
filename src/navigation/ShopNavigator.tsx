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
        options={{ title: 'Blueprint Premium' }}
      />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="PetPlanner" options={{ title: 'Pet Planner' }}>
        {() => (
          <PlaceholderScreen
            title="Printable Pet Planner"
            noun="PDF that prints at home — generated on-device, no server"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="MemorialBook" options={{ title: 'Memorial Book' }}>
        {() => (
          <PlaceholderScreen
            title="Memorial Book"
            noun="keepsake book generated on-device from your records"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Artwork" options={{ title: 'Custom Artwork' }}>
        {() => (
          <PlaceholderScreen
            title="Custom Pet Artwork"
            noun="artwork generated on-device from your pet photo"
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="EmergencyCard" options={{ title: 'Emergency Card' }}>
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
