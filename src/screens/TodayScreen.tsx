/**
 * Today — the first tab of the design's IA.
 *
 * The Blueprint at a glance, on paper:
 *  - The home title: the household's own name for the blueprint, editable in
 *    place (tap it to rename — stored on-device, see storage/homeTitle).
 *  - A gear in the header's top-right corner that opens Settings — the same
 *    screen the Shop tab's "Settings" row opens, so the way in is visible from
 *    the first screen instead of buried in a tab.
 *  - The live date and a clock that ticks every minute, rendered in the display
 *    time zone chosen in Settings (Shop → Settings → Date & time) — the device's
 *    own zone by default. Pure `Date()` + `Intl`, offline.
 *  - Today: every pet's active medications and daily meals, tickable (the tick
 *    is kept on-device for today only — see storage/todayCheckoff).
 *  - Upcoming: dated one-off events — vaccines due, vet appointments, and
 *    medication courses starting or ending — grouped by relative date
 *    (see utils/upcoming).
 *  - Pets: the pets list, each row opening that pet's page in the Pets tab and
 *    showing the pet's photo (or its species emoji when there is none).
 *  - The current month's spend snapshot across every pet, by category.
 *  - The Blueprint Premium card for anyone not yet premium.
 *
 * 100% offline: reads the existing contexts (which read AsyncStorage) and
 * navigates; no network, no analytics.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { usePets } from '../context/PetContext';
import { useAccount } from '../context/AccountContext';
import { usePremium } from '../context/PremiumContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useExpenses } from '../context/ExpensesContext';
import { useVaccines } from '../context/VaccinesContext';
import { useVetRecords } from '../context/VetContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { loadTodayDone, toggleTodayDone } from '../storage/todayCheckoff';
import { DEFAULT_HOME_TITLE, loadHomeTitle, saveHomeTitle } from '../storage/homeTitle';
import { petEmoji, petMetaLine } from '../utils/petDisplay';
import { buildUpcoming } from '../utils/upcoming';
import type { UpcomingItem } from '../utils/upcoming';
import {
  AUTO_TIME_ZONE,
  formatClock,
  formatWeekdayDate,
  timeZoneLabel,
  todayISOInTimeZone,
} from '../utils/datetime';
import { BS, COLOR, SPACE } from '../theme';

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
  /** The owner's chosen display time zone (Settings → Date & time). */
  const { timeZone } = useAccount();
  const premium = usePremium();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { expenses } = useExpenses();
  const { vaccines } = useVaccines();
  const { vetRecords } = useVetRecords();

  const [done, setDone] = useState<string[]>([]);
  const [homeTitle, setHomeTitle] = useState(DEFAULT_HOME_TITLE);
  const [titleDraft, setTitleDraft] = useState(DEFAULT_HOME_TITLE);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * The live "now" behind the header's date + clock. Ticked every 30 seconds
   * (so the minute never lags by more than half a minute) — a couple of state
   * updates a minute on an otherwise cheap screen. Pure `Date()`, no network.
   */
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    let cancelled = false;
    loadTodayDone()
      .then((ids) => {
        if (!cancelled) setDone(ids);
      })
      .catch(() => undefined);
    loadHomeTitle()
      .then((title) => {
        if (cancelled) return;
        setHomeTitle(title);
        setTitleDraft(title);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Drop the "Saved" timer if the screen goes away mid-confirmation.
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  // Keep the header's date + clock current: re-render every 30 seconds, and
  // stop the interval when the screen unmounts (or on Fast Refresh).
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  /** Start renaming: the draft begins at whatever the title reads now. */
  const startTitleEdit = () => {
    setTitleDraft(homeTitle);
    setTitleSaved(false);
    setEditingTitle(true);
  };

  /**
   * Save the draft on submit or blur. Trimmed; an empty title reverts to the
   * default. Shows a brief inline "Saved" confirmation.
   */
  const commitTitle = async () => {
    if (!editingTitle) return;
    setEditingTitle(false);
    const next = await saveHomeTitle(titleDraft);
    setHomeTitle(next);
    setTitleDraft(next);
    setTitleSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setTitleSaved(false), 2500);
  };

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

  /**
   * Dated one-off events from every module, grouped by relative date. Rebuilt
   * when a record changes and whenever `now` ticks, so "in 3 days" stays true
   * across midnight. "Today" is the day the chosen display zone is on, so the
   * group labels agree with the clock above them. Small lists, so this stays
   * cheap.
   */
  const upcoming = useMemo(
    () =>
      buildUpcoming({
        vaccines,
        vetRecords,
        medications,
        petName,
        today: todayISOInTimeZone(now, timeZone),
      }),
    [vaccines, vetRecords, medications, petName, now, timeZone],
  );

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

  /** Open the module screen an Upcoming row belongs to, on that pet. */
  const openUpcoming = async (item: UpcomingItem) => {
    if (activePet?.id !== item.petId) {
      try {
        await selectPet(item.petId);
      } catch {
        // Best effort — the module screen still opens on the active pet.
      }
    }
    navigation.navigate('Pets', { screen: item.screen });
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          {editingTitle ? (
            <TextInput
              style={[BS.h1, BS.homeTitleInput]}
              value={titleDraft}
              onChangeText={setTitleDraft}
              onBlur={commitTitle}
              onSubmitEditing={commitTitle}
              autoFocus
              returnKeyType="done"
              maxLength={40}
              accessibilityLabel="Home title"
              placeholder={DEFAULT_HOME_TITLE}
              placeholderTextColor={COLOR.textFaint}
            />
          ) : (
            <TouchableOpacity
              style={BS.homeTitlePress}
              onPress={startTitleEdit}
              accessibilityRole="button"
              accessibilityLabel={`Rename the home title — currently ${homeTitle}`}
            >
              <Text style={BS.h1}>{homeTitle}</Text>
              <Text style={BS.homeTitlePencil}>✎</Text>
            </TouchableOpacity>
          )}
          {/*
            Right-hand group: the Search link, then the Settings gear at the
            far right. Both are quiet Broadsheet text glyphs — no icon library,
            no new dependency, nothing to load offline.
          */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Shop', { screen: 'Search' })}
              accessibilityLabel="Search every record"
            >
              <Text style={BS.link}>Search ›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Shop', { screen: 'Settings' })}
              accessibilityRole="button"
              accessibilityLabel="Settings"
              testID="today-settings-gear"
            >
              <Text style={styles.gear}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>
        {editingTitle ? (
          <Text style={[BS.caption, { marginTop: -SPACE.s1 }]}>
            Rename your blueprint — Enter or tap away to save; empty restores “
            {DEFAULT_HOME_TITLE}”.
          </Text>
        ) : (
          titleSaved && (
            <Text style={[BS.caption, { marginTop: -SPACE.s1 }]}>Saved</Text>
          )
        )}

        {/*
          Live date + clock — rendered in the display zone chosen in Settings
          (the device's own by default), refreshed every 30 seconds. Pure
          `Date()` + Intl, offline.
        */}
        <View style={styles.liveRow}>
          <Text style={BS.kicker}>{formatWeekdayDate(now, timeZone)}</Text>
          <Text style={[BS.kicker, styles.clock]}>{formatClock(now, timeZone)}</Text>
        </View>
        <Text style={[BS.caption, styles.liveNote]}>
          {timeZone === AUTO_TIME_ZONE
            ? 'Your time, on this device — updates every minute.'
            : `Shown in ${timeZoneLabel(timeZone)} — updates every minute. Change this in Shop → Settings.`}
        </Text>

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

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Upcoming</Text>
        {upcoming.groups.length === 0 ? (
          <Text style={BS.italic}>
            Nothing upcoming — vaccine due dates, vet visits and medication
            courses that end show up here.
          </Text>
        ) : (
          <>
            {upcoming.groups.map((group) => (
              <View key={group.date}>
                <Text style={[BS.kicker, styles.upcomingDate]}>{group.label}</Text>
                {group.items.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={BS.divRowBetween}
                    onPress={() => openUpcoming(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.petName} — ${item.descriptor}, ${group.label}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={BS.rowLabel}>{item.petName}</Text>
                      <Text style={BS.caption}>{item.descriptor}</Text>
                    </View>
                    <Text style={BS.link}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            {upcoming.hiddenCount > 0 && (
              <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                … and {upcoming.hiddenCount} more
              </Text>
            )}
            <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
              Tap a dated line to open that record.
            </Text>
          </>
        )}

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Pets</Text>
        {pets.length === 0 ? (
          <Text style={BS.italic}>No pets yet — add the first one below.</Text>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity key={pet.id} style={BS.divRowBetween} onPress={() => openPet(pet.id)}>
              {pet.photoUri ? (
                <Image
                  source={{ uri: pet.photoUri }}
                  style={[BS.avatar, { marginRight: SPACE.s2 }]}
                  resizeMode="cover"
                  accessibilityLabel={`${pet.name}'s photo`}
                />
              ) : (
                <Text style={[BS.avatarEmoji, { marginRight: SPACE.s2 }]}>
                  {petEmoji(pet.species)}
                </Text>
              )}
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

const styles = StyleSheet.create({
  /**
   * The Today header's right-hand group — the Search link and the Settings
   * gear. Sits on the same text baseline as the home title, like the Search
   * link did on its own before the gear was added.
   */
  headerRight: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s2 },
  /**
   * The Settings gear (Today → top right → Shop → Settings). A Broadsheet text
   * glyph in the link colour, not an icon font: nothing extra to bundle and it
   * stays offline. The padding is what gives it a comfortable tap target —
   * the glyph alone would be too small to hit (~40px box in total).
   */
  gear: {
    fontSize: 20,
    lineHeight: 22,
    color: COLOR.accent700,
    paddingHorizontal: SPACE.s1,
    paddingBottom: SPACE.s2,
  },
  /** The live date/clock line: hairline-ruled, like the rest of the sheet. */
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: SPACE.s1,
    paddingBottom: SPACE.s1,
  },
  /** The clock itself — the kicker scale with tabular-looking spacing. */
  clock: { color: COLOR.text, fontWeight: '600' },
  liveNote: { marginTop: 0, marginBottom: SPACE.s1 },
  /** Date heading above each group of Upcoming rows. */
  upcomingDate: { marginTop: SPACE.s2, marginBottom: SPACE.s1 },
});
