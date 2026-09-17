/**
 * The "Records" tab: one list of every pet's records, plus add-a-record.
 *
 *   RecordsList — every pet's vet records in one list (thumb, title,
 *                 pet · clinic · date, cost), the premium card for unlimited
 *                 history + search, and the global search entry.
 *   AddRecord   — title + category tags + pet tags + camera / library capture,
 *                 saved straight into the on-device store.
 *
 * Records are the app's existing `VetRecord` entities (with their optional
 * photo), so a record added here also shows on the pet's own Vet records screen
 * and in premium search — one store, two views, zero servers.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import { PAPER_HEADER } from './headerOptions';
import RecordsScreen from '../screens/RecordsScreen';
import AddRecordScreen from '../screens/AddRecordScreen';

export type RecordsStackParamList = {
  RecordsList: undefined;
  AddRecord: undefined;
};

const Stack = createWebSafeStackNavigator<RecordsStackParamList>();

export function RecordsNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={PAPER_HEADER}>
      <Stack.Screen
        name="RecordsList"
        component={RecordsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddRecord"
        component={AddRecordScreen}
        options={{ title: 'Add a record' }}
      />
    </Stack.Navigator>
  );
}
