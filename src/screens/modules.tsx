/**
 * Screens for the six future core modules.
 *
 * All six ship as real screens (their own files); this module re-exports them
 * under their navigation-facing names.
 */
import React from 'react';
import VaccinesScreen from './VaccinesScreen';
import MedsScreen from './MedsScreen';
import FeedingScreen from './FeedingScreen';
import VetRecordsScreen from './VetRecordsScreen';
import ExpensesScreen from './ExpensesScreen';
import JournalScreen from './JournalScreen';

export { VaccinesScreen, MedsScreen, FeedingScreen, VetRecordsScreen, ExpensesScreen, JournalScreen };
