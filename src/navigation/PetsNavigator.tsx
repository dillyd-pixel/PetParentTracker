/**
 * The "Pets" tab: a web-safe stack over the pet pages and every per-pet module.
 *
 *   PetList    — every pet, tap one to open its page (+ add a pet).
 *   PetProfile — the design's pet page: photo plate, name, meta kicker,
 *                Vaccines / Feeding buttons, medications, journal quotes and
 *                rows into the remaining modules.
 *   Vaccines, Meds, Feeding, VetRecords, Expenses, Journal — the existing
 *                module screens, restyled to the design, all reachable from the
 *                pet page (each reads the active pet from PetContext).
 *   CareInstructions / CareInstructionsEditor — Sitter Mode stage 2: the pet's
 *                permanent care notes, read view then editor. Reached from the
 *                pet page and from Sitter Mode home (which passes a `petId`).
 *
 * Every screen in this stack draws the design's own in-page header — an `h1`
 * plus a `‹ back` link — so the navigator header stays hidden throughout:
 * exactly one header per screen, no stacked duplicate titles.
 *
 * `createWebSafeStackNavigator` keeps the browser preview working (JS stack on
 * web, native stack on Android).
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import PetListScreen from '../screens/PetListScreen';
import PetProfileScreen from '../screens/PetProfileScreen';
import CareInstructionsScreen from '../screens/CareInstructionsScreen';
import CareInstructionsEditorScreen from '../screens/CareInstructionsEditorScreen';
import {
  VaccinesScreen,
  MedsScreen,
  FeedingScreen,
  VetRecordsScreen,
  ExpensesScreen,
  JournalScreen,
} from '../screens/modules';

export type PetsStackParamList = {
  PetList: undefined;
  PetProfile: { petId?: string } | undefined;
  Vaccines: undefined;
  Meds: undefined;
  Feeding: undefined;
  VetRecords: undefined;
  Expenses: undefined;
  Journal: undefined;
  /** One pet's care instructions (read view); defaults to the active pet. */
  CareInstructions: { petId?: string } | undefined;
  /** The same pet's care instructions editor. */
  CareInstructionsEditor: { petId?: string } | undefined;
};

const Stack = createWebSafeStackNavigator<PetsStackParamList>();

export function PetsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PetList" component={PetListScreen} />
      <Stack.Screen name="PetProfile" component={PetProfileScreen} />
      <Stack.Screen name="Vaccines" component={VaccinesScreen} />
      <Stack.Screen name="Meds" component={MedsScreen} />
      <Stack.Screen name="Feeding" component={FeedingScreen} />
      <Stack.Screen name="VetRecords" component={VetRecordsScreen} />
      <Stack.Screen name="Expenses" component={ExpensesScreen} />
      <Stack.Screen name="Journal" component={JournalScreen} />
      <Stack.Screen name="CareInstructions" component={CareInstructionsScreen} />
      <Stack.Screen name="CareInstructionsEditor" component={CareInstructionsEditorScreen} />
    </Stack.Navigator>
  );
}
