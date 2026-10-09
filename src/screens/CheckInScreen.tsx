/**
 * Caregiver Check-In — the engine's front door (Sitter Mode, free).
 *
 * Who it is for: the owner, or a sitter with no account of their own. Whoever
 * is holding the phone can read what today holds for each pet and record what
 * actually happened, one tap at a time, with their name and the moment on every
 * record.
 *
 * What is on the screen, in order:
 *  - **Who's checking in** — the caregiver's name, captured once ("Who's
 *    checking in?") and editable afterwards. With no pets to check on yet, the
 *    screen says so and points at the Pets tab instead of showing an empty log.
 *  - **Per pet**: today's task lines derived from that pet's real feeding and
 *    medication schedules plus its written care instructions ("Feeding 2× today
 *    · 06:30 · 18:00", "Carprofen · 1 tablet · 08:00 / 20:00"), then the five
 *    one-tap acts (Fed / Water refreshed / Medication given / Walk completed /
 *    Litter cleaned), then the neutral mood row (Normal / Tired / Sick / Ate
 *    normally / Bathroom normal), then today's own lines so the sitter can see
 *    what has been done.
 *
 * The tone rules this screen is built to keep (they are the product's promise):
 * every record is written to the same on-device store the Daily Care Ring reads,
 * so a tap here lights the matching ring tile on Home; an act nobody recorded
 * simply does not appear — there is no "missed", no score, no streak penalty
 * and no advice anywhere on this screen. A mood is an observation, never a
 * grade; it is stored as its own check-in kind so it can never be mistaken for
 * an act (and never unticked by a care tap on Home).
 *
 * 100% offline: AsyncStorage through the existing contexts. No account, no
 * premium gate, no network, no demo data.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { CCCard, CCButton, CCEmptyState, CCPill } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useCheckIns } from '../context/CheckInsContext';
import { useFeeding } from '../context/FeedingContext';
import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import {
  caregiverNameOrOwner,
  loadCaregiverName,
  saveCaregiverName,
} from '../storage/caregiverName';
import {
  CAREGIVER_THANKS,
  CARE_ACT_LABELS,
  CARE_CHECK_IN_EMOJI,
  PET_MOODS,
  PET_MOOD_EMOJI,
  PET_MOOD_LABELS,
  SITTER_ACT_TYPES,
} from '../types/checkIn';
import type { CareCheckInType, PetMood } from '../types/checkIn';
import type { Pet } from '../types';
import {
  actCountToday,
  latestMoodToday,
  petDayTasks,
  todayLogEntries,
} from '../utils/caregiverCheckIn';
import { todayISOInTimeZone } from '../utils/datetime';
import { petAccent } from '../utils/petAccent';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';

type Nav = NativeStackNavigationProp<SitterStackParamList>;

/** One pet's card: identity, today's tasks, the acts, the mood row, the log. */
interface PetCardProps {
  pet: Pet;
  caregiver: string | null;
  timeZone: string;
  todayKey: string;
  onRecord: (petId: string, type: CareCheckInType, mood?: PetMood) => void;
  onUndo: (id: string) => void;
  thanks?: string;
}

