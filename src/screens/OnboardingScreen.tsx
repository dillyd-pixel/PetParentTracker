/**
 * First-run onboarding — the design's four-step opening, on paper.
 *
 * Ported from `PetBlueprintApp.js` ("The Pet Blueprint" → "What lives on a
 * pet's page" → "Never miss a dose" → "Two pet parents, one file"), with the
 * copy reconciled to this app's business model: Blueprint Premium is a
 * ONE-TIME UNLOCK with a 14-day free trial (no subscription, no per-month
 * price), co-parent sharing is the on-device file export/import, and keepsake
 * products stay off the happy path.
 *
 * Shown once: the `@pet-parent-tracker/onboarding-seen` flag is written to
 * AsyncStorage on Skip or Finish, so the next launch lands straight on Today.
 * Skip is available on every step. 100% offline — a local storage read/write,
 * no network of any kind, no account.
 */
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import { BS, SPACE } from '../theme';

/** AsyncStorage key for the one-time "already seen onboarding" flag. */
const ONBOARDING_KEY = '@pet-parent-tracker/onboarding-seen';

/** True once the flow has been completed or skipped on this device. */
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === '1';
  } catch {
    // A storage read failure must never block the app — treat as seen and go.
    return true;
  }
}

/** Remember that onboarding has been seen, so it only ever shows once. */
export async function markOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    // Best-effort: worst case the flow shows again next launch.
  }
}

interface Step {
  title: string;
  body?: string;
  rows?: string[];
  note?: string;
}

/** The four steps, in the design's order and wording (premium copy reconciled). */
const STEPS: Step[] = [
  {
    title: 'The Pet Blueprint',
    body: 'One page per pet: shots, medications, meals, invoices, spend, and the small things you want to remember.',
    note: 'Tracking is free, for as many as twenty pets.',
  },
  {
    title: "What lives on a pet's page",
    rows: ['Vaccines', 'Medications', 'Feeding', 'Vet records', 'Expenses', 'Journal'],
  },
  {
    title: 'Never miss a dose',
    body: 'Premium reminds you before the booster expires, before the refill runs out, and before dinner is late. One-time unlock with a 14-day free trial — never a subscription.',
    rows: ['Reminders', 'Co-parent sharing', 'Unlimited history', 'PDF export'],
  },
  {
    title: 'Two pet parents, one file',
    body: 'Hand the whole file to whoever shares the feeding, the vet runs and the bills — exported from this device and opened on theirs. Nothing is ever uploaded.',
  },
];

export default function OnboardingScreen({ onDone }: { onDone: () => void }): React.JSX.Element {
  const [step, setStep] = useState(1);
  const current = STEPS[step - 1];
  const last = step >= STEPS.length;

  const finish = () => {
    // Fire-and-forget: the flag is best-effort, the UI moves on regardless.
    markOnboardingSeen();
    onDone();
  };

  return (
    <View style={BS.screen}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <Text style={BS.kicker}>
            Step {step} of {STEPS.length}
          </Text>
          <TouchableOpacity onPress={finish}>
            <Text style={BS.link}>Skip</Text>
          </TouchableOpacity>
        </View>

        <Text style={BS.h1}>{current.title}</Text>
        {current.body ? <Text style={BS.body}>{current.body}</Text> : null}
        {current.rows
          ? current.rows.map((row) => (
              <View key={row} style={BS.divRow}>
                <Text style={BS.rowLabel}>{row}</Text>
              </View>
            ))
          : null}
        {current.note ? <Text style={BS.italic}>{current.note}</Text> : null}

        <View style={{ height: SPACE.s6 }} />
        <TouchableOpacity style={BS.btnPrimary} onPress={last ? finish : () => setStep(step + 1)}>
          <Text style={BS.btnPrimaryText}>{last ? 'Start tracking' : 'Continue'}</Text>
        </TouchableOpacity>
        {step > 1 ? (
          <TouchableOpacity style={{ marginTop: SPACE.s2 }} onPress={() => setStep(step - 1)}>
            <Text style={BS.link}>Back</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          Everything you enter stays on this device — no account, no cloud.
        </Text>
      </ScrollView>
    </View>
  );
}
