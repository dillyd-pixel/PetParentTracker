/**
 * Quick Add — the sheet behind the raised "+" button (design Phase C).
 *
 * All nine actions are real here, and every one of them is a tap or two from
 * the pet the sheet is pointed at:
 *
 *  1. **Food** and **Walk** are genuinely one tap: they write a care check-in
 *     (the same `CareCheckInEvent` the Daily Care Ring writes), so the ring on
 *     Home fills in and the pet's day is recorded. The sheet pops a paw print
 *     and a playful line, in place.
 *  2. **Medication**, **Weight**, **Expense**, **Appointment**, **Note**,
 *     **Photo** and **Document** deep-link straight into the app's own editor
 *     for that thing, pre-set to the chosen pet. Nothing is duplicated here:
 *     the editors already own validation, reminders and storage.
 *
 * The pet defaults to the active one from the Home carousel (so the common case
 * is two taps) and can be switched with the chips at the top.
 *
 * 100% offline: AsyncStorage-backed contexts + in-app navigation only — no
 * network, no analytics, no new dependency.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CCButton, CCEmptyState, CCGradientCard, CCPill, ccOnGradient } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useCheckIns } from '../context/CheckInsContext';
import { usePets } from '../context/PetContext';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import { CARE_ENCOURAGEMENTS } from '../types/checkIn';
import { petEmojiFor } from '../utils/petDisplay';
import { petAccent } from '../utils/petAccent';
import { todayISOInTimeZone } from '../utils/datetime';
import type { CareCheckInType } from '../types/checkIn';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickAdd'>;

/** How long the paw print pops over the sheet after a one-tap log. */
const PAW_POP_MS = 800;

/** One sheet action: instant check-ins, or a hop into a real editor. */
interface QuickAction {
  id: string;
  emoji: string;
  label: string;
  /** The tile's colour (a `COLOR` token). */
  tint: string;
  /** The quiet line under the label — what a tap actually does. */
  hint: string;
  /** Instant actions are one tap and write a check-in right here. */
  instant?: CareCheckInType;
}

/** The nine actions of the owner's design, in the design's own order. */
const ACTIONS: QuickAction[] = [
  { id: 'medication', emoji: '💊', label: 'Medication', tint: COLOR.coral, hint: 'New med, pre-filled' },
  { id: 'appointment', emoji: '📅', label: 'Appointment', tint: COLOR.blue, hint: 'Book a date' },
  { id: 'weight', emoji: '⚖️', label: 'Weight', tint: COLOR.aqua, hint: 'Today’s weigh-in' },
  { id: 'expense', emoji: '💸', label: 'Expense', tint: COLOR.tangerine, hint: 'Log a cost' },
  { id: 'food', emoji: '🍽️', label: 'Food', tint: COLOR.sunshine, hint: 'One tap', instant: 'food' },
  { id: 'walk', emoji: '🐾', label: 'Walk', tint: COLOR.leaf, hint: 'One tap', instant: 'exercise' },
  { id: 'note', emoji: '📝', label: 'Note', tint: COLOR.lavender, hint: 'Write it down' },
  { id: 'photo', emoji: '📷', label: 'Photo', tint: COLOR.blue, hint: 'Add a picture' },
  { id: 'document', emoji: '📄', label: 'Document', tint: COLOR.premiumDeep, hint: 'File the paperwork' },
];

