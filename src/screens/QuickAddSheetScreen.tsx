/**
 * Quick Add — the sheet behind the raised "+" button in the middle of the nav.
 *
 * Design Phase A wires the slot and its sheet shell; the real one-tap actions
 * (medication, appointment, weight, expense, food, walk, note, photo,
 * document) ship in Phase C. Until then this sheet is honest about it: it shows
 * the nine actions as inert previews labelled "Soon" and never pretends a tap
 * did something.
 *
 * It is a root-stack modal (`presentation: 'modal'`), which is why `› Add a
 * pet` — the one action that already exists — can be offered for real.
 *
 * 100% offline: no network, no storage; the sheet only navigates.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CCButton, CCPill } from '../components/CC';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SHADOW, SPACE } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickAdd'>;

/** The nine quick actions from the design, each with its colour. */
const ACTIONS: Array<{ emoji: string; label: string; tint: string }> = [
  { emoji: '💊', label: 'Medication', tint: COLOR.coral },
  { emoji: '📅', label: 'Appointment', tint: COLOR.blue },
  { emoji: '⚖️', label: 'Weight', tint: COLOR.aqua },
  { emoji: '💸', label: 'Expense', tint: COLOR.tangerine },
  { emoji: '🍽️', label: 'Food', tint: COLOR.sunshine },
  { emoji: '🐾', label: 'Walk', tint: COLOR.leaf },
  { emoji: '📝', label: 'Note', tint: COLOR.lavender },
  { emoji: '📷', label: 'Photo', tint: COLOR.blue },
  { emoji: '📄', label: 'Document', tint: COLOR.premiumDeep },
];

export default function QuickAddSheetScreen({ navigation }: Props): React.JSX.Element {
  return (
    <View style={styles.backdrop}>
      {/* Tapping the dimmed area behind the sheet closes it, like a real sheet. */}
      <Pressable
        style={styles.scrim}
        onPress={() => navigation.goBack()}
        accessibilityLabel="Close quick add"
      />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={BS.eyebrow}>Quick add</Text>
        <Text style={styles.title}>What happened?</Text>
        <Text style={BS.caption}>
          One-tap logging is on its way — medication, appointments, weight, spending, food, walks,
          notes, photos and documents, all captured in three taps or fewer.
        </Text>

        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {ACTIONS.map((action) => (
            <View key={action.label} style={styles.action}>
              <View style={[styles.actionChip, { backgroundColor: action.tint }]}>
                <Text style={styles.actionEmoji}>{action.emoji}</Text>
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
              <CCPill label="Soon" tone="neutral" style={styles.actionPill} />
            </View>
          ))}
        </ScrollView>

        <CCButton label="Add a pet instead" emoji="🐾" onPress={() => navigation.navigate('PetForm')} />
        <CCButton
          label="Close"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.close}
          testID="quick-add-close"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLOR.scrim },
  sheet: {
    backgroundColor: COLOR.surface,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACE.s4,
    paddingTop: SPACE.s2,
    paddingBottom: SPACE.s6,
    maxHeight: '88%',
    ...SHADOW.pop,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.divider,
    marginBottom: SPACE.s3,
  },
  title: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 24,
    color: COLOR.text,
    marginBottom: SPACE.s1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3, paddingVertical: SPACE.s3 },
  action: { alignItems: 'center', width: 84, gap: 4 },
  actionChip: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.cardSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: { fontSize: 24 },
  actionLabel: { fontFamily: FONT_BODY, fontSize: 12, fontWeight: '600', color: COLOR.text },
  actionPill: { paddingVertical: 2, paddingHorizontal: 8 },
  close: { marginTop: SPACE.s2 },
});
