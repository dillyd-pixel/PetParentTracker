/**
 * Daily Care Ring — the five one-tap checkoffs of the Command Center (Phase B1).
 *
 * One card, one pet, five acts: Food 🍽️, Water 💧, Medication 💊, Exercise 🐾,
 * Care 🩺. A tap records a real check-in event on the device (see
 * types/checkIn + context/CheckInsContext), so the ring's state survives a
 * restart and is a fact rather than decoration. A tap also pops a paw print over
 * the tile and the screen shows one playful, encouraging line.
 *
 * The tone rule this component is built to keep: an *unticked* tile is neutral
 * ("not yet"), never red, never scored, never scolded — no negative copy exists
 * in this file. Ticking is entirely optional and always forgiving: a second tap
 * simply unticks the day's record.
 *
 * The optional `hints` come from the pet's own feeding/medication schedules
 * ("due 08:00") and are shown as information only — completion is driven by
 * check-in events alone, never inferred from a schedule.
 *
 * Colours come from `../theme` and the pet's accent; nothing is hard-coded here.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CCCard, CCPill } from './CC';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import { petEmojiFor } from '../utils/petDisplay';
import { hexWithAlpha } from '../utils/petAccent';
import type { PetAccent } from '../utils/petAccent';
import {
  CARE_CHECK_IN_EMOJI,
  CARE_CHECK_IN_LABELS,
  CARE_CHECK_IN_TYPES,
} from '../types/checkIn';
import type { CareCheckInType } from '../types/checkIn';
import type { Pet } from '../types';

export interface DailyCareRingProps {
  /** The selected crew pet — the ring is always one pet's day. */
  pet: Pet;
  /** That pet's accent colour (utils/petAccent). */
  accent: PetAccent;
  /** The acts already recorded for this pet today (in the display zone). */
  doneTypes: CareCheckInType[];
  /** A tile was tapped: the caller records (or removes) the check-in. */
  onToggle: (type: CareCheckInType) => void;
  /** Optional "due 08:00" note per act, straight from the pet's schedules. */
  hints?: Partial<Record<CareCheckInType, string>>;
  /** The playful line the last checkoff earned; null when there is none yet. */
  message?: string | null;
}

/** How long the paw print stays on a tile after a checkoff. */
const PAW_POP_MS = 700;

/** One act: a round tile, its label, and an optional schedule hint. */
function CareTile({
  type,
  done,
  accent,
  hint,
  onPress,
}: {
  type: CareCheckInType;
  done: boolean;
  accent: PetAccent;
  hint?: string;
  onPress: () => void;
}): React.JSX.Element {
  /** 0 → 1 while the paw print plays. */
  const paw = useRef(new Animated.Value(0)).current;
  /** The tile's own pop, separate so the two never fight over one value. */
  const bump = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) {
      paw.setValue(0);
      Animated.timing(paw, {
        toValue: 1,
        duration: PAW_POP_MS,
        useNativeDriver: true,
      }).start();
      bump.setValue(1);
      Animated.sequence([
        Animated.spring(bump, { toValue: 1.12, speed: 26, bounciness: 12, useNativeDriver: true }),
        Animated.spring(bump, { toValue: 1, speed: 16, bounciness: 6, useNativeDriver: true }),
      ]).start();
    }
    if (!done && wasDone.current) paw.setValue(0);
    wasDone.current = done;
  }, [done, paw, bump]);

  const label = CARE_CHECK_IN_LABELS[type];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${label} — ${done ? 'recorded for today' : 'not yet today'}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.tileCircleWrap, { transform: [{ scale: bump }] }]}>
        <View
          style={[
            styles.tileCircle,
            done
              ? { backgroundColor: accent.fill, borderColor: accent.fill }
              : {
                  backgroundColor: COLOR.surface,
                  borderColor: hexWithAlpha(accent.fill, 0.38),
                },
          ]}
        >
          <Text style={styles.tileEmoji}>{CARE_CHECK_IN_EMOJI[type]}</Text>
        </View>
        {/* The celebratory paw print — only ever on a checkoff, never a scold. */}
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.paw,
            {
              opacity: paw.interpolate({
                inputRange: [0, 0.15, 0.7, 1],
                outputRange: [0, 0.95, 0.55, 0],
              }),
              transform: [
                {
                  scale: paw.interpolate({
                    inputRange: [0, 0.35, 1],
                    outputRange: [0.4, 1.2, 1.6],
                  }),
                },
              ],
            },
          ]}
        >
          🐾
        </Animated.Text>
      </Animated.View>
      <Text style={[styles.tileLabel, done && styles.tileLabelDone]}>{label}</Text>
      {hint ? (
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** The ring card for one pet. */
export default function DailyCareRing({
  pet,
  accent,
  doneTypes,
  onToggle,
  hints,
  message,
}: DailyCareRingProps): React.JSX.Element {
  const doneCount = CARE_CHECK_IN_TYPES.filter((type) => doneTypes.includes(type)).length;
  const allDone = doneCount === CARE_CHECK_IN_TYPES.length;

  return (
    <CCCard glowTint={accent.fill}>
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
        <View style={styles.headText}>
          <Text style={styles.title}>Daily Care Ring</Text>
          <Text style={styles.subtitle}>
            {allDone ? `${pet.name}'s day is complete 🎉` : `One tap each for ${pet.name} — no pressure.`}
          </Text>
        </View>
        <CCPill
          label={`${doneCount} of ${CARE_CHECK_IN_TYPES.length}`}
          tone={allDone ? 'leaf' : 'neutral'}
        />
      </View>

      <View style={styles.tiles}>
        {CARE_CHECK_IN_TYPES.map((type) => (
          <CareTile
            key={type}
            type={type}
            done={doneTypes.includes(type)}
            accent={accent}
            hint={hints?.[type]}
            onPress={() => onToggle(type)}
          />
        ))}
      </View>

      {message ? (
        <View style={[styles.message, { backgroundColor: accent.soft }]}>
          <Text style={[styles.messageText, { color: accent.ink }]}>🐾 {message}</Text>
        </View>
      ) : (
        <Text style={styles.prompt}>
          {doneCount === 0
            ? 'Nothing recorded yet today — whenever it happens, one tap keeps it.'
            : 'Tap any tile again to undo it. Whatever is left simply isn’t done yet.'}
        </Text>
      )}
    </CCCard>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 22, lineHeight: 28 },
  headText: { flex: 1 },
  title: { fontFamily: FONT_HEAD, fontSize: 17, fontWeight: '700', color: COLOR.text },
  subtitle: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted, marginTop: 1 },

  tiles: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACE.s1,
    marginTop: SPACE.s1,
  },
  tile: { flex: 1, alignItems: 'center', gap: 4 },
  tileCircleWrap: { alignItems: 'center', justifyContent: 'center' },
  tileCircle: {
    width: 54,
    height: 54,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileEmoji: { fontSize: 24, lineHeight: 30 },
  paw: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    textAlign: 'center',
    fontSize: 26,
    lineHeight: 42,
  },
  tileLabel: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted },
  tileLabelDone: { color: COLOR.text, fontWeight: '700' },
  tileHint: { fontFamily: FONT_BODY, fontSize: 10, color: COLOR.textFaint },
  pressed: { opacity: 0.9 },

  message: {
    borderRadius: RADIUS.button,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    marginTop: SPACE.s1,
  },
  messageText: { fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: '600' },
  prompt: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLOR.textMuted,
    marginTop: SPACE.s1,
  },
});
