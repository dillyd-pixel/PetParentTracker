/**
 * Home's celebration and award sections (design Phase C: gentle gamification).
 *
 * Two cards, both built to the same rule the rest of the app keeps — they only
 * ever say things that actually happened:
 *
 *  - `CelebrationsCard` — today's birthdays and gotcha days for the household,
 *    plus any badge or milestone *earned today*. It is the "moment" card: a
 *    gradient surface, a photo (or the pet's own species glyph), and playful
 *    copy. It renders nothing at all when there is nothing to celebrate.
 *  - `AwardsCard` — one pet's shelf: the badges and milestones its real records
 *    have earned, newest first, with the date each landed. No points, no level,
 *    no score, and no empty-shelf nagging — an empty shelf is just a young shelf.
 *
 * Photo threading: every row here shows the pet's uploaded photo when there is
 * one, and the species-accurate emoji avatar from `utils/petDisplay` when there
 * is not — the house style everywhere a pet is pictured.
 *
 * 100% offline: presentation only — no storage, no network, no new dependency.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CCCard, CCEmptyState, CCPill } from './CC';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import { hexWithAlpha } from '../utils/petAccent';
import type { PetAccent } from '../utils/petAccent';
import { shortDate } from '../utils/petDisplay';

/** One celebration row: a birthday, a gotcha day, or a freshly earned award. */
export interface CelebrationEntry {
  id: string;
  petId: string;
  petName: string;
  /** The big idea of the moment, e.g. "🎂 Nova's birthday". */
  title: string;
  /** The playful line under it. */
  message: string;
  /** A tag like "Birthday" / "Gotcha day" / "New badge". */
  tag: string;
  /** The pet's uploaded photo, when they have one. */
  photoUri?: string;
  /** The species-accurate stand-in when there is no photo. */
  glyph: string;
  /** The pet's own accent colour. */
  accent: PetAccent;
}

export interface CelebrationsCardProps {
  entries: CelebrationEntry[];
  /** Tapping a row opens that pet's page. */
  onOpenPet?: (petId: string) => void;
}

/** Today's moments: birthdays, gotcha days and awards earned today. */
export function CelebrationsCard({
  entries,
  onOpenPet,
}: CelebrationsCardProps): React.JSX.Element | null {
  if (entries.length === 0) return null;

  return (
    <View style={styles.celebrationWrap}>
      {entries.map((entry) => (
        <Pressable
          key={entry.id}
          onPress={onOpenPet ? () => onOpenPet(entry.petId) : undefined}
          accessibilityRole={onOpenPet ? 'button' : undefined}
          accessibilityLabel={`${entry.title} — ${entry.message}`}
          testID={`home-celebration-${entry.id}`}
          style={({ pressed }) => [
            styles.celebration,
            { backgroundColor: hexWithAlpha(entry.accent.fill, 0.10), borderColor: entry.accent.fill },
            pressed && onOpenPet ? styles.pressed : null,
          ]}
        >
          <View style={[styles.celebrationAvatar, { borderColor: entry.accent.fill }]}>
            {entry.photoUri ? (
              <Image
                source={{ uri: entry.photoUri }}
                style={styles.avatarPhoto}
                resizeMode="cover"
                accessibilityLabel={`${entry.petName}'s photo`}
              />
            ) : (
              <Text style={styles.avatarGlyph}>{entry.glyph}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.celebrationTag, { color: entry.accent.ink }]}>
              {entry.tag} · {entry.petName}
            </Text>
            <Text style={styles.celebrationTitle}>{entry.title}</Text>
            <Text style={styles.celebrationMessage}>{entry.message}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** One line on a pet's award shelf. */
export interface ShelfItem {
  id: string;
  emoji: string;
  title: string;
  blurb: string;
  /** ISO timestamp the award was earned (absent for a not-yet-earned one). */
  earnedAt?: string;
}

export interface AwardsCardProps {
  /** The pet whose shelf this is. */
  petName: string;
  /** Their uploaded photo, when they have one (threaded into the header). */
  photoUri?: string;
  /** The species-accurate stand-in. */
  glyph: string;
  /** The pet's accent, for the header stripe. */
  accent: PetAccent;
  badges: ShelfItem[];
  milestones: ShelfItem[];
  /** How many awards exist in total, for the quiet "N to find" line. */
  catalogueSize: number;
}

/**
 * One pet's award shelf: badges and milestones already earned, newest first.
 * An empty shelf is a friendly prompt, never a telling-off.
 */
export function AwardsCard({
  petName,
  photoUri,
  glyph,
  accent,
  badges,
  milestones,
  catalogueSize,
}: AwardsCardProps): React.JSX.Element {
  const earned = badges.length + milestones.length;

  if (earned === 0) {
    return (
      <CCEmptyState
        emoji="🏅"
        title={`${petName}'s shelf is still empty`}
        message="Badges and milestones arrive on their own as you keep records — a first photo, a first walk, a week of care. Nothing to chase."
        accent={COLOR.lavender}
        testID="home-awards-empty"
      />
    );
  }

  return (
    <CCCard glowTint={accent.fill} accent={accent.fill}>
      <View style={styles.awardsHead}>
        <View style={[styles.celebrationAvatar, { borderColor: accent.fill }]}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarPhoto}
              resizeMode="cover"
              accessibilityLabel={`${petName}'s photo`}
            />
          ) : (
            <Text style={styles.avatarGlyph}>{glyph}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{petName}'s badges</Text>
          <Text style={styles.footNote}>
            {earned} of {catalogueSize} earned so far — kept on this device, like everything else.
          </Text>
        </View>
        <CCPill label={`${earned}`} tone="lavender" emoji="🏅" />
      </View>

      <View style={styles.shelf}>
        {[...badges, ...milestones].map((item) => (
          <View key={item.id} style={styles.shelfRow} testID={`home-award-${item.id}`}>
            <View style={[styles.shelfChip, { backgroundColor: accent.soft }]}>
              <Text style={styles.shelfEmoji}>{item.emoji}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.shelfTitle}>{item.title}</Text>
              <Text style={styles.shelfBlurb}>{item.blurb}</Text>
            </View>
            {item.earnedAt ? (
              <Text style={styles.shelfDate}>{shortDate(item.earnedAt.slice(0, 10))}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </CCCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.9 },
  celebrationWrap: { gap: SPACE.s3 },
  celebration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    padding: SPACE.s4,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderLeftWidth: 6,
    shadowColor: '#202126',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  celebrationAvatar: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    backgroundColor: COLOR.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarGlyph: { fontSize: 28, lineHeight: 34 },
  celebrationTag: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  celebrationTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.text,
    marginTop: 2,
  },
  celebrationMessage: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 18,
    color: COLOR.textMuted,
    marginTop: 2,
  },
  awardsHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  cardTitle: { fontFamily: FONT_HEAD, fontSize: 17, fontWeight: '700', color: COLOR.text },
  footNote: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: COLOR.textMuted,
    marginTop: 2,
  },
  shelf: { gap: SPACE.s2, marginTop: SPACE.s3 },
  shelfRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  shelfChip: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfEmoji: { fontSize: 19 },
  shelfTitle: { fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: '700', color: COLOR.text },
  shelfBlurb: { fontFamily: FONT_BODY, fontSize: 12, lineHeight: 16.5, color: COLOR.textMuted },
  shelfDate: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textFaint },
});
