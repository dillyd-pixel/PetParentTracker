/**
 * Co-parent share rows — Blueprint Premium feature 4/4.
 *
 * Two entry points for the active pet, rendered together:
 *  - "Share with co-parent" (premium-gated): writes the pet's complete file
 *    to a local `.json` and opens the system share sheet via expo-sharing, so
 *    the user can send it however they like (text, email, file). Non-premium
 *    users see the friendly Blueprint Premium lock (same copy as
 *    PremiumReminderRow) routing to the Premium screen.
 *  - "Import co-parent's share" (open to everyone): picks a shared `.json`
 *    via expo-document-picker, validates it, and restores the pet + all its
 *    records on this device. Because importing a shared file is what grants
 *    premium, this entry stays unlocked pre-premium with a note that shared
 *    files include Blueprint Premium. On success it unlocks premium on this
 *    device and confirms "Shared by your co-parent — Blueprint Premium
 *    unlocked".
 *
 * Duplicate pets: when a pet with the same name already exists here, the user
 * is asked whether to keep both (importing as "Name (2)") or cancel.
 *
 * On the web preview there is no share sheet or document picker, so both rows
 * render a friendly note that sharing works on the Android app. All native
 * modules are loaded lazily (require inside handlers) so the web bundle never
 * evaluates them.
 *
 * 100% offline: local file + AsyncStorage only. No fetch, no URLs, no server.
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
import {
  importPetShareFile,
  parsePetShareFile,
  petFileName,
  petFileProblemMessage,
  resolveDuplicatePetName,
  serializePetFile,
} from '../storage/share';
import { AppColors } from '../theme';

const SHARE_MIME_TYPE = 'application/json';

/** Route to the Blueprint Premium screen (nested in the "More" tab). */
function useGoToPremium(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  return () => {
    try {
      navigation.navigate('Upsells', { screen: 'Premium' });
    } catch {
      // Navigation must never crash a screen — the lock note stays visible.
    }
  };
}

/**
 * Co-parent share rows for the active pet: the premium-gated export button
 * plus the always-open import button. The import entry is also rendered on
 * the More tab (which may have no active pet), so co-parents with no pets
 * still find it.
 */
