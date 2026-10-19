/**
 * The "Records" tab: the CARE surface.
 *
 *   RecordsList — the existing all-pets record list (thumb, title,
 *                 pet · clinic · date, cost), the premium card for unlimited
 *                 history + search, the global search entry and add-a-record —
 *                 **plus**, below it, the OS map's CARE group (§2.4): Food &
 *                 feeding and Medication (the *active pet's* modules), Routines,
 *                 Supplies and Care calendar (honest ComingSoon pages) and a
 *                 copy-only Vet records row that scrolls back up to the list.
 *   AddRecord   — title + category tags + pet tags + camera / library capture,
 *                 saved straight into the on-device store.
 *   ComingSoon  — the shared illustrated placeholder, back link `‹ Records`.
 *
 * Records are the app's existing `VetRecord` entities (with their optional
 * photo), so a record added here also shows on the pet's own Vet records screen
 * and in premium search — one store, two views, zero servers.
 *
 * The two module rows deliberately do **not** re-register Feeding / Meds here:
 * they navigate across to the Pets tab's own screens, which read `PetContext`,
 * exactly like the pet page's module rows (OS map §2.4 copy note). Re-registering
 * them would fork their state and break morning edits. The `Change pet ›` chip on
 * those rows only sets the active pet — nothing else.
 *
 * Every screen draws the design's own in-page header (an `h1` plus a `‹ back`
 * link), so the navigator header is hidden for the whole stack — one header per
 * screen, no duplicated titles.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import RecordsScreen from '../screens/RecordsScreen';
import AddRecordScreen from '../screens/AddRecordScreen';
import { RecordsComingSoonScreen } from '../screens/ComingSoonScreen';

export type RecordsStackParamList = {
  RecordsList: undefined;
  AddRecord: undefined;
  /** The CARE shells that do not exist yet (Routines, Supplies, Care calendar). */
  ComingSoon: { title: string; emoji: string; message: string; accent?: string; slug?: string };
};

const Stack = createWebSafeStackNavigator<RecordsStackParamList>();

export function RecordsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="RecordsList" component={RecordsScreen} />
      <Stack.Screen name="AddRecord" component={AddRecordScreen} />
      <Stack.Screen name="ComingSoon" component={RecordsComingSoonScreen} />
    </Stack.Navigator>
  );
}
