/**
 * Travel Mode — the pet parent's trip-planning layer (HANDOFF, unit 1 of 3).
 *
 * Free and ungated, like the caregiver check-in and Emergency Mode: planning a
 * trip and packing the checklist are the owner's own business, and the paywall
 * stays exactly where Sitter Mode already put it — on *creating* a pass.
 *
 * What this screen is, in the order it reads:
 *   1. The trip        — an optional name, the two dates (validated inline with
 *                        the wizard's own date rule) and the pets coming along,
 *                        prefilled with every pet.
 *   2. Before you go   — the four-line packing checklist, ticked one tap each,
 *                        saved on this device with the trip.
 *   3. What your sitter gets — a read-only per-pet handoff preview, built from
 *                        the pets' real records through the wizard's own
 *                        prefill builders. Nothing is invented: a line with
 *                        nothing stored says "Not on file".
 *   4. The pass        — "Create the care pass" saves the trip and hands off to
 *                        the existing "I'm Leaving Town" wizard with this trip's
 *                        pets and dates, so the wizard stays the single source
 *                        of truth for making a pass.
 *
 * When a pass on this device already covers these dates for these pets, the
 * screen says so plainly and links to it instead of quietly making a second one.
 *
 * 100% offline: trips are read and written through AsyncStorage, and the pets'
 * records through the same contexts every other screen uses. No network.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CCButton, CCCard, CCEmptyState, CCPill } from '../components/CC';
import { useGoToPremium } from '../components/CarePassPremiumLock';
import { useAccount } from '../context/AccountContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useFeeding } from '../context/FeedingContext';
import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { useSitter } from '../context/SitterContext';
import { useVetRecords } from '../context/VetContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { emergencyDetailsRepository, extrasForPet } from '../storage/emergencyDetails';
import { travelTripRepository } from '../storage/travelTrips';
import type { EmergencyExtrasByPet } from '../pdf/emergency/document';
import {
  TRAVEL_CHECKLIST,
  TRAVEL_BLANK,
  travelChecklistLabel,
  travelDatesStatusLine,
  travelDraftFromTrip,
  travelDraftToInput,
  travelInitDraft,
  travelIsChecked,
  travelPrefillForTrip,
  travelToggleChecked,
  travelTripDatesLabel,
  travelTripDays,
  travelTripName,
  travelTripPetsLabel,
  travelTripProblem,
  travelTripStatus,
  travelTripStatusLabel,
  travelTripStatusTone,
  travelTripSummaries,
  findCoveringPass,
  coveringPassLine,
} from '../utils/travelMode';
import type { TravelDraft, TravelTrip } from '../utils/travelMode';
import { todayISOInTimeZone } from '../utils/datetime';
import { petAccent } from '../utils/petAccent';
import { petEmojiFor, petSpeciesLabel } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE, TONE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'TravelMode'>;

export default function TravelModeScreen({ navigation, route }: Props): React.JSX.Element {
  const { username, timeZone } = useAccount();
  const { pets } = usePets();
  const { feedingForPet } = useFeeding();
  const { medicationsForPet } = useMedications();
  const { vetRecordsForPet } = useVetRecords();
  const { getForPet: getCareInstructions } = useCareInstructions();
  const { carePasses } = useSitter();
  const premium = usePremium();
  const goToPremium = useGoToPremium();
  const rootNavigation = useTabRootNavigation();
  const entitled = premium.isPremium();

  const todayKey = useMemo(() => todayISOInTimeZone(new Date(), timeZone), [timeZone]);

  const [extras, setExtras] = useState<EmergencyExtrasByPet>({});
  const [trips, setTrips] = useState<TravelTrip[]>([]);
  /** The owner's edits. Null means "nothing touched yet" — see `active` below. */
  const [draft, setDraft] = useState<TravelDraft | null>(null);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  /**
   * The trip being edited. Until the owner touches anything this is derived
   * fresh (every pet on it, today → a week today), so it is never built from
   * half-loaded pets; after the first edit it is exactly what they typed.
   */
  const active: TravelDraft = draft ?? travelInitDraft(pets, todayKey);

  /** Re-read the saved trips (after a save) and the emergency-card details. */
  const reloadTrips = useCallback(async (): Promise<TravelTrip[]> => {
    try {
      const loaded = await travelTripRepository.list();
      setTrips(loaded);
      return loaded;
    } catch {
      // A storage failure must not blank the screen; the list stays as it was.
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    emergencyDetailsRepository
      .load()
      .then((loaded) => {
        if (!cancelled) setExtras(loaded);
      })
      .catch(() => {
        /* Nothing on file is a valid answer — the lines just say so. */
      });
    reloadTrips().then((loaded) => {
      if (cancelled) return;
      // Opened for one saved trip (`TravelMode: { tripId }`): load it in.
      const wanted = route.params?.tripId;
      if (!wanted) return;
      const found = loaded.find((trip) => trip.id === wanted);
      if (found) setDraft(travelDraftFromTrip(found));
    });
    return () => {
      cancelled = true;
    };
  }, [reloadTrips, route.params?.tripId]);

  /** Every edit clears the last problem/notice — the screen only ever shows one. */
  const edit = useCallback((change: (current: TravelDraft) => TravelDraft) => {
    setProblem('');
    setNotice('');
    setDraft((current) => change(current ?? travelInitDraft(pets, todayKey)));
  }, [pets, todayKey]);

  /** What one pet's handoff looks like right now — read through the wizard. */
  const summarySources = useCallback(
    (petId: string) => ({
      ownerName: username,
      todayKey,
      feeding: feedingForPet(petId),
      medications: medicationsForPet(petId),
      careInstructions: getCareInstructions(petId),
      extras: extrasForPet(extras, petId),
      vetRecords: vetRecordsForPet(petId),
    }),
    [
      extras,
      feedingForPet,
      getCareInstructions,
      medicationsForPet,
      todayKey,
      username,
      vetRecordsForPet,
    ],
  );

  const summaries = useMemo(
    () => travelTripSummaries(active, pets, (pet) => summarySources(pet.id)),
    [active, pets, summarySources],
  );

  /** A pass on this device that already covers this trip, or null. */
  const covering = useMemo(() => findCoveringPass(carePasses, active), [carePasses, active]);

  const tripProblem = travelTripProblem(active);
  const dateStatus = travelDatesStatusLine(active.startDate, active.endDate, todayKey);
  const days = travelTripDays(active);

  /** Write the trip (and its checklist) to this device. Free, never gated. */
  const saveTrip = useCallback(
    async (source: TravelDraft): Promise<TravelTrip | null> => {
      const problem = travelTripProblem(source);
      if (problem) {
        setProblem(problem);
        return null;
      }
      try {
        const saved = await travelTripRepository.save(travelDraftToInput(source), source.id);
        setDraft(travelDraftFromTrip(saved));
        await reloadTrips();
        return saved;
      } catch {
        setProblem('That trip could not be saved just now. Nothing was lost — try again.');
        return null;
      }
    },
    [reloadTrips],
  );

  const onSave = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const saved = await saveTrip(active);
    setSaving(false);
    if (saved) setNotice(`“${travelTripName(saved)}” is saved on this device.`);
  }, [active, saveTrip, saving]);

  /**
   * Create the pass: save the trip (free), then — if the owner is entitled —
   * hand the wizard this trip's pets and dates. Without entitlement the owner
   * lands on the app's own premium screen, exactly as Sitter Mode does, with
   * their trip and checklist already saved.
   */
  const onCreatePass = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    const saved = await saveTrip(active);
    setSaving(false);
    if (!saved) return;
    if (!entitled) {
      goToPremium();
      return;
    }
    const prefill = travelPrefillForTrip(saved, pets);
    if (!prefill) {
      setProblem('Pick at least one pet that is still in your app, then try again.');
      return;
    }
    navigation.navigate('CarePassWizard', {
      petIds: prefill.petIds,
      startDate: prefill.startDate,
      endDate: prefill.endDate,
    });
  }, [
    active,
    entitled,
    goToPremium,
    navigation,
    pets,
    saveTrip,
    saving,
  ]);

  /** Tick or untick one checklist line. Saved with the trip when it is saved. */
  const toggleCheck = useCallback(
    (slug: string) => {
      setProblem('');
      setNotice('');
      setDraft((current) => {
        const base = current ?? travelInitDraft(pets, todayKey);
        return { ...base, checked: travelToggleChecked(base, slug) };
      });
    },
    [pets, todayKey],
  );

  /* ------------------------------------------------------------ the trip -- */
  const tripCard = (
    <CCCard glowTint={COLOR.blue} accent={COLOR.blue} style={{ marginTop: SPACE.s3 }}>
      <Text style={[BS.cardKicker, { color: TONE.blue.fg }]}>Your trip</Text>
      <Text style={BS.cardTitleLg}>Where and when</Text>
      <View style={BS.field}>
        <Text style={styles.miniLabel}>Trip name (optional)</Text>
        <TextInput
          style={BS.input}
          value={active.name}
          onChangeText={(value) => edit((current) => ({ ...current, name: value }))}
          placeholder="e.g. Grandma’s birthday, four days"
          placeholderTextColor={COLOR.textFaint}
          accessibilityLabel="Trip name"
          testID="travel-name"
        />
      </View>
      <View style={BS.row}>
        <View style={[BS.field, { flex: 1 }]}>
          <Text style={styles.miniLabel}>Away from (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={active.startDate}
            onChangeText={(value) => edit((current) => ({ ...current, startDate: value }))}
            placeholder={todayKey}
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Away from date"
            testID="travel-start-date"
          />
        </View>
        <View style={[BS.field, { flex: 1 }]}>
          <Text style={styles.miniLabel}>Back home (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={active.endDate}
            onChangeText={(value) => edit((current) => ({ ...current, endDate: value }))}
            placeholder={todayKey}
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Back home date"
            testID="travel-end-date"
          />
        </View>
      </View>
      {tripProblem ? (
        <Text style={styles.error} testID="travel-dates-error">
          {tripProblem}
        </Text>
      ) : dateStatus ? (
        <Text style={[BS.caption]} testID="travel-dates-status">
          {dateStatus}
          {days > 0 ? ` ${days} ${days === 1 ? 'day' : 'days'}, both ends included.` : ''}
        </Text>
      ) : null}
      <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
        Dates are plain calendar days, so nothing shifts if your sitter is in another time zone.
        Nothing here is sent anywhere.
      </Text>
    </CCCard>
  );

  /* ------------------------------------------------------------ the pets -- */
  const petsCard = (
    <CCCard accent={COLOR.tangerine} style={{ marginTop: SPACE.s3 }}>
      <Text style={[BS.cardKicker, { color: TONE.tangerine.fg }]}>The pets</Text>
      <Text style={BS.cardTitleLg}>Who is on this trip</Text>
      {pets.length === 0 ? (
        <CCEmptyState
          emoji="🐾"
          title="Add a pet first"
          message="A trip covers pets — add yours and come straight back here."
          actionLabel="Go to Pets"
          onAction={() => rootNavigation.navigate('Pets', { screen: 'PetList' })}
          testID="travel-no-pets"
        />
      ) : (
        <>
          {pets.map((pet) => {
            const picked = active.petIds.includes(pet.id);
            const accent = petAccent(pet.id);
            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petRow, picked && { borderColor: accent.fill }]}
                onPress={() =>
                  edit((current) => ({
                    ...current,
                    petIds: picked
                      ? current.petIds.filter((id) => id !== pet.id)
                      : [...current.petIds, pet.id],
                  }))
                }
                accessibilityRole="button"
                accessibilityLabel={`${picked ? 'Remove' : 'Add'} ${pet.name} to this trip`}
                testID={`travel-pet-${pet.id}`}
              >
                <View style={[styles.avatarRing, picked && { borderColor: accent.fill }]}>
                  {pet.photoUri ? (
                    <Image
                      source={{ uri: pet.photoUri }}
                      style={styles.avatarPhoto}
                      resizeMode="cover"
                      accessibilityLabel={`${pet.name}'s photo`}
                    />
                  ) : (
                    <Text style={styles.avatarEmoji}>{petEmojiFor(pet)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={BS.rowLabel}>{pet.name}</Text>
                  <Text style={BS.caption}>{petSpeciesLabel(pet)}</Text>
                </View>
                {picked ? <CCPill label="On the trip" tone="leaf" /> : null}
              </TouchableOpacity>
            );
          })}
          <Text style={[BS.caption, { marginTop: SPACE.s2 }]} testID="travel-pet-count">
            {active.petIds.length === 0
              ? 'No pets picked yet.'
              : `${active.petIds.length} of ${pets.length} picked.`}
          </Text>
        </>
      )}
    </CCCard>
  );

  /* ------------------------------------------------------- the checklist -- */
  const checklistCard = (
    <CCCard accent={COLOR.aqua} style={{ marginTop: SPACE.s3 }}>
      <Text style={[BS.cardKicker, { color: TONE.aqua.fg }]}>Before you go</Text>
      <Text style={BS.cardTitleLg}>The packing list</Text>
      <Text style={[BS.caption, { marginBottom: SPACE.s1 }]}>
        Four things a handover actually turns on. Tick them as you go — it saves with the trip,
        and nothing here is scored.
      </Text>
      {TRAVEL_CHECKLIST.map((item) => {
        const done = travelIsChecked(active, item.slug);
        return (
          <TouchableOpacity
            key={item.slug}
            style={styles.checkRow}
            onPress={() => toggleCheck(item.slug)}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} — ${done ? 'done' : 'not done yet'}`}
            testID={`travel-check-${item.slug}`}
          >
            <View style={[styles.checkBox, done && styles.checkBoxDone]}>
              <Text style={[styles.checkTick, done && { color: COLOR.white }]}>
                {done ? '✓' : ''}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[BS.rowLabel, done && styles.rowLabelDone]}>
                {item.emoji} {item.label}
              </Text>
              <Text style={BS.caption}>{item.hint}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <Text style={[BS.caption, { marginTop: SPACE.s1 }]} testID="travel-check-count">
        {travelChecklistLabel(active)}
      </Text>
    </CCCard>
  );

  /* ---------------------------------------------------- the handoff view -- */
  const handoffBlock = (
    <>
      <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>What your sitter will get</Text>
      <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
        Read straight off each pet’s own records, in the same words the care pass will carry.
        It is a preview and nothing else — the wizard is where you edit any of it, and anything
        you have not stored says “{TRAVEL_BLANK}”.
      </Text>
      {summaries.length === 0 ? (
        <View style={BS.dashedBox}>
          <Text style={BS.caption}>
            No pets on this trip yet — pick who it covers and their handoff appears here.
          </Text>
        </View>
      ) : (
        summaries.map((summary) => (
          <CCCard
            key={summary.petId}
            accent={petAccent(summary.petId).fill}
            style={{ marginTop: SPACE.s2 }}
          >
            <View testID={`travel-summary-${summary.petId}`}>
              <Text style={styles.petName}>
                {summary.emoji} {summary.name}
              </Text>
              <Text style={[BS.caption, { marginBottom: SPACE.s1 }]}>{summary.readyLine}</Text>
              {summary.lines.map((line) => (
                <View key={line.key} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{line.label}</Text>
                  <Text
                    style={[styles.summaryValue, line.blank && styles.summaryBlank]}
                    testID={`travel-summary-${summary.petId}-${line.key}`}
                  >
                    {line.value}
                  </Text>
                </View>
              ))}
            </View>
          </CCCard>
        ))
      )}
    </>
  );

  /* ------------------------------------------------------- the saved list -- */
  const tripsBlock = (
    <>
      <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>Your trips</Text>
      <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
        Every trip saved on this device, newest first, with the days it covers and how much of
        the packing list is done. Tap one to carry on with it. They live in the same on-device
        storage as everything else, so deleting your data removes them too.
      </Text>
      {trips.length === 0 ? (
        <View style={BS.dashedBox}>
          <Text style={BS.caption}>
            No trips saved yet — fill in the dates above and save this one.
          </Text>
        </View>
      ) : (
        trips.map((trip) => {
          const status = travelTripStatus(trip, todayKey);
          return (
            <TouchableOpacity
              key={trip.id}
              style={BS.divRow}
              onPress={() => {
                setProblem('');
                setNotice(`Editing “${travelTripName(trip)}” — change anything and save it again.`);
                setDraft(travelDraftFromTrip(trip));
              }}
              accessibilityRole="button"
              accessibilityLabel={`Open trip ${travelTripName(trip)}`}
              testID={`trip-row-${trip.id}`}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[BS.rowLabel, { flex: 1 }]}>{travelTripName(trip)}</Text>
                <CCPill
                  label={travelTripStatusLabel(status)}
                  tone={travelTripStatusTone(status)}
                />
              </View>
              <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                {travelTripDatesLabel(trip)} · {travelTripPetsLabel(trip, pets)}
              </Text>
              <Text style={[BS.caption, { color: COLOR.textFaint, marginTop: 2 }]}>
                {travelChecklistLabel(trip)}
              </Text>
            </TouchableOpacity>
          );
        })
      )}
    </>
  );

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Sitter Mode"
          testID="travel-back"
        >
          <Text style={BS.link}>‹ Sitter Mode</Text>
        </TouchableOpacity>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Handoff</Text>
        <Text style={BS.h1}>Travel Mode</Text>
        <Text style={BS.body}>
          Plan the trip before there is a sitter in the house: the days you are away, which pets
          it covers, what still needs packing, and exactly what your sitter will be told. When it
          is ready, the trip hands straight over to the care pass — same wizard, already filled
          in with these pets and these dates.
        </Text>

        {tripCard}
        {petsCard}
        {checklistCard}

        {covering ? (
          <CCCard
            glowTint={COLOR.coral}
            accent={COLOR.coral}
            style={{ marginTop: SPACE.s3 }}
            testID="travel-existing-pass-card"
          >
            <Text style={[BS.cardKicker, { color: TONE.coral.fg }]}>Already covered</Text>
            <Text style={BS.cardTitleLg} testID="travel-existing-pass">
              A pass already covers these dates
            </Text>
            <Text style={[BS.caption]}>{coveringPassLine(covering)}</Text>
            <CCButton
              label="Open that pass"
              emoji="🎟️"
              variant="secondary"
              onPress={() =>
                navigation.navigate('CarePassDetail', { passId: covering.id })
              }
              accessibilityLabel="Open the care pass that already covers these dates"
              testID="travel-open-pass"
              style={{ marginTop: SPACE.s2 }}
            />
            <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
              Creating a second one is allowed — the app never merges passes for you.
            </Text>
          </CCCard>
        ) : null}

        {handoffBlock}

        {problem ? (
          <Text style={styles.error} testID="travel-problem">
            {problem}
          </Text>
        ) : null}
        {notice ? (
          <Text style={styles.notice} testID="travel-notice">
            {notice}
          </Text>
        ) : null}

        <View style={{ height: SPACE.s4 }} />
        <CCButton
          label={saving ? 'Saving…' : 'Save this trip'}
          emoji="🗺️"
          variant="secondary"
          onPress={() => {
            void onSave();
          }}
          disabled={saving}
          accessibilityLabel="Save this trip"
          testID="travel-save-trip"
        />
        <CCButton
          label={saving ? 'Saving…' : 'Create the care pass'}
          emoji="🎟️"
          onPress={() => {
            void onCreatePass();
          }}
          disabled={saving}
          accessibilityLabel="Create the care pass"
          testID="travel-create-pass"
          style={{ marginTop: SPACE.s2 }}
        />
        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          {entitled
            ? 'Opens the eight-step wizard with this trip’s pets and dates already in it.'
            : 'Blueprint Premium — the checklist is free, and creating the pass starts your 14-day free trial.'}
        </Text>

        {tripsBlock}

        <Text style={[BS.caption, { marginTop: SPACE.s4, textAlign: 'center' }]}>
          Nothing is uploaded, and nothing is sent until you choose to share it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  miniLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
    marginBottom: SPACE.s1,
  },
  error: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.accent2_700,
    marginTop: SPACE.s1,
  },
  notice: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: TONE.leaf.fg,
    backgroundColor: TONE.leaf.bg,
    borderRadius: RADIUS.button,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    marginTop: SPACE.s3,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    padding: SPACE.s3,
    marginTop: SPACE.s2,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 24, lineHeight: 30 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  checkBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkBoxDone: { backgroundColor: COLOR.leaf, borderColor: COLOR.leaf },
  checkTick: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '700', color: COLOR.leaf },
  rowLabelDone: { color: COLOR.textMuted },
  petName: {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: '700',
    color: COLOR.text,
  },
  summaryRow: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  summaryLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  summaryValue: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLOR.text,
    marginTop: 2,
  },
  summaryBlank: { color: COLOR.textFaint },
});
