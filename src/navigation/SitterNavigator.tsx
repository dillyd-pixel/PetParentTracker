/**
 * The "Sitter" tab: Sitter Mode's own stack (Stage 1 — the foundation).
 *
 *   SitterHome      — every care pass on this device with its status badge,
 *                     the "Create Care Pass" entry (premium, creator side) and
 *                     the "Open a Care Pass" entry (free, sitter side).
 *   CarePassForm    — the create form: caregiver, dates, pets, permission,
 *                     visible sections.
 *   OpenCarePass    — the sitter's side: open a pass file / pass code. Free, no
 *                     account, no premium — works on a fresh device.
 *   CarePassDetail  — one pass: caregiver, permission, dates, sections and the
 *                     pets it covers (plus the owner's name when the pass came
 *                     from someone else).
 *
 * Every screen draws the design's own in-page header (an `h1` plus a
 * `‹ Sitter Mode` link), so the navigator header stays hidden throughout —
 * one header per screen, the same rule the other stacks follow.
 */
import React from 'react';

import { createWebSafeStackNavigator } from './WebSafeStack';
import SitterHomeScreen from '../screens/SitterHomeScreen';
import CarePassFormScreen from '../screens/CarePassFormScreen';
import OpenCarePassScreen from '../screens/OpenCarePassScreen';
import CarePassDetailScreen from '../screens/CarePassDetailScreen';

export type SitterStackParamList = {
  SitterHome: undefined;
  CarePassForm: undefined;
  OpenCarePass: undefined;
  CarePassDetail: { passId: string };
};

const Stack = createWebSafeStackNavigator<SitterStackParamList>();

export function SitterNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SitterHome" component={SitterHomeScreen} />
      <Stack.Screen name="CarePassForm" component={CarePassFormScreen} />
      <Stack.Screen name="OpenCarePass" component={OpenCarePassScreen} />
      <Stack.Screen name="CarePassDetail" component={CarePassDetailScreen} />
    </Stack.Navigator>
  );
}
