/**
 * Pet Crew carousel — the first thing the Command Center shows (design Phase B1).
 *
 * A horizontal row of cards, one per pet: their uploaded photo (or the
 * species-accurate emoji stand-in from utils/petDisplay), their name, their age
 * and an honest status line. Each pet carries its own accent colour (see
 * utils/petAccent) which paints the card's hero gradient, the avatar's ring and
 * the status pill — so the crew never looks monotone, and one pet is
 * recognisable across the dashboard at a glance.
 *
 * Swiping settles on a card and tells the screen which pet is selected; the
 * dashboard's own accent band tints toward that pet (Home crossfades it, not
 * this component). Tapping a card opens that pet's page — the caller keeps the
 * existing navigation and active-pet behaviour.
 *
 * A trailing dashed "Add my pet" tile keeps the next action one tap away once
 * the crew exists.
 *
 * Colours come from `../theme` / utils/petAccent; nothing here is hard-coded.
 */
import React, { useCallback } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CCCard, CCPill } from './CC';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import { petEmojiFor, petSpeciesLabel } from '../utils/petDisplay';
import { hexWithAlpha } from '../utils/petAccent';
import type { PetAccent } from '../utils/petAccent';
import type { Pet } from '../types';

/** One pet, ready to draw: the pet plus what Home already worked out for it. */
export interface PetCrewEntry {
  pet: Pet;
  /** The pet's own accent colour (utils/petAccent — deterministic per id). */
  accent: PetAccent;
  /** Short age phrase, e.g. "3 yr 4 mo" — empty when the pet has no birthdate. */
  age: string;
  /** The status pill: a fact from the pet's records, or their own vibe. */
  status: { label: string };
  /**
   * Consecutive days this pet has a recorded check-in (design Phase C). Shown
   * only from two days up, so a card never brags about a single day.
   */
  streak?: number;
}

export interface PetCrewCarouselProps {
  entries: PetCrewEntry[];
  /** The pet the dashboard's care ring and accent band are currently on. */
  selectedPetId: string | null;
  /** A swipe settled on a new pet — shift the dashboard's accent to it. */
  onSelectPet: (petId: string) => void;
  /** A card was tapped — open that pet's page. */
  onOpenPet: (petId: string) => void;
  /** The trailing dashed tile: add another pet. */
  onAddPet: () => void;
}

/** One pet card: hero gradient, ringed avatar, name, age and status. */
function PetCard({
  entry,
  selected,
  width,
  onOpen,
}: {
  entry: PetCrewEntry;
  selected: boolean;
  width: number;
  onOpen: () => void;
}): React.JSX.Element {
  const { pet, accent, age, status, streak = 0 } = entry;
  const meta = [age, petSpeciesLabel(pet)].filter(Boolean).join(' · ');

  return (
    <CCCard
      onPress={onOpen}
      accent={accent.fill}
      glowTint={selected ? accent.fill : undefined}
      radius={RADIUS.cardLg}
      padding={0}
      accessibilityLabel={`${pet.name}, ${petSpeciesLabel(pet)}${age ? `, ${age}` : ''} — ${status.label}. Open ${pet.name}'s page.`}
      style={[
        styles.card,
        { width },
        selected ? { borderWidth: 2, borderColor: accent.fill } : null,
      ]}
    >
      {/* Hero: the pet's own colour, with the avatar sitting on top of it. */}
      <LinearGradient
        colors={[accent.fill, hexWithAlpha(accent.fill, 0.5)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={[styles.avatarRing, { borderColor: COLOR.white }]}>
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
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {pet.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta || 'No details yet'}
        </Text>
        <CCPill
          label={status.label}
          style={{ backgroundColor: accent.soft }}
          textStyle={{ color: accent.ink }}
        />
        {streak >= 2 ? (
          <Text style={[styles.streak, { color: accent.ink }]}>
            🔥 {streak}-day care streak
          </Text>
        ) : null}
      </View>
    </CCCard>
  );
}

/** The crew row: pet cards with a trailing "add" tile. */
export default function PetCrewCarousel({
  entries,
  selectedPetId,
  onSelectPet,
  onOpenPet,
  onAddPet,
}: PetCrewCarouselProps): React.JSX.Element {
  const { width } = useWindowDimensions();
  /** Card width for a phone: wide enough to feel like a hero, never full-bleed. */
  const cardWidth = Math.min(272, Math.round(width * 0.72));
  const gap = SPACE.s3;
  const snap = cardWidth + gap;

  const handleSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (entries.length === 0) return;
      const index = Math.max(
        0,
        Math.min(entries.length - 1, Math.round(event.nativeEvent.contentOffset.x / snap)),
      );
      const entry = entries[index];
      if (entry && entry.pet.id !== selectedPetId) onSelectPet(entry.pet.id);
    },
    [entries, onSelectPet, selectedPetId, snap],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snap}
      snapToAlignment="start"
      onMomentumScrollEnd={handleSettle}
      // Full-bleed: the row runs to both screen edges while the card padding stays put.
      style={styles.row}
      contentContainerStyle={styles.rowContent}
    >
      {entries.map((entry) => (
        <PetCard
          key={entry.pet.id}
          entry={entry}
          selected={entry.pet.id === selectedPetId}
          width={cardWidth}
          onOpen={() => onOpenPet(entry.pet.id)}
        />
      ))}
      <Pressable
        onPress={onAddPet}
        accessibilityRole="button"
        accessibilityLabel="Add my pet"
        style={({ pressed }) => [
          styles.addCard,
          { width: Math.round(cardWidth * 0.62) },
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.addPlus}>＋</Text>
        <Text style={styles.addLabel}>Add my pet</Text>
        <Text style={styles.addHint}>Grow the crew</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { marginHorizontal: -SPACE.s4 },
  rowContent: { paddingHorizontal: SPACE.s4, gap: SPACE.s3, paddingVertical: 2 },
  card: { overflow: 'hidden' },
  hero: { height: 92, alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.pill,
    borderWidth: 3,
    backgroundColor: COLOR.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 36, lineHeight: 44 },
  body: { padding: SPACE.s3, gap: 5 },
  name: { fontFamily: FONT_HEAD, fontSize: 19, fontWeight: '700', color: COLOR.text },
  meta: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted },
  streak: { fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  addCard: {
    minHeight: 196,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    borderRadius: RADIUS.cardLg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.s1,
    padding: SPACE.s3,
  },
  addPlus: { fontSize: 28, color: COLOR.accent },
  addLabel: { fontFamily: FONT_HEAD, fontSize: 15, fontWeight: '700', color: COLOR.text },
  addHint: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted },
  pressed: { opacity: 0.92 },
});
