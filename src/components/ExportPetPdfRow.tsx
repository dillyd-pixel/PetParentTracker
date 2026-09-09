/**
 * Premium-gated "Export pet file as PDF" row — Blueprint Premium feature 3/4.
 *
 * For premium users on a native device: builds the one-pet "Pet File" HTML
 * document (see ../pdf/petFileHtml) from the already-loaded contexts, renders
 * it to a local PDF via expo-print's `printToFileAsync` (entirely on-device —
 * no server, no upload), then opens the share sheet via expo-sharing so the
 * user can save or send the file. Both native modules are loaded lazily
 * (require inside the handler) so the web bundle never evaluates them.
 *
 * For non-premium users: the friendly Blueprint Premium lock, same copy as
 * PremiumReminderRow, routing to the Premium screen in the More stack.
 *
 * On the web preview, expo-print only opens the browser print dialog and
 * expo-sharing is unavailable — so premium users see a friendly note that PDF
 * export works on their Android phone instead of a broken button.
 *
 * 100% offline: no fetch, no URLs, no network — HTML + local PDF file only.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { usePremium } from '../context/PremiumContext';
import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import { buildPetFileHtml } from '../pdf/petFileHtml';
import { AppColors } from '../theme';

/**
 * Export row for the active pet: a premium-gated button that generates and
 * shares the pet's PDF file. Renders nothing when no pet is selected.
 */
export function ExportPetPdfRow(): React.JSX.Element | null {
  const { isPremium } = usePremium();
  const premium = isPremium();
  const { activePet } = usePets();
  const { vaccinesForPet } = useVaccines();
  const { medicationsForPet } = useMedications();
  const { feedingForPet } = useFeeding();
  const { vetRecordsForPet } = useVetRecords();
  const { expensesForPet } = useExpenses();
  const { journalForPet } = useJournal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  if (!activePet) return null;

  const goToPremium = (): void => {
    try {
      navigation.navigate('Upsells', { screen: 'Premium' });
    } catch {
      // Navigation must never crash a screen — the lock note stays visible.
    }
  };

  // Web preview: print-to-file/sharing can't produce a real PDF file here.
  if (Platform.OS === 'web') {
    if (!premium) {
      return (
        <TouchableOpacity style={styles.lockRow} onPress={goToPremium}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <View style={styles.lockCopy}>
            <Text style={styles.lockTitle}>PDF export — Blueprint Premium</Text>
            <Text style={styles.lockText}>
              Part of Blueprint Premium — start your 14-day free trial
            </Text>
          </View>
        </TouchableOpacity>
      );
    }
    return (
      <View style={styles.exportCard}>
        <Text style={styles.webNote}>
          📄 PDF export works on your Android phone — not available in the web preview.
        </Text>
      </View>
    );
  }

  if (!premium) {
    return (
      <TouchableOpacity style={styles.lockRow} onPress={goToPremium}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <View style={styles.lockCopy}>
          <Text style={styles.lockTitle}>PDF export — Blueprint Premium</Text>
          <Text style={styles.lockText}>
            Part of Blueprint Premium — start your 14-day free trial
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  const handleExport = async (): Promise<void> => {
    if (busy || !activePet) return;
    setBusy(true);
    try {
      const html = buildPetFileHtml({
        pet: activePet,
        vaccines: vaccinesForPet(activePet.id),
        medications: medicationsForPet(activePet.id),
        feeding: feedingForPet(activePet.id),
        vetRecords: vetRecordsForPet(activePet.id),
        expenses: expensesForPet(activePet.id),
        journal: journalForPet(activePet.id),
      });
      // Lazy native requires — keeps the web bundle free of native modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Print = require('expo-print');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing');
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          'PDF ready',
          `Your pet file was saved on this device:\n${uri}`,
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${activePet.name}'s pet file`,
      });
    } catch (e) {
      Alert.alert(
        'Export didn’t work',
        e instanceof Error ? e.message : 'Something went wrong creating the PDF. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.exportCard}>
      <TouchableOpacity
        style={[styles.exportButton, busy && styles.exportButtonDisabled]}
        onPress={handleExport}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={AppColors.white} />
        ) : (
          <Text style={styles.exportButtonText}>📄 Export {activePet.name}’s file as PDF</Text>
        )}
      </TouchableOpacity>
      <Text style={styles.exportNote}>
        Generates a PDF on this device — nothing is uploaded.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  lockEmoji: { fontSize: 20, marginRight: 10 },
  lockCopy: { flex: 1 },
  lockTitle: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  lockText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
    marginTop: 2,
    lineHeight: 18,
  },
  exportCard: { marginTop: 4 },
  exportButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  exportButtonDisabled: { opacity: 0.6 },
  exportButtonText: { color: AppColors.white, fontSize: 15, fontWeight: '700' },
  exportNote: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  webNote: {
    fontSize: 13,
    color: AppColors.textMuted,
    lineHeight: 18,
    textAlign: 'center',
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
