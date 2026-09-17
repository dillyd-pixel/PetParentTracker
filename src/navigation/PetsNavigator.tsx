/**
 * The "Pets" tab: a web-safe stack over the pet pages and every per-pet module.
 *
 *   PetList    — every pet, tap one to open its page (+ add a pet).
 *   PetProfile — the design's pet page: photo plate, name, meta kicker,
 *                Vaccines / Feeding buttons, medications, journal quotes and
 *                rows into the remaining modules.
 *   Vaccines, Meds, Feeding, VetRecords, Expenses, Journal — the existing
 *                module screens, unchanged, all reachable from the pet page
 *                (each reads the active pet from PetContext).
 *
 * `createWebSafeStackNavigator` keeps the browser preview working (JS stack on
 * web, native stack on Android).
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import { PAPER_HEADER } from './headerOptions';
import PetListScreen from '../screens/PetListScreen';
import PetProfileScreen from '../screens/PetProfileScreen';
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
};

const Stack = createWebSafeStackNavigator<PetsStackParamList>();

export function PetsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={PAPER_HEADER}>
      <Stack.Screen name="PetList" component={PetListScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PetProfile" component={PetProfileScreen} options={{ title: 'Pet page' }} />
      <Stack.Screen name="Vaccines" component={VaccinesScreen} options={{ title: 'Vaccines' }} />
      <Stack.Screen name="Meds" component={MedsScreen} options={{ title: 'Medications' }} />
      <Stack.Screen name="Feeding" component={FeedingScreen} options={{ title: 'Feeding' }} />
      <Stack.Screen
        name="VetRecords"
        component={VetRecordsScreen}
        options={{ title: 'Vet records' }}
      />
      <Stack.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses' }} />
      <Stack.Screen name="Journal" component={JournalScreen} options={{ title: 'Journal' }} />
    </Stack.Navigator>
  );
}
