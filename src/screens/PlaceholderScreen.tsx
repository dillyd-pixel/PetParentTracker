/**
 * Placeholder screen shared by all six future modules and the four upsell
 * screens. It shows the module's title, which pet it applies to (the active
 * pet), and a "coming soon" note. When a real module is built, replace this
 * screen with the module's own screen file.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePets } from '../context/PetContext';
import { AppColors } from '../theme';

interface Props {
  /** e.g. "Vaccines", "Expenses", "Pet Planner"… */
  title: string;
  /** e.g. a vaccine record, feeding schedule… */
  noun?: string;
}

export default function PlaceholderScreen({ title, noun = 'records' }: Props) {
  const { activePet } = usePets();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🚧</Text>
      <Text style={styles.title}>{title}</Text>
      {activePet ? (
        <Text style={styles.text}>
          Applying to active pet: <Text style={styles.bold}>{activePet.name}</Text>
        </Text>
      ) : (
        <Text style={styles.text}>Select a pet on the Home tab to enable this area.</Text>
      )}
      <Text style={styles.muted}>
        {title} {noun} will appear here in a future update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: AppColors.text, marginBottom: 8 },
  text: { fontSize: 15, color: AppColors.text, textAlign: 'center', marginBottom: 4 },
  bold: { fontWeight: '700' },
  muted: { fontSize: 13, color: AppColors.textMuted, textAlign: 'center', marginTop: 8 },
});
