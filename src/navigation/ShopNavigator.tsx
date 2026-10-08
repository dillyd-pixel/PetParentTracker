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
 *   Settings    — the device-level account settings: the owner's name, the time
 *                 zone dates/times are shown in, the live premium/billing
 *                 details, and the "delete account" wipe. Lives here rather
 *                 than in a sixth tab, so the five-tab IA stays as designed.
 *   PetPlanner     — the Printable Pet Planner (upsell product 1/4): pick pets,
 *                 toggle 14 sections, choose Letter or A4, preview for free and
 *                 (premium) generate / download / print / share the on-device PDF.
 *   PetPlannerPreview — the full-screen preview of the generated document.
 *   MemorialBook   — the Pet Memorial Book (upsell product 2/4): one pet's
 *                 memories, journal, milestones and lifetime timeline, with an
 *                 optional note from the owner, preview free and (premium)
 *                 generate / download / print / share the on-device PDF.
 *   MemorialBookPreview — the full-screen preview of the generated book.
 *   Artwork        — Custom Pet Artwork (upsell product 3/4): one pet with a
 *                 photo, five template looks with a live preview, an optional
 *                 caption, Letter or A4, preview free and (premium) generate /
 *                 download / print / share the on-device PDF.
 *   ArtworkPreview — the full-screen preview of the generated sheet.
 *   EmergencyCard  — the last upsell product placeholder (on hold).
 *
 * Premium is not an upsell product: it is the app's paid tier, presented on its
 * own screen. The one keepsake product still unbuilt — the emergency card pack —
 * stays untouched and ON HOLD for the owner.
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
import PetPlannerScreen from '../screens/PetPlannerScreen';
import PlannerPreviewScreen from '../screens/PlannerPreviewScreen';
import MemorialBookScreen from '../screens/MemorialBookScreen';
import MemorialBookPreviewScreen from '../screens/MemorialBookPreviewScreen';
import ArtworkScreen from '../screens/ArtworkScreen';
import ArtworkPreviewScreen from '../screens/ArtworkPreviewScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import PremiumScreen from '../screens/PremiumScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import type { PaperSize, PlannerSectionId } from '../pdf/planner/sections';
import type { MemorialSectionId } from '../pdf/memorial/sections';
import type { ArtworkTemplateId } from '../pdf/artwork/templates';

export type ShopStackParamList = {
  ShopHome: undefined;
  Premium: undefined;
  Search: undefined;
  Settings: undefined;
  PetPlanner: undefined;
  /** The preview for one set of planner choices (all values are serializable). */
  PetPlannerPreview: {
    petIds: string[];
    sectionIds: PlannerSectionId[];
    paper: PaperSize;
    /** Web only: open the browser print dialog as soon as it has rendered. */
    autoPrint?: boolean;
  };
  MemorialBook: undefined;
  /** The preview for one set of memorial-book choices (all serializable). */
  MemorialBookPreview: {
    /** The one pet the book is about. */
    petId: string | null;
    sectionIds: MemorialSectionId[];
    paper: PaperSize;
    /** The owner's own words for the letter page (still just text, not a file). */
    note?: string;
    /** Web only: open the browser print dialog as soon as it has rendered. */
    autoPrint?: boolean;
  };
  Artwork: undefined;
  /** The preview for one set of artwork choices (all values are serializable). */
  ArtworkPreview: {
    /** The one pet the piece is about. */
    petId: string | null;
    /** The look being framed in (an unknown id falls back to the default). */
    templateId: ArtworkTemplateId | string;
    paper: PaperSize;
    /** The owner's own words for the caption (still just text, not a file). */
    caption?: string;
    /** Web only: open the browser print dialog as soon as it has rendered. */
    autoPrint?: boolean;
  };
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
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="PetPlanner" component={PetPlannerScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PetPlannerPreview"
        component={PlannerPreviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemorialBook"
        component={MemorialBookScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemorialBookPreview"
        component={MemorialBookPreviewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Artwork" component={ArtworkScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="ArtworkPreview"
        component={ArtworkPreviewScreen}
        options={{ headerShown: false }}
      />
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