function PetCheckInCard({
  pet,
  caregiver,
  timeZone,
  todayKey,
  onRecord,
  onUndo,
  thanks,
}: PetCardProps): React.JSX.Element {
  const { checkIns } = useCheckIns();
  const { feedingSchedules } = useFeeding();
  const { medications } = useMedications();
  const { getForPet: getCareInstructions } = useCareInstructions();
  const accent = petAccent(pet.id);

  const tasks = useMemo(
    () =>
      petDayTasks(pet.id, {
        events: checkIns,
        feeding: feedingSchedules,
        medications,
        careInstructions: getCareInstructions(pet.id),
        todayKey,
        zone: timeZone,
      }),
    [pet.id, checkIns, feedingSchedules, medications, getCareInstructions, todayKey, timeZone],
  );

  const mood = useMemo(
    () => latestMoodToday(checkIns, pet.id, todayKey, timeZone),
    [checkIns, pet.id, todayKey, timeZone],
  );

  const lines = useMemo(
    () => todayLogEntries(checkIns, pet.id, todayKey, timeZone),
    [checkIns, pet.id, todayKey, timeZone],
  );

  return (
    <CCCard glowTint={accent.fill} testID={`checkin-pet-${pet.id}`}>
      <View style={styles.head}>
        <View style={[styles.avatarRing, { borderColor: accent.fill }]}>
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
          <Text style={styles.petName}>{pet.name}</Text>
          <Text style={styles.petSub}>
            {lines.length === 0
              ? 'Nothing recorded yet today.'
              : `${lines.length} ${lines.length === 1 ? 'entry' : 'entries'} today`}
          </Text>
        </View>
        {mood ? (
          <CCPill
            label={`${PET_MOOD_EMOJI[mood.mood]} ${PET_MOOD_LABELS[mood.mood]}`}
            tone="lavender"
          />
        ) : null}
      </View>

      {/* ---- today, from this pet's own schedules + care notes ---- */}
      <Text style={[styles.sectionLabel, { color: accent.ink }]}>Today’s tasks</Text>
      {tasks.length === 0 ? (
        <Text style={styles.quiet}>
          No meals or medications are scheduled for {pet.name} today — the taps below record
          whatever happens.
        </Text>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.taskRow} testID={`checkin-task-${task.id}`}>
            <Text style={styles.taskEmoji}>{task.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskDetail}>{task.detail}</Text>
            </View>
            {task.status ? (
              <CCPill label={task.status} tone="leaf" style={styles.taskPill} />
            ) : null}
          </View>
        ))
      )}

      {/* ---- the five one-tap acts ---- */}
      <Text style={[styles.sectionLabel, { color: accent.ink }]}>Record an act</Text>
      <View style={styles.chips}>
        {SITTER_ACT_TYPES.map((type) => {
          const count = actCountToday(checkIns, pet.id, type, todayKey, timeZone);
          const done = count > 0;
          return (
            <Pressable
              key={type}
              onPress={() => onRecord(pet.id, type)}
              accessibilityRole="button"
              accessibilityLabel={`${CARE_ACT_LABELS[type]} for ${pet.name}`}
              testID={`checkin-act-${pet.id}-${type}`}
              style={({ pressed }) => [
                styles.chip,
                done && { backgroundColor: accent.soft, borderColor: accent.fill },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipText}>
                {CARE_CHECK_IN_EMOJI[type]} {CARE_ACT_LABELS[type]}
              </Text>
              {done ? (
                <Text style={[styles.chipCount, { color: accent.ink }]}>
                  {count} today
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.quietSmall}>
        Tap an act every time it happens — one entry each, with your name and the time.
      </Text>

      {/* ---- the mood row: a neutral reading, never a score ---- */}
      <Text style={[styles.sectionLabel, { color: accent.ink }]}>How is {pet.name} doing?</Text>
      <View style={styles.chips}>
        {PET_MOODS.map((option) => {
          const selected = mood?.mood === option;
          return (
            <Pressable
              key={option}
              onPress={() => onRecord(pet.id, 'mood', option)}
              accessibilityRole="button"
              accessibilityLabel={`Mood ${PET_MOOD_LABELS[option]} for ${pet.name}`}
              testID={`checkin-mood-${pet.id}-${option}`}
              style={({ pressed }) => [
                styles.moodChip,
                selected && { backgroundColor: accent.soft, borderColor: accent.fill },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipText}>
                {PET_MOOD_EMOJI[option]} {PET_MOOD_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {mood ? (
        <Text style={styles.quietSmall}>
          Latest note: {PET_MOOD_LABELS[mood.mood]}
          {mood.byName ? `, from ${mood.byName}` : ''} — it stays a plain observation.
        </Text>
      ) : (
        <Text style={styles.quietSmall}>
          Optional, and only if you want to note it — nothing here is scored.
        </Text>
      )}

      {thanks ? (
        <View style={[styles.thanks, { backgroundColor: accent.soft }]} testID={`checkin-thanks-${pet.id}`}>
          <Text style={[styles.thanksText, { color: accent.ink }]}>🐾 {thanks}</Text>
        </View>
      ) : null}

      {/* ---- what has been done today, so the sitter can see it ---- */}
      <Text style={[styles.sectionLabel, { color: accent.ink }]}>Today for {pet.name}</Text>
      {lines.length === 0 ? (
        <Text style={styles.quiet}>
          Nothing recorded yet — every tap shows up here, and on {pet.name}’s care log.
        </Text>
      ) : (
        lines.map((line) => (
          <View key={line.id} style={styles.logRow} testID={`checkin-line-${line.id}`}>
            <Text style={styles.logText}>{line.text}</Text>
            <Pressable
              onPress={() => onUndo(line.id)}
              accessibilityRole="button"
              accessibilityLabel={`Undo ${line.text}`}
              testID={`checkin-undo-${line.id}`}
            >
              <Text style={styles.link}>Undo</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={styles.quietSmall}>
        {caregiver
          ? `Signed ${caregiver} — the owner sees the same lines.`
          : 'Add your name above and every line below carries it.'}
      </Text>
    </CCCard>
  );
}

export default function CheckInScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const rootNavigation = useTabRootNavigation();
  const { pets } = usePets();
  const { addCheckIn, removeCheckIn } = useCheckIns();
  const { username, timeZone, loaded: accountLoaded } = useAccount();

  const [caregiver, setCaregiver] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  /** Resolve the stored name once, as soon as the owner's own name has loaded. */
  const resolved = useRef(false);
  const [thanks, setThanks] = useState<Record<string, string>>({});
  const thanksIndex = useRef(0);

  useEffect(() => {
    if (!accountLoaded || resolved.current) return;
    resolved.current = true;
    let cancelled = false;
    loadCaregiverName()
      .then((stored) => {
        if (cancelled) return;
        const name = caregiverNameOrOwner(stored, username);
        setCaregiver(name);
        setNameDraft(name ?? '');
        // Nobody named yet: open the prompt so the first record is signed.
        setEditingName(name === null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [accountLoaded, username]);

  const todayKey = useMemo(() => todayISOInTimeZone(new Date(), timeZone), [timeZone]);

  const handleSaveName = useCallback(async () => {
    const saved = await saveCaregiverName(nameDraft);
    setCaregiver(saved);
    setEditingName(false);
  }, [nameDraft]);

  const handleRecord = useCallback(
    async (petId: string, type: CareCheckInType, mood?: PetMood) => {
      await addCheckIn({
        petId,
        type,
        at: new Date().toISOString(),
        source: 'sitter',
        ...(caregiver ? { byName: caregiver } : {}),
        ...(mood ? { mood } : {}),
      });
      const line = CAREGIVER_THANKS[thanksIndex.current % CAREGIVER_THANKS.length];
      thanksIndex.current += 1;
      setThanks((prev) => ({ ...prev, [petId]: line }));
    },
    [addCheckIn, caregiver],
  );

  const handleUndo = useCallback(
    async (id: string) => {
      await removeCheckIn(id);
    },
    [removeCheckIn],
  );

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Sitter Mode"
        >
          <Text style={BS.link}>‹ Sitter Mode</Text>
        </Pressable>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Care & handoff</Text>
        <Text style={BS.h1}>Caregiver check-in</Text>
        <Text style={BS.body}>
          One tap records what happened, with who did it and when. Free, no account — for you or
          whoever is looking after the pets. Nothing is scored, and an act nobody tapped simply
          isn’t recorded yet.
        </Text>

        {/* ---- who is checking in ---- */}
        <CCCard testID="checkin-identity" style={{ marginTop: SPACE.s3 }}>
          {caregiver && !editingName ? (
            <>
              <View style={styles.identityRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>Checking in as</Text>
                  <Text style={styles.identityName} testID="checkin-caregiver-name">
                    {caregiver}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setNameDraft(caregiver);
                    setEditingName(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Change the caregiver name"
                  testID="checkin-name-change"
                >
                  <Text style={styles.link}>Change</Text>
                </Pressable>
              </View>
              <Text style={styles.quietSmall}>
                This name is written on every record below, and on the owner’s care log.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.sectionLabel}>Who’s checking in?</Text>
              <Text style={styles.quiet}>
                Your name signs every record, so the owner knows who did what while they were
                away.
              </Text>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="e.g. Sarah"
                placeholderTextColor={COLOR.textFaint}
                style={[BS.input, { marginTop: SPACE.s2 }]}
                accessibilityLabel="Caregiver name"
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                testID="checkin-name-input"
              />
              <View style={{ height: SPACE.s2 }} />
              <CCButton
                label="Save name"
                emoji="💾"
                onPress={handleSaveName}
                testID="checkin-name-save"
              />
              <Text style={styles.quietSmall}>
                Kept on this device only, and cleared by “delete everything”.
              </Text>
            </>
          )}
        </CCCard>

        {/* ---- the pets ---- */}
        {pets.length === 0 ? (
          <CCEmptyState
            emoji="🐾"
            title="Add a pet first"
            message="Check-ins belong to a pet — add yours and come straight back here."
            actionLabel="Go to Pets"
            onAction={() => rootNavigation.navigate('Pets', { screen: 'PetList' })}
            testID="checkin-no-pets"
          />
        ) : (
          pets.map((pet) => (
            <PetCheckInCard
              key={pet.id}
              pet={pet}
              caregiver={caregiver}
              timeZone={timeZone}
              todayKey={todayKey}
              onRecord={handleRecord}
              onUndo={handleUndo}
              thanks={thanks[pet.id]}
            />
          ))
        )}

        <View style={[styles.footerLinks, { marginTop: SPACE.s4 }]}>
          <Pressable
            onPress={() => navigation.navigate('CareLog', {})}
            accessibilityRole="button"
            accessibilityLabel="Open the care log"
            testID="checkin-care-log-link"
          >
            <Text style={BS.link}>Care log ›</Text>
          </Pressable>
        </View>
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          The same records appear on Home’s Daily Care Ring and on each pet’s care log. Everything
          stays on this device.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 24, lineHeight: 30 },
  petName: { fontFamily: FONT_HEAD, fontSize: 19, fontWeight: '700', color: COLOR.text },
  petSub: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted, marginTop: 1 },

  identityRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  identityName: { fontFamily: FONT_HEAD, fontSize: 20, fontWeight: '700', color: COLOR.text },

  sectionLabel: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLOR.accent,
    marginTop: SPACE.s3,
  },

  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s2,
    paddingVertical: SPACE.s1,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  taskEmoji: { fontSize: 20, lineHeight: 26 },
  taskTitle: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600', color: COLOR.text },
  taskDetail: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted, marginTop: 1 },
  taskPill: { marginLeft: SPACE.s1 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s1 },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
    paddingHorizontal: SPACE.s3,
    paddingVertical: 9,
  },
  moodChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
    paddingHorizontal: SPACE.s3,
    paddingVertical: 8,
  },
  chipText: { fontFamily: FONT_BODY, fontSize: 13.5, color: COLOR.text, fontWeight: '600' },
  chipCount: { fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  pressed: { opacity: 0.85 },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  logText: { flex: 1, fontFamily: FONT_BODY, fontSize: 14.5, color: COLOR.text },
  link: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.accent },

  quiet: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.textMuted,
    marginTop: SPACE.s1,
  },
  quietSmall: {
    fontFamily: FONT_BODY,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLOR.textFaint,
    marginTop: SPACE.s2,
  },
  thanks: {
    borderRadius: RADIUS.button,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    marginTop: SPACE.s2,
  },
  thanksText: { fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: '600' },
  footerLinks: { flexDirection: 'row', gap: SPACE.s4 },
});
