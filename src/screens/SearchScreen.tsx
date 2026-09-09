/**
 * Global record search — a Blueprint Premium feature (2/4).
 *
 * A single search surface over ALL of the user's pets' records: pet profiles,
 * vaccines, medications, feeding schedules, vet records, expenses, and journal
 * entries. Filtering is synchronous and in-memory over the already-loaded
 * contexts — zero network, zero index engine, fully offline.
 *
 * Gating: non-premium users (no unlock, no running trial) see the friendly
 * Blueprint Premium lock (same copy/style as PremiumReminderRow) that routes
 * to the Premium screen. Premium users get the full search surface.
 *
 * Tapping a result switches to that record's pet and opens the record's
 * module tab. Per-record deep-linking is out of scope for this pass — the
 * module tab opens and the pet is already selected.
 */

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { useVaccines } from '../context/VaccinesContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import { AppColors, cardShadow } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import {
  expenseAmountLabel,
  feedingScheduleLabel,
  medicationScheduleLabel,
} from '../types';
import type { MainTabParamList } from '../navigation/RootNavigator';

/** One matched record, ready to render and open. */
interface SearchHit {
  key: string;
  petId: string;
  title: string;
  subtitle: string;
  /** Module tab to open when the result is tapped. */
  tab: keyof MainTabParamList;
}

/** A non-empty group of hits from one module. */
interface SearchGroup {
  key: string;
  heading: string;
  hits: SearchHit[];
}

/** True when any of the given text fields contains the query (case-insensitive). */
function matches(query: string, fields: Array<string | number | undefined>): boolean {
  return fields.some((field) => {
    if (field === undefined || field === null) return false;
    return String(field).toLowerCase().includes(query);
  });
}

