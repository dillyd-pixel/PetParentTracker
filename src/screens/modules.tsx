/**
 * Screens for the six future core modules.
 *
 * Vaccines ships as a real screen (`VaccinesScreen.tsx`); the other five are
 * thin wrappers that give `PlaceholderScreen` its title. When a module ships,
 * replace that module's wrapper body with the real screen — the navigation
 * wiring and data layers are already in place.
 */
import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';
import VaccinesScreen from './VaccinesScreen';

export { VaccinesScreen };

export function MedsScreen() {
  return <PlaceholderScreen title="Medications" noun="medication reminders" />;
}

export function FeedingScreen() {
  return <PlaceholderScreen title="Feeding" noun="feeding schedules" />;
}

export function VetRecordsScreen() {
  return <PlaceholderScreen title="Vet Records" noun="vet visits" />;
}

export function ExpensesScreen() {
  return <PlaceholderScreen title="Expenses" noun="expense entries" />;
}

export function JournalScreen() {
  return <PlaceholderScreen title="Journal" noun="personality journal entries" />;
}
