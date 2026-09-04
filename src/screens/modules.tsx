/**
 * Screens for the six future core modules.
 *
 * Vaccines, Medications, Feeding, Vet Records and Expenses ship as real
 * screens (their own files); Journal is still a thin wrapper that gives
 * `PlaceholderScreen` its title. When a module ships, replace that module's
 * wrapper body with the real screen — the navigation wiring and data layers
 * are already in place.
 */
import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';
import VaccinesScreen from './VaccinesScreen';
import MedsScreen from './MedsScreen';
import FeedingScreen from './FeedingScreen';
import VetRecordsScreen from './VetRecordsScreen';
import ExpensesScreen from './ExpensesScreen';

export { VaccinesScreen, MedsScreen, FeedingScreen, VetRecordsScreen, ExpensesScreen };

export function JournalScreen() {
  return <PlaceholderScreen title="Journal" noun="personality journal entries" />;
}
