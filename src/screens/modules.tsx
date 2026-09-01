/**
 * Placeholder screens for the six future core modules.
 *
 * Each is a thin wrapper that gives `PlaceholderScreen` its title. When a
 * module ships, replace that module's wrapper body with the real screen —
 * the navigation wiring and data layer are already in place.
 */
import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';

export function VaccinesScreen() {
  return <PlaceholderScreen title="Vaccines" noun="vaccination records" />;
}

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
