/**
 * Home — the Pet Parent Command Center dashboard (design Phase B1: the top half).
 *
 * What this screen is responsible for, and nothing more:
 *
 *  - **Header.** The household's own name for the blueprint (still editable in
 *    place — tap to rename, saved on-device), the Search link and the Settings
 *    gear, exactly as before, on the Warm Ivory canvas of the new visual system.
 *  - **Greeting.** Time-of-day aware ("Good morning 👋"), the "here's what's
 *    happening with your crew today" line, and the live date + clock that tick
 *    every 30 seconds in the display time zone chosen in Settings.
 *  - **The accent band.** The greeting sits on a card whose gradient tints
 *    toward the selected pet's own colour; swiping the crew below crossfades it
 *    (two stacked gradients + one animated opacity — no jarring colour jump).
 *  - **Pet Crew.** The carousel of pets (photo or species emoji, name, age,
 *    status) with a trailing "Add my pet" tile. Tapping a card opens that pet's
 *    page through the same Pets → PetProfile route the app has always used;
 *    swiping settles on a pet and makes it the active one, so the care ring and
 *    the rest of the app agree on who "this pet" is.
 *  - **Daily Care Ring.** Five one-tap checkoffs for the selected pet, each
 *    writing a real, persisted check-in event (types/checkIn, storage/checkIns,
 *    context/CheckInsContext). A checkoff pops a paw print and earns one of a
 *    rotating set of playful lines; an unticked tile is simply neutral.
 *  - **Today's Tasks.** The same pet's meals and medication doses for today, from
 *    the real feeding/medication schedules, tickable: a tick writes the matching
 *    care check-in, so this list and the ring can never disagree, and a second
 *    tap undoes it (design Phase B2).
 *  - **Needs Attention.** Everything worth a look across the household — a
 *    past-due or soon-due vaccine, a course running out, a stale (or missing)
 *    weigh-in, a visit coming up, a health record still empty — each with a
 *    "Fix Now →" that opens the right screen for it.
 *  - **Upcoming.** The household's next dates on a rail: vet visits, vaccine due
 *    dates, medication courses ending, birthdays and adoption days. A pet with no
 *    stored dates contributes nothing.
 *  - **Health Snapshot.** The selected pet's records as they stand: latest weight
 *    and the day it was taken, vaccination status, medication on board, last vet
 *    visit, newest journaled observation.
 *  - **Pet Spending.** The month's spending for the selected pet from the real
 *    expense store, with a small category breakdown and the rest of the crew's
 *    month beside it.
 *  - **Their Story.** The last few journal entries for the selected pet, photos
 *    and moods included.
 *  - **Blueprint Completion.** A gentle per-pet progress strip: profile, photo,
 *    records and care instructions. No rewards, no grades, no shaming.
 *  - **Empty state.** With no pets at all: the illustrated "Who runs your
 *    house?" prompt with one strong "+ Add My Pet" action.
 *
 * Every section below the ring is derived from the app's own stores by
 * `utils/homeSections` and rendered by the Command Center component kit. Nothing
 * is seeded, estimated or demoed, and no section scolds: an absent record is
 * "not on file yet" and an unticked task is "not yet".
 *
 * 100% offline: every value read here comes from an AsyncStorage-backed context;
 * nothing is fetched, nothing is inferred beyond the records themselves, and no
 * demo data is ever seeded (a fresh install shows the empty state).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { usePets } from '../context/PetContext';
import { useAccount } from '../context/AccountContext';
import { useCheckIns } from '../context/CheckInsContext';
import { useFeeding } from '../context/FeedingContext';
import { useMedications } from '../context/MedicationsContext';
import { useVaccines } from '../context/VaccinesContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { CCCard, CCEmptyState, CCSectionTitle } from '../components/CC';
import PetCrewCarousel from '../components/PetCrewCarousel';
import type { PetCrewEntry } from '../components/PetCrewCarousel';
import DailyCareRing from '../components/DailyCareRing';
import {
  HomeTasksCard,
  NeedsAttentionCard,
  UpcomingTimelineCard,
} from '../components/HomeTodaySections';
import {
  BlueprintCompletionCard,
  HealthSnapshotCard,
  MemoriesCard,
  PetSpendingCard,
} from '../components/HomeCrewSections';
import {
  buildAttention,
  buildBlueprint,
  buildHealthSnapshot,
  buildSpend,
  buildTodayTasks,
  buildUpcoming,
  monthKeyOf,
  recentMemories,
  weekdayFromISO,
} from '../utils/homeSections';
import type { FixAction, HomeData, PetModuleScreen } from '../utils/homeSections';
import { DEFAULT_HOME_TITLE, loadHomeTitle, saveHomeTitle } from '../storage/homeTitle';
import { monthName, petAgeLabel, petSpeciesLabel } from '../utils/petDisplay';
import { DEFAULT_ACCENT, hexWithAlpha, petAccent } from '../utils/petAccent';
import { CARE_CHECK_IN_TYPES, CARE_ENCOURAGEMENTS, isEveryDay } from '../types';
import type { CareCheckInType, Medication, Pet, Vaccine } from '../types';
import {
  AUTO_TIME_ZONE,
  formatClock,
  formatInTimeZone,
  formatWeekdayDate,
  timeZoneLabel,
  todayISOInTimeZone,
} from '../utils/datetime';
import { BS, COLOR, RADIUS, SPACE } from '../theme';

export default function TodayScreen(): React.JSX.Element {
  const navigation = useTabRootNavigation();
  const { pets, activePet, selectPet } = usePets();
  /** The owner's chosen display time zone (Settings → Date & time). */
  const { timeZone } = useAccount();
  const { doneTypesFor, toggleCheckIn } = useCheckIns();
  const { vaccines } = useVaccines();
  const { medications } = useMedications();
  const { feedingSchedules } = useFeeding();
  const { vetRecords } = useVetRecords();
  const { expenses } = useExpenses();
  const { journalEntries, journalForPet } = useJournal();
  const { careInstructions } = useCareInstructions();

  const [homeTitle, setHomeTitle] = useState(DEFAULT_HOME_TITLE);
  const [titleDraft, setTitleDraft] = useState(DEFAULT_HOME_TITLE);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleSaved, setTitleSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The live "now" behind the greeting, date and clock (ticked below). */
  const [now, setNow] = useState<Date>(() => new Date());
  /** The playful line the last checkoff earned; rotates one per checkoff. */
  const [message, setMessage] = useState<string | null>(null);
  const messageIndex = useRef(0);

  // The home title + the check-in log live on the device; load them once.
  useEffect(() => {
    let cancelled = false;
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

  // Keep the greeting, date and clock current: re-render every 30 seconds, and
  // stop the interval when the screen unmounts (or on Fast Refresh). The check
  // points move over midnight with it, so "today's care" resets by itself.
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

  /** The pet the ring is about: the active one, or the first pet on file. */
  const selectedPet = activePet ?? pets[0] ?? null;
  const crewAccent = selectedPet ? petAccent(selectedPet.id) : DEFAULT_ACCENT;
  const accentFill = crewAccent.fill;
  /** Today as the chosen display zone sees it — the ring's "done" key. */
  const todayKey = todayISOInTimeZone(now, timeZone);

  const doneTypes = useMemo(
    () => (selectedPet ? doneTypesFor(selectedPet.id, todayKey, timeZone) : []),
    [selectedPet, doneTypesFor, todayKey, timeZone],
  );

  /*
    The gentle accent shift. Two gradient layers: the base keeps the colour we
    are moving away from, the top one holds the new pet's colour and fades in
    over ~380ms. Nothing is re-laid-out and no colour is interpolated by hand,
    so the band never flashes or jumps.
  */
  const accentRef = useRef(accentFill);
  const [bandBase, setBandBase] = useState(accentFill);
  const bandFade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (accentRef.current === accentFill) return;
    setBandBase(accentRef.current);
    accentRef.current = accentFill;
    bandFade.setValue(0);
    Animated.timing(bandFade, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [accentFill, bandFade]);

  // A cheer belongs to the pet it was earned for — drop it when the pet changes.
  useEffect(() => {
    setMessage(null);
  }, [selectedPet?.id]);

  /** Swiping the crew settles on a pet: it becomes the active pet everywhere. */
  const handleSelectPet = useCallback(
    (petId: string) => {
      selectPet(petId).catch(() => undefined);
    },
    [selectPet],
  );

  /** Open a pet's page — the same route the Pets tab uses. */
  const openPet = useCallback(
    async (petId: string) => {
      if (activePet?.id !== petId) {
        try {
          await selectPet(petId);
        } catch {
          // Best effort — the page still opens on whatever pet is active.
        }
      }
      navigation.navigate('Pets', { screen: 'PetProfile', params: { petId } });
    },
    [activePet, navigation, selectPet],
  );

  /**
   * The crew cards. The status line is always a fact the app actually holds —
   * today's check-ins, then a vaccine's due date, then an active medication, and
   * failing all of those the pet's own breed or species. It never guesses at a
   * health verdict and never scolds.
   */
  const crew = useMemo<PetCrewEntry[]>(
    () =>
      pets.map((pet) => ({
        pet,
        accent: petAccent(pet.id),
        age: petAgeLabel(pet),
        status: petStatus(pet, {
          doneToday: doneTypesFor(pet.id, todayKey, timeZone),
          vaccines,
          medications,
          todayKey,
        }),
      })),
    [pets, doneTypesFor, todayKey, timeZone, vaccines, medications],
  );

  /**
   * Schedule notes for the ring's tiles: information only. A tile completes when
   * a check-in says it happened — never because a schedule says it should have.
   */
  const hints = useMemo<Partial<Record<CareCheckInType, string>> | undefined>(() => {
    if (!selectedPet) return undefined;
    const out: Partial<Record<CareCheckInType, string>> = {};
    const weekday = now.getDay();
    const feedTimes = feedingSchedules
      .filter(
        (schedule) =>
          schedule.petId === selectedPet.id &&
          (isEveryDay(schedule.daysOfWeek) || schedule.daysOfWeek.includes(weekday)),
      )
      .map((schedule) => schedule.time)
      .sort();
    if (feedTimes.length > 0) out.food = `due ${feedTimes[0]}`;
    const medTimes = medications
      .filter((medication) => medication.petId === selectedPet.id && medication.active)
      .flatMap((medication) => medication.times)
      .sort();
    if (medTimes.length > 0) out.medication = `due ${medTimes[0]}`;
    return out;
  }, [selectedPet, feedingSchedules, medications, now]);

  /** One tap: record (or undo) today's check-in, then cheer on a fresh tick. */
  const handleToggle = useCallback(
    async (type: CareCheckInType) => {
      if (!selectedPet) return;
      const wasDone = doneTypes.includes(type);
      const result = await toggleCheckIn(selectedPet.id, type, todayKey, timeZone);
      if (result === 'removed' || wasDone) {
        setMessage(null);
        return;
      }
      const line = CARE_ENCOURAGEMENTS[messageIndex.current % CARE_ENCOURAGEMENTS.length];
      messageIndex.current += 1;
      setMessage(line);
    },
    [doneTypes, selectedPet, todayKey, timeZone, toggleCheckIn],
  );

  /* ----------- design Phase B2: everything below the Care Ring ----------- */

  /**
   * Today's weekday as the display zone sees it — which meals and which
   * interval-based medications actually fall due today.
   */
  const weekday = weekdayFromISO(todayKey) ?? now.getDay();

  /**
   * One plain-data view of the app's stores for the bottom half to derive from.
   * Rebuilt whenever any store changes, so a record saved anywhere lands on Home
   * immediately.
   */
  const homeData = useMemo<HomeData>(
    () => ({
      pets,
      vaccines,
      medications,
      feeding: feedingSchedules,
      vetRecords,
      expenses,
      journal: journalEntries,
      careInstructionPetIds: careInstructions.map((record) => record.petId),
      doneTypesFor: (petId: string) => doneTypesFor(petId, todayKey, timeZone),
      todayISO: todayKey,
      weekday,
    }),
    [
      pets,
      vaccines,
      medications,
      feedingSchedules,
      vetRecords,
      expenses,
      journalEntries,
      careInstructions,
      doneTypesFor,
      todayKey,
      timeZone,
      weekday,
    ],
  );

  /** The ring's pet: today's meals and medication doses, with their ticked state. */
  const tasks = useMemo(() => buildTodayTasks(selectedPet, homeData), [selectedPet, homeData]);
  /** Household-wide: what needs a look, what's coming up, how each profile stands. */
  const attention = useMemo(() => buildAttention(homeData), [homeData]);
  const upcoming = useMemo(() => buildUpcoming(homeData), [homeData]);
  const blueprints = useMemo(
    () => pets.map((pet) => buildBlueprint(pet, homeData)),
    [pets, homeData],
  );
  /** Per-pet: the health picture, the month's money and the newest memories. */
  const health = useMemo(() => buildHealthSnapshot(selectedPet, homeData), [selectedPet, homeData]);
  const monthKey = monthKeyOf(todayKey);
  const spend = useMemo(
    () => buildSpend(expenses, selectedPet?.id ?? null, monthKey),
    [expenses, selectedPet, monthKey],
  );
  const monthTotal = useMemo(
    () => buildSpend(expenses, null, monthKey).total,
    [expenses, monthKey],
  );
  const crewSpend = useMemo(
    () =>
      pets.map((pet) => ({
        petId: pet.id,
        name: pet.name,
        total: buildSpend(expenses, pet.id, monthKey).total,
        accent: petAccent(pet.id).fill,
      })),
    [pets, expenses, monthKey],
  );
  const memories = useMemo(
    () => (selectedPet ? recentMemories(journalForPet(selectedPet.id), 3) : []),
    [selectedPet, journalForPet],
  );

  /**
   * Open one of a pet's module screens with that pet active, so the screen the
   * owner lands on is about the pet the card was about. (Deep-linking to the
   * individual record is Phase C; the screen itself is today's destination.)
   */
  const openPetModule = useCallback(
    async (petId: string, module: PetModuleScreen) => {
      if (activePet?.id !== petId) {
        try {
          await selectPet(petId);
        } catch {
          // Best effort — the module still opens on whatever pet is active.
        }
      }
      switch (module) {
        case 'Vaccines':
          navigation.navigate('Pets', { screen: 'Vaccines' });
          return;
        case 'Meds':
          navigation.navigate('Pets', { screen: 'Meds' });
          return;
        case 'Feeding':
          navigation.navigate('Pets', { screen: 'Feeding' });
          return;
        case 'VetRecords':
          navigation.navigate('Pets', { screen: 'VetRecords' });
          return;
        case 'Expenses':
          navigation.navigate('Pets', { screen: 'Expenses' });
          return;
        case 'Journal':
          navigation.navigate('Pets', { screen: 'Journal' });
          return;
        case 'CareInstructionsEditor':
          navigation.navigate('Pets', {
            screen: 'CareInstructionsEditor',
            params: { petId },
          });
          return;
      }
    },
    [activePet, navigation, selectPet],
  );

  /** Every "Fix Now →" on Home comes through here, so none of them is a dead tap. */
  const handleFix = useCallback(
    (fix: FixAction) => {
      switch (fix.to) {
        case 'petForm':
          if (activePet?.id !== fix.petId) selectPet(fix.petId).catch(() => undefined);
          navigation.navigate('PetForm', { petId: fix.petId });
          return;
        case 'petModule':
          openPetModule(fix.petId, fix.module);
          return;
        case 'addRecord':
          navigation.navigate('Records', { screen: 'AddRecord' });
          return;
      }
    },
    [activePet, navigation, openPetModule, selectPet],
  );

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        {/* ---- header: the household's name for its blueprint ---- */}
        <Text style={BS.eyebrow}>Pet parent command center</Text>
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
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('More', { screen: 'Shop', params: { screen: 'Search' } })
              }
              accessibilityLabel="Search every record"
            >
              <Text style={BS.link}>Search ›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('More', { screen: 'Shop', params: { screen: 'Settings' } })
              }
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
          titleSaved && <Text style={[BS.caption, { marginTop: -SPACE.s1 }]}>Saved</Text>
        )}

        {/* ---- greeting band, tinted by the selected pet's accent ---- */}
        <CCCard
          glowTint={accentFill}
          radius={RADIUS.cardLg}
          padding={0}
          style={styles.band}
          testID="home-greeting"
        >
          <View style={styles.bandLayer}>
            <LinearGradient
              colors={bandColors(bandBase)}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={styles.fill}
            />
          </View>
          <Animated.View style={[styles.bandLayer, { opacity: bandFade }]}>
            <LinearGradient
              colors={bandColors(accentFill)}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={styles.fill}
            />
          </Animated.View>
          <View style={styles.bandContent}>
            <Text style={styles.greeting}>{greetingFor(now, timeZone)}</Text>
            <Text style={styles.greetingSub}>
              Here’s what’s happening with your crew today.
            </Text>
            {/*
              Live date + clock, rendered in the display zone chosen in Settings
              (the device's own by default) and refreshed every 30 seconds.
              Pure `Date()` + Intl, offline.
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
          </View>
        </CCCard>

        {pets.length === 0 ? (
          /* ---- no pets yet: the illustrated first-run prompt ---- */
          <CCEmptyState
            emoji="🐾"
            title="Who runs your house?"
            message="Add your first pet and their whole care life lands here — meals, meds, vet days, and the little things worth remembering."
            actionLabel="+ Add My Pet"
            onAction={() => navigation.navigate('PetForm')}
            style={{ marginTop: SPACE.s4 }}
            testID="home-empty-crew"
          />
        ) : (
          <>
            <CCSectionTitle
              eyebrow="Your crew"
              title="Pet Crew"
              emoji="🐾"
              right={
                <TouchableOpacity
                  onPress={() => navigation.navigate('Pets')}
                  accessibilityLabel="See every pet"
                >
                  <Text style={BS.link}>All pets ›</Text>
                </TouchableOpacity>
              }
            />
            <PetCrewCarousel
              entries={crew}
              selectedPetId={selectedPet?.id ?? null}
              onSelectPet={handleSelectPet}
              onOpenPet={openPet}
              onAddPet={() => navigation.navigate('PetForm')}
            />

            {selectedPet ? (
              <>
                <CCSectionTitle
                  eyebrow="Care ring"
                  title="Today’s care"
                  emoji="🩺"
                  accent={accentFill}
                />
                <DailyCareRing
                  pet={selectedPet}
                  accent={crewAccent}
                  doneTypes={doneTypes}
                  onToggle={handleToggle}
                  hints={hints}
                  message={message}
                />
                <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
                  {pets.length > 1
                    ? 'Each pet keeps their own day — swipe the crew to switch whose ring this is.'
                    : 'Every tick is saved on this device and resets when tomorrow starts.'}
                </Text>

                {/* ---- 1. Today's Tasks: meals + med doses, tickable ---- */}
                <CCSectionTitle
                  eyebrow="Your day"
                  title="Today’s Tasks"
                  emoji="✅"
                  accent={COLOR.sunshine}
                />
                <HomeTasksCard
                  tasks={tasks}
                  petName={selectedPet.name}
                  /* A task tick is a care check-in: the very same write the ring
                     makes, so the two views stay consistent in both directions. */
                  onToggle={(task) => handleToggle(task.checkIn)}
                  onAddFeeding={() =>
                    handleFix({ to: 'petModule', petId: selectedPet.id, module: 'Feeding' })
                  }
                  onAddMedication={() =>
                    handleFix({ to: 'petModule', petId: selectedPet.id, module: 'Meds' })
                  }
                />

                {/* ---- 2. Needs Attention: across the household, each fixable ---- */}
                <CCSectionTitle
                  eyebrow="Heads up"
                  title="Needs Attention"
                  emoji="🩺"
                  accent={COLOR.coral}
                />
                <NeedsAttentionCard items={attention} onFix={handleFix} />

                {/* ---- 3. Upcoming: the household's next real dates ---- */}
                <CCSectionTitle
                  eyebrow="Coming up"
                  title="Upcoming"
                  emoji="📅"
                  accent={COLOR.lavender}
                />
                <UpcomingTimelineCard
                  items={upcoming}
                  onOpen={handleFix}
                  onAddRecord={() => handleFix({ to: 'addRecord' })}
                />

                {/* ---- 4. Health Snapshot: the selected pet's records ---- */}
                <CCSectionTitle
                  eyebrow="Health"
                  title="Health Snapshot"
                  emoji="💚"
                  accent={COLOR.aqua}
                />
                <HealthSnapshotCard pet={selectedPet} snapshot={health} onFix={handleFix} />

                {/* ---- 5. Pet Spending: this month, from the expense store ---- */}
                <CCSectionTitle
                  eyebrow="Spending"
                  title="Pet Spending"
                  emoji="💸"
                  accent={COLOR.tangerine}
                />
                <PetSpendingCard
                  pet={selectedPet}
                  monthLabel={monthName(now)}
                  spend={spend}
                  crew={crewSpend}
                  monthTotal={monthTotal}
                  onFix={handleFix}
                />

                {/* ---- 6. Their Story: the newest journal entries ---- */}
                <CCSectionTitle
                  eyebrow="Their story"
                  title="Memories"
                  emoji="📖"
                  accent={COLOR.coral}
                />
                <MemoriesCard
                  pet={selectedPet}
                  entries={memories}
                  timeZone={timeZone}
                  onAdd={() =>
                    handleFix({ to: 'petModule', petId: selectedPet.id, module: 'Journal' })
                  }
                  onSeeAll={() =>
                    handleFix({ to: 'petModule', petId: selectedPet.id, module: 'Journal' })
                  }
                />

                {/* ---- 7. Blueprint Completion: gentle per-pet progress ---- */}
                <CCSectionTitle
                  eyebrow="Progress"
                  title="Blueprint Completion"
                  emoji="🧭"
                  accent={COLOR.sunshine}
                />
                <BlueprintCompletionCard progress={blueprints} onFix={handleFix} />
                <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
                  {pets.length > 1
                    ? 'Progress is per pet — swipe the crew above to see each blueprint.'
                    : 'Progress is a map of what’s in place, never a score.'}
                </Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------- helpers -- */

/**
 * The greeting for the current time in the owner's display zone: morning before
 * noon, afternoon before 18:00, evening after. Falls back to the device's own
 * clock if the runtime cannot render the hour.
 */
function greetingFor(date: Date, zone?: string): string {
  let hour = date.getHours();
  const rendered = formatInTimeZone(date, zone, { hour: 'numeric', hourCycle: 'h23' });
  const parsed = Number.parseInt(rendered.replace(/\D/g, ''), 10);
  if (Number.isFinite(parsed)) hour = parsed;
  if (hour < 12) return 'Good morning 👋';
  if (hour < 18) return 'Good afternoon 👋';
  return 'Good evening 👋';
}

/** The greeting band's gradient: the accent tint fading out over the white card. */
function bandColors(fill: string): [string, string] {
  return [hexWithAlpha(fill, 0.34), hexWithAlpha(fill, 0.05)];
}

/**
 * One pet's crew status line — a label derived only from records that exist:
 * today's check-ins, an overdue vaccine, an active medication, a vaccine still
 * in date; otherwise the pet's own breed (or species), which is what a brand-new
 * pet honestly has to show.
 */
function petStatus(
  pet: Pet,
  input: {
    doneToday: CareCheckInType[];
    vaccines: Vaccine[];
    medications: Medication[];
    todayKey: string;
  },
): { label: string } {
  if (input.doneToday.length >= CARE_CHECK_IN_TYPES.length) {
    return { label: 'All care done today' };
  }
  const own = input.vaccines.filter((vaccine) => vaccine.petId === pet.id);
  if (own.some((vaccine) => vaccine.dueDate && vaccine.dueDate < input.todayKey)) {
    return { label: 'Vaccine due' };
  }
  if (input.medications.some((medication) => medication.petId === pet.id && medication.active)) {
    return { label: 'On medication' };
  }
  if (own.some((vaccine) => vaccine.dueDate && vaccine.dueDate >= input.todayKey)) {
    return { label: 'Vaccines up to date' };
  }
  const breed = pet.breed?.trim();
  return { label: breed && breed.length > 0 ? breed : petSpeciesLabel(pet) };
}

const styles = StyleSheet.create({
  /** The header's right-hand group: the Search link and the Settings gear. */
  headerRight: { flexDirection: 'row', alignItems: 'baseline', gap: SPACE.s2 },
  /**
   * The Settings gear. A text glyph in the link colour, not an icon font:
   * nothing extra to bundle and it stays offline. `minWidth`/`minHeight` give it
   * a comfortable ~40px tap target — the glyph alone would be far too small.
   */
  gear: {
    fontSize: 20,
    lineHeight: 22,
    color: COLOR.accent700,
    minWidth: 40,
    minHeight: 40,
    textAlign: 'center',
    paddingHorizontal: SPACE.s1,
    paddingBottom: SPACE.s2,
  },
  /** The greeting card: the gradient layers fill it, the content sits on top. */
  band: { overflow: 'hidden', marginTop: SPACE.s3, padding: 0 },
  bandLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
  bandContent: { padding: SPACE.s4, gap: 2 },
  greeting: {
    fontFamily: BS.h1.fontFamily,
    fontSize: 26,
    fontWeight: '700',
    color: COLOR.text,
    letterSpacing: -0.3,
  },
  greetingSub: {
    fontFamily: BS.caption.fontFamily,
    fontSize: 13.5,
    color: COLOR.textMuted,
    marginBottom: SPACE.s2,
  },
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: SPACE.s1,
  },
  /** The clock itself — the kicker scale, in ink rather than muted. */
  clock: { color: COLOR.text, fontWeight: '600' },
  liveNote: { marginTop: 2 },
});
