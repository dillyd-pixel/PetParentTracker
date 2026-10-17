/**
 * The "Sitter" tab: Sitter Mode's own stack (Stage 1 — the foundation).
 *
 *   SitterHome      — every care pass on this device with its status badge,
 *                     the "Create Care Pass" entry (premium, creator side) and
 *                     the "Open a Care Pass" entry (free, sitter side).
 *   TravelMode      — Travel Mode (HANDOFF, unit 1 of 3, free): the owner's
 *                     trip-planning layer — the trip, the "before you go"
 *                     checklist, the per-pet handoff preview and the handoff to
 *                     this same wizard with the trip's pets and dates.
 *   VetMode         — Vet Mode (HANDOFF, unit 2 of 3, free): preparing for a vet
 *                     visit (the day, the reason, the questions to ask), the last
 *                     visit and current medication read off the pet's own
 *                     records, "Save the visit" filing it in that same records
 *                     store, and a recheck that becomes a follow-up date on the
 *                     Upcoming list.
 *   PrintableBinder — Printable binder (HANDOFF, unit 3 of 3): the pet's whole
 *                     care file — profile, health summary, vet records, costs and
 *                     care instructions — assembled from the records already on
 *                     the device into one printable PDF. Preview free; the PDF
 *                     actions are Blueprint Premium, exactly like the planner's.
 *   BinderPreview   — that care file, full screen, before anything is generated
 *                     (free): the real print HTML in the browser, the planner's
 *                     own paper views on a device.
 *   CarePassWizard  — "I'm Leaving Town": the guided eight-step way to build the
 *                     same pass, with every per-pet fact prefilled from the
 *                     pet's own records (premium, like the create form).
 *                     Travel Mode hands it `{ petIds, startDate, endDate }`.
 *   CarePassForm    — the compact create form: caregiver, dates, pets,
 *                     permission, visible sections (premium).
 *   OpenCarePass    — the sitter's side: open a pass file / pass code. Free, no
 *                     account, no premium — works on a fresh device.
 *   CarePassDetail  — one pass: caregiver, permission, dates, sections and the
 *                     pets it covers (plus the owner's name when the pass came
 *                     from someone else).
 *   CheckIn         — the caregiver check-in engine (free): today's acts per
 *                     pet, one tap each, plus the never-scored mood row.
 *   CareLog         — one pet's whole care log, newest first.
 *   Emergency       — Emergency Mode (free, unit 3 of 3): one pet's emergency
 *                     sheet — vitals, allergies, medication, chip, the four
 *                     contacts and a Call button for every number on file.
 *
 * Every screen draws the design's own in-page header (an `h1` plus a
 * `‹ Sitter Mode` link), so the navigator header stays hidden throughout —
 * one header per screen, the same rule the other stacks follow.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import SitterHomeScreen from '../screens/SitterHomeScreen';
import TravelModeScreen from '../screens/TravelModeScreen';
import VetModeScreen from '../screens/VetModeScreen';
import PrintableBinderScreen from '../screens/PrintableBinderScreen';
import BinderPreviewScreen from '../screens/BinderPreviewScreen';
import CarePassFormScreen from '../screens/CarePassFormScreen';
import CarePassWizardScreen from '../screens/CarePassWizardScreen';
import OpenCarePassScreen from '../screens/OpenCarePassScreen';
import CarePassDetailScreen from '../screens/CarePassDetailScreen';
import CheckInScreen from '../screens/CheckInScreen';
import CareLogScreen from '../screens/CareLogScreen';
import EmergencyScreen from '../screens/EmergencyScreen';
import type { PaperSize } from '../pdf/planner/sections';

export type SitterStackParamList = {
  SitterHome: undefined;
  /**
   * Travel Mode (free): the whole trip-planning layer. `tripId` opens the
   * screen already holding one saved trip, so a trip can be revisited.
   */
  TravelMode: { tripId?: string } | undefined;
  /**
   * Vet Mode (free): one pet's vet-visit prep — the visit, its questions, the
   * last visit and current medication on file, and the recheck follow-up.
   * `petId` is optional so the pet page opens the same screen for its own pet.
   */
  VetMode: { petId?: string } | undefined;
  /**
   * Printable binder (HANDOFF 3/3): the pet's whole care file as one printable
   * PDF. `petId` is optional — with none, the screen starts on the active pet.
   */
  PrintableBinder: { petId?: string } | undefined;
  /**
   * The binder's own preview (free): the exact document the PDF is built from.
   * `autoPrint` opens the browser's print dialog once it has loaded (web only).
   */
  BinderPreview: { petIds: string[]; paper: PaperSize; autoPrint?: boolean };
  /**
   * "I'm Leaving Town" — the guided eight-step Care Pass creator. Travel Mode
   * hands it the trip it is planning (`petIds` + `startDate`/`endDate`); with
   * no params it opens exactly as it always has.
   */
  CarePassWizard:
    | { petIds?: string[]; startDate?: string; endDate?: string }
    | undefined;
  CarePassForm: undefined;
  OpenCarePass: undefined;
  CarePassDetail: { passId: string };
  /** The caregiver check-in engine (free): today's acts per pet, one tap each. */
  CheckIn: undefined;
  /**
   * One pet's whole care log, newest first. `petId` is optional so the screen
   * falls back to the active pet (the pet page opens the same screen in the
   * Pets stack with its own pet id).
   */
  CareLog: { petId?: string } | undefined;
  /**
   * Emergency Mode (free): one pet's emergency sheet, with a Call button
   * beside every number on file. `petId` is optional — the screen falls back
   * to the first pet, and the pet page opens the same screen with its own id.
   */
  Emergency: { petId?: string } | undefined;
};

const Stack = createWebSafeStackNavigator<SitterStackParamList>();

export function SitterNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SitterHome" component={SitterHomeScreen} />
      <Stack.Screen name="TravelMode" component={TravelModeScreen} />
      <Stack.Screen name="VetMode" component={VetModeScreen} />
      <Stack.Screen name="PrintableBinder" component={PrintableBinderScreen} />
      <Stack.Screen name="BinderPreview" component={BinderPreviewScreen} />
      <Stack.Screen name="CarePassWizard" component={CarePassWizardScreen} />
      <Stack.Screen name="CarePassForm" component={CarePassFormScreen} />
      <Stack.Screen name="OpenCarePass" component={OpenCarePassScreen} />
      <Stack.Screen name="CarePassDetail" component={CarePassDetailScreen} />
      <Stack.Screen name="CheckIn" component={CheckInScreen} />
      <Stack.Screen name="CareLog" component={CareLogScreen} />
      <Stack.Screen name="Emergency" component={EmergencyScreen} />
    </Stack.Navigator>
  );
}
