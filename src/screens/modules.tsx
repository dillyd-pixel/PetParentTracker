/**
 * Screens for the six future core modules.
 *
 * Vaccines and Medications ship as real screens (their own files); the other
 * four are thin wrappers that give `PlaceholderScreen` its title. When a
 * module ships, replace that module's wrapper body with the real screen —
 * the navigation wiring and data layers are already in place.
 */
import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';
import VaccinesScreen from './VaccinesScreen';
import MedsScreen from './MedsScreen';
import FeedingScreen from './FeedingScreen';

export { VaccinesScreen, MedsScreen, FeedingScreen };

export function VetRecordsScreen() {
  return <PlaceholderScreen title="Vet Records" noun="vet visits" />;
}

export function ExpensesScreen() {
  return <PlaceholderScreen title="Expenses" noun="expense entries" />;
}

export function JournalScreen() {
  return <PlaceholderScreen title="Journal" noun="personality journal entries" />;
}
