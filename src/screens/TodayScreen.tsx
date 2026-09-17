/**
 * Today — the first tab of the design's IA.
 *
 * The Blueprint at a glance, on paper:
 *  - Today: every pet's active medications and daily meals, tickable (the tick
 *    is kept on-device for today only — see storage/todayCheckoff).
 *  - Pets: the pets list, each row opening that pet's page in the Pets tab.
 *  - The current month's spend snapshot across every pet, by category.
 *  - The Blueprint Premium card for anyone not yet premium.
 *
 * 100% offline: reads the existing contexts (which read AsyncStorage) and
 * navigates; no network, no analytics.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useExpenses } from '../context/ExpensesContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { loadTodayDone, toggleTodayDone } from '../storage/todayCheckoff';
import { petMetaLine } from '../utils/petDisplay';
import { BS, SPACE } from '../theme';

/** One tickable line in the Today list. */
interface TodayTask {
  id: string;
  name: string;
  meta: string;
  time: string;
}

export default function TodayScreen(): React.JSX.Element {
  const navigation = useTabRootNavigation();
  const { pets, activePet, selectPet } = usePets();
  const premium = usePremium();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { expenses } = useExpenses();

  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadTodayDone()
      .then((ids) => {
        if (!cancelled) setDone(ids);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const petName = useCallback(
    (petId: string) => pets.find((pet) => pet.id === petId)?.name ?? 'Pet',
    [pets],
  );

  /** Meds and meals for every pet — the day's list, earliest first. */
  const tasks = useMemo<TodayTask[]>(() => {
    const rows: TodayTask[] = [];
    medications
      .filter((medication) => medication.active)
      .forEach((medication) => {
        rows.push({
          id: `med:${medication.id}`,
          name: medication.name,
          meta: `${petName(medication.petId)} · ${medication.dosage}`,
          time: medication.times[0] ?? '—',
        });
      });
    feedingSchedules.forEach((schedule) => {
      rows.push({
        id: `feed:${schedule.id}`,
        name: schedule.mealType,
        meta: `${petName(schedule.petId)} · ${portionLabel(schedule)}`,
        time: schedule.time,
      });
    });
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }, [medications, feedingSchedules, petName]);

  const totalSpend = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const spendByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    expenses.forEach((expense) => {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [expenses]);

  const toggle = async (id: string) => {
    setDone(await toggleTodayDone(id));
  };

  const openPet = async (petId: string) => {
    if (activePet?.id !== petId) {
      try {
        await selectPet(petId);
      } catch {
        // Best effort — the page still opens on whatever pet is active.
      }
    }
    navigation.navigate('Pets', { screen: 'PetProfile', params: { petId } });
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <Text style={BS.h1}>The Blueprint</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Shop', { screen: 'Search' })}
            accessibilityLabel="Search every record"
          >
            <Text style={BS.link}>Search ›</Text>
          </TouchableOpacity>
        </View>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s2 }]}>Today</Text>
        {tasks.length === 0 ? (
          <Text style={BS.italic}>Nothing scheduled yet.</Text>
        ) : (
          tasks.map((task) => {
            const checked = done.includes(task.id);
            return (
              <TouchableOpacity
                key={task.id}
                style={BS.divRowBetween}
                onPress={() => toggle(task.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[BS.rowLabel, checked && BS.strike]}>{task.name}</Text>
                  <Text style={BS.caption}>{task.meta}</Text>
                </View>
                <Text style={BS.caption}>{task.time}</Text>
              </TouchableOpacity>
            );
          })
        )}
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          Tap a line to tick it off — the list resets tomorrow.
        </Text>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Pets</Text>
        {pets.length === 0 ? (
          <Text style={BS.italic}>No pets yet — add the first one below.</Text>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity key={pet.id} style={BS.divRowBetween} onPress={() => openPet(pet.id)}>
              <View style={{ flex: 1 }}>
                <Text style={BS.rowLabel}>
                  {pet.name}
                  {activePet?.id === pet.id ? '  ·  active' : ''}
                </Text>
                <Text style={BS.caption}>{petMetaLine(pet)}</Text>
              </View>
              <Text style={BS.link}>›</Text>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity
          style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
          onPress={() => navigation.navigate('PetForm')}
        >
          <Text style={BS.btnSecondaryText}>＋ Add a pet</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[BS.divRowBetween, { marginTop: SPACE.s4 }]}
          onPress={() => navigation.navigate('Pets', { screen: 'Expenses' })}
        >
          <View>
            <Text style={BS.fieldLabel}>{monthName()} spend</Text>
            <Text style={BS.h1}>{formatMoney(totalSpend)}</Text>
          </View>
          <Text style={BS.link}>Expenses ›</Text>
        </TouchableOpacity>
        {spendByCategory.length > 0 && (
          <Text style={BS.caption}>
            {spendByCategory
              .map(([category, amount]) => `${category} ${formatMoney(amount)}`)
              .join(' · ')}
          </Text>
        )}

        {!premium.isPremium() && (
          <View style={BS.card}>
            <Text style={BS.cardKicker}>Blueprint Premium</Text>
            <Text style={BS.cardTitleLg}>
              Reminders that actually go off, a shared file, and history that never expires.
            </Text>
            <Text style={BS.caption}>
              One-time unlock with a 14-day free trial. Tracking stays free forever.
            </Text>
            <TouchableOpacity
              style={BS.btnPrimary}
              onPress={() => navigation.navigate('Shop', { screen: 'Premium' })}
            >
              <Text style={BS.btnPrimaryText}>See what’s included</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** The portion part of a feeding row, e.g. "1 cups · no toppers". */
function portionLabel(schedule: {
  portionAmount: number;
  portionUnit: string;
  notes?: string;
}): string {
  const notes = schedule.notes ? ` · ${schedule.notes}` : '';
  return `${schedule.portionAmount} ${schedule.portionUnit}${notes}`;
}

/** The current month, e.g. "September". */
function monthName(): string {
  return new Date().toLocaleDateString(undefined, { month: 'long' });
}

/** Plain amount — the app never assumes a currency. */
function formatMoney(amount: number): string {
  return Number.isFinite(amount) ? amount.toFixed(2) : '0';
}
