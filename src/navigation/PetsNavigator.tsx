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
 *   CareLog    — Sitter Mode's check-in record for one pet, newest first. The
 *                same screen is registered in the Sitter stack so the owner can
 *                reach it from either side.
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
import type { VetRecordKind } from '../types';
import PetListScreen from '../screens/PetListScreen';
import PetProfileScreen from '../screens/PetProfileScreen';
import CareInstructionsScreen from '../screens/CareInstructionsScreen';
import CareInstructionsEditorScreen from '../screens/CareInstructionsEditorScreen';
import CareLogScreen from '../screens/CareLogScreen';
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
  /** `openNew` is a nonce: a newer value re-opens the screen's add form. */
  Meds: { openNew?: number } | undefined;
  Feeding: { openNew?: number } | undefined;
  /**
   * `kind` says what is being filed: a clinic visit, a booked appointment or a
   * filed document — Quick Add sends the last two so the editor opens with the
   * right words on it (and the record lands in the right place on Home).
   */
  VetRecords: { openNew?: number; kind?: VetRecordKind } | undefined;
  Expenses: { openNew?: number } | undefined;
  /** `focus` opens a new entry and points at the note or the photo field. */
  Journal: { openNew?: number; focus?: JournalQuickFocus } | undefined;
  /** One pet's care instructions (read view); defaults to the active pet. */
  CareInstructions: { petId?: string } | undefined;
  /** The same pet's care instructions editor. */
  CareInstructionsEditor: { petId?: string } | undefined;
  /**
   * One pet's whole care log (Sitter Mode's check-in record), newest first —
   * opened from the pet's page. The same screen is registered in the Sitter
   * stack; `petId` is optional in both, falling back to the active pet.
   */
  CareLog: { petId?: string } | undefined;
};

/** What a Quick Add "Note"/"Photo" tap wants the journal form to look at. */
export type JournalQuickFocus = 'note' | 'photo';

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
      <Stack.Screen name="CareLog" component={CareLogScreen} />
    </Stack.Navigator>
  );
}