export function CoParentShareRows(): React.JSX.Element | null {
  const { isPremium, unlock } = usePremium();
  const premium = isPremium();
  const goToPremium = useGoToPremium();
  const { pets, activePet, refresh: refreshPets, selectPet } = usePets();
  const { vaccinesForPet, refresh: refreshVaccines } = useVaccines();
  const { medicationsForPet, refresh: refreshMedications } = useMedications();
  const { feedingForPet, refresh: refreshFeeding } = useFeeding();
  const { vetRecordsForPet, refresh: refreshVet } = useVetRecords();
  const { expensesForPet, refresh: refreshExpenses } = useExpenses();
  const { journalForPet, refresh: refreshJournal } = useJournal();
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  // Web preview: no share sheet, no document picker — explain instead.
  if (Platform.OS === 'web') {
    return (
      <View style={styles.stack}>
        <View style={styles.webNote}>
          <Text style={styles.webTitle}>🤝 Share with co-parent — Blueprint Premium</Text>
          <Text style={styles.webText}>
            Export your pet’s file and send it to your co-parent from the Android app.
          </Text>
        </View>
        <View style={styles.webNote}>
          <Text style={styles.webTitle}>📥 Import a co-parent’s share</Text>
          <Text style={styles.webText}>
            Picking a shared pet file works on the Android app — shared files include Blueprint
            Premium.
          </Text>
        </View>
      </View>
    );
  }

  const handleExport = async (): Promise<void> => {
    if (!activePet || exportBusy) return;
    setExportBusy(true);
    try {
      // Lazy native requires — keeps the web bundle free of native modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing');
      const json = serializePetFile({
        pet: activePet,
        vaccines: vaccinesForPet(activePet.id),
        medications: medicationsForPet(activePet.id),
        feeding: feedingForPet(activePet.id),
        vetRecords: vetRecordsForPet(activePet.id),
        expenses: expensesForPet(activePet.id),
        journal: journalForPet(activePet.id),
      });
      const baseDir: string | null =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
      if (!baseDir) {
        Alert.alert(
          'Export didn’t work',
          'This device didn’t offer a place to write the pet file. Try again.',
        );
        return;
      }
      const uri = `${baseDir}${petFileName(activePet.name)}`;
      await FileSystem.writeAsStringAsync(uri, json);
      const available: boolean = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Pet file ready', `Your pet file was saved on this device:\n${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: SHARE_MIME_TYPE,
        dialogTitle: `Share ${activePet.name} with your co-parent`,
      });
    } catch (e) {
      Alert.alert(
        'Export didn’t work',
        e instanceof Error ? e.message : 'Something went wrong writing the pet file. Try again.',
      );
    } finally {
      setExportBusy(false);
    }
  };

  const runImport = async (raw: string): Promise<void> => {
    const parsed = parsePetShareFile(raw);
    if (!parsed.ok) {
      Alert.alert('Couldn’t import that file', petFileProblemMessage(parsed.problem));
      return;
    }
    const file = parsed.file;
    const existingNames = pets.map((pet) => pet.name);
    const duplicate = existingNames.some(
      (name) => name.trim().toLowerCase() === file.pet.name.trim().toLowerCase(),
    );

    const finishImport = async (petName: string): Promise<void> => {
      setImportBusy(true);
      try {
        const result = await importPetShareFile(file, petName);
        // Premium travels with the file: a valid shared file unlocks premium
        // on the importing device (one-time unlock, offline).
        await unlock();
        await Promise.all([
          refreshPets(),
          refreshVaccines(),
          refreshMedications(),
          refreshFeeding(),
          refreshVet(),
          refreshExpenses(),
          refreshJournal(),
        ]);
        try {
          await selectPet(result.pet.id);
        } catch {
          // Selecting must never fail an import — the pet is already saved.
        }
        const total =
          result.counts.vaccines +
          result.counts.medications +
          result.counts.feeding +
          result.counts.vetRecords +
          result.counts.expenses +
          result.counts.journal;
        Alert.alert(
          'Shared by your co-parent — Blueprint Premium unlocked',
          `${result.pet.name} is now on this device with ` +
            `${total} record${total === 1 ? '' : 's'} ` +
            `(vaccines ${result.counts.vaccines} · meds ${result.counts.medications} · ` +
            `feeding ${result.counts.feeding} · vet ${result.counts.vetRecords} · ` +
            `expenses ${result.counts.expenses} · journal ${result.counts.journal}). ` +
            `Blueprint Premium is unlocked on this device — enjoy sharing pet care together.`,
        );
      } catch (e) {
        Alert.alert(
          'Import didn’t work',
          e instanceof Error
            ? e.message
            : 'Something went wrong saving the shared pet. Try again.',
        );
      } finally {
        setImportBusy(false);
      }
    };

    if (duplicate) {
      const suggested = resolveDuplicatePetName(file.pet.name, existingNames);
      Alert.alert(
        `You already have a pet named ${file.pet.name}`,
        `Keep both? The shared pet will be added as “${suggested}”.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: `Keep both as ${suggested}`, onPress: () => void finishImport(suggested) },
        ],
      );
      return;
    }
    await finishImport(file.pet.name);
  };

  const handleImport = async (): Promise<void> => {
    if (importBusy) return;
    setImportBusy(true);
    try {
      // Lazy native requires — keeps the web bundle free of native modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const DocumentPicker = require('expo-document-picker');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy');
      const picked = await DocumentPicker.getDocumentAsync({
        type: [SHARE_MIME_TYPE, 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Couldn’t import that file', 'The picker didn’t return a file to read.');
        return;
      }
      const raw: string = await FileSystem.readAsStringAsync(asset.uri);
      await runImport(raw);
    } catch (e) {
      Alert.alert(
        'Import didn’t work',
        e instanceof Error ? e.message : 'Something went wrong reading that file. Try again.',
      );
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <View style={styles.stack}>
      {/* Export needs a pet to share; import is always available (it's the
          sharing path that grants premium, so co-parents with no pets yet
          still find it on the More tab). */}
      {!activePet ? null : premium ? (
        <View>
          <TouchableOpacity
            style={[styles.shareButton, exportBusy && styles.buttonDisabled]}
            onPress={handleExport}
            disabled={exportBusy}
          >
            {exportBusy ? (
              <ActivityIndicator color={AppColors.white} />
            ) : (
              <Text style={styles.shareButtonText}>
                🤝 Share{activePet ? ` ${activePet.name}` : ''} with co-parent
              </Text>
            )}
          </TouchableOpacity>
          <Text style={styles.note}>
            Writes {activePet ? `${activePet.name}’s` : 'your pet’s'} complete file on this device
            so you can send it however you like — nothing is uploaded.
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.lockRow} onPress={goToPremium}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <View style={styles.lockCopy}>
            <Text style={styles.lockTitle}>Share with co-parent — Blueprint Premium</Text>
            <Text style={styles.lockText}>
              Part of Blueprint Premium — start your 14-day free trial
            </Text>
          </View>
        </TouchableOpacity>
      )}
      <View style={styles.importBlock}>
        <TouchableOpacity
          style={[styles.importButton, importBusy && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={importBusy}
        >
          {importBusy ? (
            <ActivityIndicator color={AppColors.primary} />
          ) : (
            <Text style={styles.importButtonText}>📥 Import co-parent’s share</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.note}>Shared files include Blueprint Premium — importing unlocks it.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { marginTop: 4 },
  shareButton: {
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  importButton: {
    backgroundColor: AppColors.card,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  buttonDisabled: { opacity: 0.6 },
  shareButtonText: { color: AppColors.white, fontSize: 15, fontWeight: '700' },
  importButtonText: { color: AppColors.primary, fontSize: 15, fontWeight: '700' },
  note: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  importBlock: { marginTop: 12 },
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
  webNote: {
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  webTitle: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  webText: { fontSize: 13, color: AppColors.textMuted, marginTop: 4, lineHeight: 18 },
});