export default function QuickAddSheetScreen({ navigation }: Props): React.JSX.Element {
  const { pets, activePet, selectPet } = usePets();
  const { addCheckIn, doneTypesFor } = useCheckIns();
  const { timeZone } = useAccount();

  /** The pet every action is about: the active one, or the first on file. */
  const [petId, setPetId] = useState<string | null>(activePet?.id ?? pets[0]?.id ?? null);
  /** The playful line the last one-tap log earned. */
  const [message, setMessage] = useState<string | null>(null);
  const messageIndex = useRef(0);
  /** 0 → 1 while the paw print plays over the sheet. */
  const paw = useRef(new Animated.Value(0)).current;

  // Keep the sheet's pet in step with the app's, and pick one if it has none.
  useEffect(() => {
    if (activePet && activePet.id !== petId) setPetId(activePet.id);
    else if (!petId && pets[0]) setPetId(pets[0].id);
  }, [activePet, pets, petId]);

  const pet = useMemo(() => pets.find((item) => item.id === petId) ?? null, [pets, petId]);
  const accent = pet ? petAccent(pet.id) : undefined;
  const todayKey = todayISOInTimeZone(new Date(), timeZone);
  const doneToday = pet ? doneTypesFor(pet.id, todayKey, timeZone) : [];

  /** Choose the pet this sheet is about — and make it the app's active pet. */
  const pickPet = useCallback(
    async (id: string) => {
      setPetId(id);
      if (activePet?.id !== id) {
        try {
          await selectPet(id);
        } catch {
          // Best effort — the sheet still acts on the chosen pet.
        }
      }
    },
    [activePet, selectPet],
  );

  /** One tap: record a care act for the chosen pet, right here. */
  const logInstant = useCallback(
    async (type: CareCheckInType) => {
      if (!pet) return;
      await addCheckIn({
        petId: pet.id,
        type,
        at: new Date().toISOString(),
        source: 'owner',
      });
      const line = CARE_ENCOURAGEMENTS[messageIndex.current % CARE_ENCOURAGEMENTS.length];
      messageIndex.current += 1;
      setMessage(line);
      paw.setValue(0);
      Animated.timing(paw, {
        toValue: 1,
        duration: PAW_POP_MS,
        useNativeDriver: true,
      }).start();
    },
    [addCheckIn, paw, pet],
  );

  /**
   * Leave the sheet and open the app's own editor for a thing. The chosen pet
   * becomes the active one first, so the editor opens about the right animal
   * (each module screen reads the active pet), and navigating to the tab root
   * dismisses this modal on the way.
   */
  const openInApp = useCallback(
    async (
      target:
        | { to: 'pets'; screen: 'Meds' | 'Expenses' | 'Feeding' }
        | { to: 'vet'; kind: 'visit' | 'appointment' | 'document' }
        | { to: 'journal'; focus: 'note' | 'photo' }
        | { to: 'petForm' },
    ) => {
      if (pet) await pickPet(pet.id);
      // A fresh nonce per tap: the editor screen is already on its stack, so
      // the changing number is what re-opens its form.
      const openNew = Date.now();
      switch (target.to) {
        case 'pets':
          navigation.navigate('Main', {
            screen: 'Pets',
            params: { screen: target.screen, params: { openNew } },
          });
          return;
        case 'vet':
          navigation.navigate('Main', {
            screen: 'Pets',
            params: { screen: 'VetRecords', params: { openNew, kind: target.kind } },
          });
          return;
        case 'journal':
          navigation.navigate('Main', {
            screen: 'Pets',
            params: { screen: 'Journal', params: { openNew, focus: target.focus } },
          });
          return;
        case 'petForm':
          navigation.navigate('PetForm', pet ? { petId: pet.id } : undefined);
          return;
      }
    },
    [navigation, pet, pickPet],
  );

  const runAction = useCallback(
    (action: QuickAction) => {
      if (action.instant) {
        logInstant(action.instant).catch(() => undefined);
        return;
      }
      switch (action.id) {
        case 'medication':
          openInApp({ to: 'pets', screen: 'Meds' });
          return;
        case 'expense':
          openInApp({ to: 'pets', screen: 'Expenses' });
          return;
        case 'appointment':
          openInApp({ to: 'vet', kind: 'appointment' });
          return;
        case 'document':
          openInApp({ to: 'vet', kind: 'document' });
          return;
        case 'note':
          openInApp({ to: 'journal', focus: 'note' });
          return;
        case 'photo':
          openInApp({ to: 'journal', focus: 'photo' });
          return;
        case 'weight':
          openInApp({ to: 'petForm' });
          return;
      }
    },
    [logInstant, openInApp],
  );

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

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* ---- colourful, premium header ---- */}
          <CCGradientCard gradient="achievements" radius={RADIUS.cardLg} padding={SPACE.s4}>
            <Text style={ccOnGradient.eyebrow}>Quick add</Text>
            <Text style={styles.heroTitle}>What happened?</Text>
            <Text style={ccOnGradient.body}>
              Food and Walk log themselves in one tap. Everything else opens the real editor,
              already pointed at your pet. All of it stays on this device.
            </Text>
          </CCGradientCard>

          {pets.length === 0 ? (
            <CCEmptyState
              emoji="🐾"
              title="Who runs your house?"
              message="Add a pet first and every quick action here has somewhere to land."
              actionLabel="+ Add My Pet"
              onAction={() => navigation.navigate('PetForm')}
              style={{ marginTop: SPACE.s4 }}
              testID="quick-add-empty"
            />
          ) : (
            <>
              {/* ---- who is this for? (defaults to the active pet) ---- */}
              <Text style={[styles.kicker, styles.forLabel]}>
                {pet ? `This is about ${pet.name}` : 'Whose day is it?'}
              </Text>
              {pets.length > 1 ? (
                <View style={styles.petRow}>
                  {pets.map((item) => {
                    const itemAccent = petAccent(item.id);
                    const selected = item.id === petId;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => pickPet(item.id).catch(() => undefined)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Quick add for ${item.name}`}
                        testID={`quick-add-pet-${item.id}`}
                        style={[
                          styles.petChip,
                          selected && { backgroundColor: itemAccent.soft, borderColor: itemAccent.fill },
                        ]}
                      >
                        <Text style={styles.petChipGlyph}>{petEmojiFor(item)}</Text>
                        <Text style={[styles.petChipText, selected && { color: itemAccent.ink }]}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {/* ---- the nine actions ---- */}
              <View style={styles.grid}>
                {ACTIONS.map((action) => {
                  const logged = action.instant ? doneToday.includes(action.instant) : false;
                  return (
                    <Pressable
                      key={action.id}
                      onPress={() => runAction(action)}
                      accessibilityRole="button"
                      accessibilityLabel={`${action.label} — ${action.hint}`}
                      testID={`quick-add-${action.id}`}
                      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                    >
                      <View style={[styles.actionChip, { backgroundColor: withAlpha(action.tint) }]}>
                        <Text style={styles.actionEmoji}>{action.emoji}</Text>
                      </View>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                      <Text style={styles.actionHint} numberOfLines={1}>
                        {action.hint}
                      </Text>
                      {logged ? (
                        <CCPill label="Logged ✓" tone="leaf" style={styles.actionPill} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* ---- a one-tap log answers here, with a paw print ---- */}
              {message && pet ? (
                <View style={[styles.logged, { borderColor: accent?.fill ?? COLOR.leaf }]}>
                  <Animated.Text
                    pointerEvents="none"
                    style={[
                      styles.paw,
                      {
                        opacity: paw.interpolate({
                          inputRange: [0, 0.15, 0.7, 1],
                          outputRange: [0, 0.9, 0.5, 0],
                        }),
                        transform: [
                          {
                            scale: paw.interpolate({
                              inputRange: [0, 0.35, 1],
                              outputRange: [0.4, 1.2, 1.7],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    🐾
                  </Animated.Text>
                  <Text style={[styles.loggedTitle, { color: accent?.ink ?? COLOR.text }]}>
                    ✓ Logged for {pet.name}
                  </Text>
                  <Text style={styles.loggedLine}>{message}</Text>
                  <Text style={styles.loggedNote}>
                    Written to {pet.name}’s day — the Care Ring on Home shows it too.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.footNote}>
                {pet
                  ? `Two taps or fewer for ${pet.name}. Add a photo and it threads through Home — the crew card, the health snapshot and their story.`
                  : 'Pick a pet above to begin.'}
              </Text>
            </>
          )}

          <CCButton
            label="Add a pet instead"
            emoji="🐾"
            variant="secondary"
            onPress={() => navigation.navigate('PetForm')}
            style={styles.addPet}
          />
          <CCButton
            label="Close"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={styles.close}
            testID="quick-add-close"
          />
        </ScrollView>
      </View>
    </View>
  );
}

/** A 16%-alpha fill from a `COLOR` token, for the action chips. */
function withAlpha(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},0.16)`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLOR.scrim },
  sheet: {
    backgroundColor: COLOR.bg,
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingHorizontal: SPACE.s4,
    paddingTop: SPACE.s2,
    maxHeight: '92%',
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.divider,
    marginBottom: SPACE.s3,
  },
  scrollBody: { paddingBottom: SPACE.s6 },
  heroTitle: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 26,
    color: COLOR.white,
    marginBottom: 2,
  },
  forLabel: { marginTop: SPACE.s4 },
  petRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2 },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s1,
    paddingVertical: 6,
    paddingHorizontal: SPACE.s3,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
  },
  petChipGlyph: { fontSize: 15 },
  petChipText: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.text },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.s3,
    marginTop: SPACE.s3,
  },
  action: { alignItems: 'center', width: 92, gap: 3 },
  actionChip: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.cardSm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLOR.divider,
  },
  actionEmoji: { fontSize: 26 },
  actionLabel: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.text },
  actionHint: { fontFamily: FONT_BODY, fontSize: 10.5, color: COLOR.textMuted },
  actionPill: { paddingVertical: 2, paddingHorizontal: 8 },

  logged: {
    marginTop: SPACE.s4,
    borderWidth: 1.5,
    borderRadius: RADIUS.card,
    backgroundColor: COLOR.surface,
    padding: SPACE.s4,
    gap: 2,
    overflow: 'hidden',
  },
  paw: {
    position: 'absolute',
    top: 0,
    right: SPACE.s3,
    fontSize: 34,
  },
  loggedTitle: { fontFamily: FONT_HEAD, fontSize: 16, fontWeight: '700' },
  loggedLine: { fontFamily: FONT_BODY, fontSize: 14, fontWeight: '600', color: COLOR.text },
  loggedNote: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.textMuted, marginTop: 2 },

  kicker: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLOR.accent,
  },
  footNote: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: COLOR.textMuted,
    marginTop: SPACE.s4,
  },
  addPet: { marginTop: SPACE.s4 },
  close: { marginTop: SPACE.s2 },
  pressed: { opacity: 0.9 },
});