export default function SearchScreen({ navigation }: { navigation: any }): React.JSX.Element {
  const premium = usePremium();
  const { pets, selectPet } = usePets();
  const { vaccines } = useVaccines();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { vetRecords } = useVetRecords();
  const { expenses } = useExpenses();
  const { journalEntries } = useJournal();
  const [query, setQuery] = useState('');

  const petName = useMemo(() => {
    const byId = new Map(pets.map((pet) => [pet.id, pet.name]));
    return (petId: string): string => byId.get(petId) ?? 'Unknown pet';
  }, [pets]);

  const groups: SearchGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const withPet = (hit: Omit<SearchHit, 'subtitle'>, subtitle: string): SearchHit => ({
      ...hit,
      subtitle: `🐾 ${petName(hit.petId)}${subtitle ? ` · ${subtitle}` : ''}`,
    });
    const found: SearchGroup[] = [];

    const petHits: SearchHit[] = pets
      .filter((pet) => matches(q, [pet.name, pet.species, pet.breed]))
      .map((pet) =>
        withPet(
          { key: `pet-${pet.id}`, petId: pet.id, title: pet.name, tab: 'Home' },
          `${pet.species}${pet.breed ? ` · ${pet.breed}` : ''}`,
        ),
      );
    if (petHits.length > 0) {
      found.push({ key: 'pets', heading: `Pet profiles · ${petHits.length}`, hits: petHits });
    }

    const vaccineHits: SearchHit[] = vaccines
      .filter((vaccine) => matches(q, [vaccine.name, vaccine.notes]))
      .map((vaccine) =>
        withPet(
          { key: `vaccine-${vaccine.id}`, petId: vaccine.petId, title: vaccine.name, tab: 'Vaccines' },
          vaccine.dateGiven,
        ),
      );
    if (vaccineHits.length > 0) {
      found.push({ key: 'vaccines', heading: `Vaccines · ${vaccineHits.length}`, hits: vaccineHits });
    }

    const medHits: SearchHit[] = medications
      .filter((medication) =>
        matches(q, [medication.name, medication.dosage, medication.notes]),
      )
      .map((medication) =>
        withPet(
          { key: `med-${medication.id}`, petId: medication.petId, title: medication.name, tab: 'Meds' },
          `${medication.dosage} · ${medicationScheduleLabel(medication)}`,
        ),
      );
    if (medHits.length > 0) {
      found.push({
        key: 'medications',
        heading: `Medications · ${medHits.length}`,
        hits: medHits,
      });
    }

    const feedingHits: SearchHit[] = feedingSchedules
      .filter((entry) => matches(q, [entry.mealType, entry.notes]))
      .map((entry) =>
        withPet(
          { key: `feeding-${entry.id}`, petId: entry.petId, title: feedingScheduleLabel(entry), tab: 'Feeding' },
          entry.notes ?? '',
        ),
      );
    if (feedingHits.length > 0) {
      found.push({
        key: 'feeding',
        heading: `Feeding · ${feedingHits.length}`,
        hits: feedingHits,
      });
    }

    const vetHits: SearchHit[] = vetRecords
      .filter((record) =>
        matches(q, [record.visitTitle, record.clinicName, record.veterinarian, record.notes]),
      )
      .map((record) =>
        withPet(
          { key: `vet-${record.id}`, petId: record.petId, title: record.visitTitle, tab: 'VetRecords' },
          [record.visitDate, record.clinicName, record.veterinarian].filter(Boolean).join(' · '),
        ),
      );
    if (vetHits.length > 0) {
      found.push({ key: 'vet', heading: `Vet records · ${vetHits.length}`, hits: vetHits });
    }

    const expenseHits: SearchHit[] = expenses
      .filter((expense) =>
        matches(q, [expense.title, expense.description, expense.category, expense.notes]),
      )
      .map((expense) =>
        withPet(
          { key: `expense-${expense.id}`, petId: expense.petId, title: expense.title, tab: 'Expenses' },
          `${expense.category} · ${expenseAmountLabel(expense.amount)} · ${expense.date}`,
        ),
      );
    if (expenseHits.length > 0) {
      found.push({
        key: 'expenses',
        heading: `Expenses · ${expenseHits.length}`,
        hits: expenseHits,
      });
    }

    const journalHits: SearchHit[] = journalEntries
      .filter((entry) => matches(q, [entry.title, entry.body, entry.mood]))
      .map((entry) =>
        withPet(
          {
            key: `journal-${entry.id}`,
            petId: entry.petId,
            title: entry.title || entry.body.slice(0, 60),
            tab: 'Journal',
          },
          [entry.entryDate, entry.mood].filter(Boolean).join(' · '),
        ),
      );
    if (journalHits.length > 0) {
      found.push({
        key: 'journal',
        heading: `Journal · ${journalHits.length}`,
        hits: journalHits,
      });
    }

    return found;
  }, [query, pets, vaccines, medications, feedingSchedules, vetRecords, expenses, journalEntries, petName]);

  const totalHits = groups.reduce((sum, group) => sum + group.hits.length, 0);

  /**
   * Open a result: switch to the record's pet, then open the module tab via
   * the parent tab navigator (this screen lives in the nested More stack).
   */
  const openHit = async (hit: SearchHit): Promise<void> => {
    try {
      await selectPet(hit.petId);
    } catch {
      // Pet switch is best-effort — still open the module tab below.
    }
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate(hit.tab);
    } else {
      navigation.navigate(hit.tab);
    }
  };

  // Premium gate — same friendly lock copy as PremiumReminderRow.
  if (!premium.isPremium()) {
    return (
      <View style={styles.container}>
        <BackgroundCharacters />
        <View style={styles.lockWrap}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <Text style={styles.lockTitle}>Search — Blueprint Premium</Text>
          <Text style={styles.lockText}>
            Part of Blueprint Premium — start your 14-day free trial
          </Text>
          <TouchableOpacity
            style={styles.lockButton}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={styles.lockButtonText}>View Blueprint Premium</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const trimmed = query.trim();

  return (
    <View style={styles.container}>
      <BackgroundCharacters />
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Search all records…"
          placeholderTextColor={AppColors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setQuery('')}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {trimmed.length === 0 ? (
          <Text style={styles.emptyText}>
            Search across all of your pets — profiles, vaccines, medications, feeding,
            vet records, expenses, and journal entries. Everything stays on this device.
          </Text>
        ) : totalHits === 0 ? (
          <Text style={styles.emptyText}>No results for “{trimmed}”. Try another word.</Text>
        ) : (
          <>
            <Text style={styles.countText}>
              {totalHits} result{totalHits === 1 ? '' : 's'} for “{trimmed}”
            </Text>
            {groups.map((group) => (
              <View key={group.key}>
                <Text style={styles.groupHeading}>{group.heading}</Text>
                {group.hits.map((hit) => (
                  <TouchableOpacity
                    key={hit.key}
                    style={styles.card}
                    onPress={() => openHit(hit)}
                  >
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{hit.title}</Text>
                      <Text style={styles.cardDesc}>{hit.subtitle}</Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: AppColors.text,
  },
  clearButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  clearText: { fontSize: 14, color: AppColors.textMuted },
  list: { padding: 16 },
  countText: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 8 },
  groupHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textMuted,
    marginTop: 10,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 15,
    color: AppColors.textMuted,
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...cardShadow,
  },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  cardDesc: { fontSize: 13, color: AppColors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: AppColors.textMuted },
  lockWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  lockEmoji: { fontSize: 44, marginBottom: 12 },
  lockTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text, textAlign: 'center' },
  lockText: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.primary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  lockButton: {
    marginTop: 16,
    backgroundColor: AppColors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  lockButtonText: { fontSize: 15, fontWeight: '700', color: AppColors.white },
});
