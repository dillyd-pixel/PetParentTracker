/**
 * Home's crew sections (design Phase B2) — Health Snapshot, Pet Spending, Their
 * Story (memories) and Blueprint Completion.
 *
 * Where HomeTodaySections is about today, these four are about the pet: what the
 * health records say, what the month cost, what has been written down, and how
 * far along the profile is. Every number is derived from a real on-device record
 * by `utils/homeSections` — no demo data, no estimate, no currency metadata the
 * app doesn't have.
 *
 * Section signatures of the owner's direction, kept per section: the Health
 * Snapshot carries the Aqua→Green gradient header, Spending leans Tangerine,
 * memories Coral→Lavender, and Blueprint Completion a Sunshine→Tangerine progress
 * bar (all from `theme.GRADIENT`). Nothing is shaming: an unfinished blueprint is
 * "still filling in", a quiet spending month is a quiet month.
 *
 * 100% offline: presentation only — no storage, no network, no new dependency.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CCCard, CCEmptyState, CCPill, ccOnGradient } from './CC';
import {
  COLOR,
  FONT_BODY,
  FONT_HEAD,
  RADIUS,
  SPACE,
  TONE,
  gradientColors,
} from '../theme';
import type { ToneName } from '../theme';
import { hexWithAlpha } from '../utils/petAccent';
import { petEmojiFor, shortDate } from '../utils/petDisplay';
import { expenseAmountLabel, journalMoodEmoji } from '../types';
import type { ExpenseCategory, JournalEntry, Pet } from '../types';
import { spendPraise } from '../utils/homeSections';
import type {
  BlueprintProgress,
  FixAction,
  HealthSnapshot,
  SpendSummary,
} from '../utils/homeSections';

/** The solid palette colour behind a tone — for dots and bars, not text. */
function dotFor(tone: ToneName): string {
  switch (tone) {
    case 'blue':
      return COLOR.blue;
    case 'aqua':
      return COLOR.aqua;
    case 'sunshine':
      return COLOR.sunshine;
    case 'coral':
      return COLOR.coral;
    case 'lavender':
      return COLOR.lavender;
    case 'leaf':
      return COLOR.leaf;
    case 'tangerine':
      return COLOR.tangerine;
    default:
      return COLOR.neutral500;
  }
}

/** The bar colour for one expense category. */
function categoryColor(category: ExpenseCategory): string {
  switch (category) {
    case 'Food':
      return COLOR.sunshine;
    case 'Vet':
      return COLOR.blue;
    case 'Grooming':
      return COLOR.lavender;
    case 'Supplies':
      return COLOR.aqua;
    case 'Medication':
      return COLOR.coral;
    default:
      return COLOR.tangerine;
  }
}

/** A plain amount, exactly as the expense store holds it (no currency guess). */
function money(amount: number): string {
  return expenseAmountLabel(amount);
}

/* --------------------------------------------------------- health snapshot -- */

export interface HealthSnapshotCardProps {
  pet: Pet;
  snapshot: HealthSnapshot;
  /** The card's footer link opens that pet's edit form. */
  onFix: (fix: FixAction) => void;
}

/**
 * The Health Snapshot: the selected pet's records as they actually stand —
 * latest weight and the day it was taken, the vaccination picture, what is on
 * the meds shelf, the last vet visit and the newest journaled observation.
 */
export function HealthSnapshotCard({
  pet,
  snapshot,
  onFix,
}: HealthSnapshotCardProps): React.JSX.Element {
  return (
    <CCCard
      glowTint={COLOR.aqua}
      radius={RADIUS.cardLg}
      padding={0}
      style={styles.hiddenOverflow}
    >
      {/* The section's gradient header — the health pair, Aqua → Leaf Green. */}
      <LinearGradient
        colors={gradientColors('health')}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.healthHead}
      >
        <View style={styles.healthHeadRow}>
          {/* Their photo threads through here too — the same picture as the crew card. */}
          <View style={styles.healthAvatar}>
            {pet.photoUri ? (
              <Image
                source={{ uri: pet.photoUri }}
                style={styles.healthAvatarPhoto}
                resizeMode="cover"
                accessibilityLabel={`${pet.name}'s photo`}
              />
            ) : (
              <Text style={styles.healthAvatarGlyph}>{petEmojiFor(pet)}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={ccOnGradient.eyebrow}>Health snapshot</Text>
            <Text style={ccOnGradient.title}>{pet.name}</Text>
          </View>
          <View style={styles.healthPill}>
            <Text style={styles.healthPillText}>{snapshot.vaccineStatus}</Text>
          </View>
        </View>
        <Text style={ccOnGradient.body}>
          The latest your records hold — nothing here is guessed.
        </Text>
      </LinearGradient>

      <View style={styles.healthBody}>
        {snapshot.rows.map((row) => (
          <View key={row.id} style={styles.healthRow} testID={`home-health-${row.id}`}>
            <Text style={styles.healthEmoji}>{row.emoji}</Text>
            <View style={styles.flex}>
              <Text style={styles.healthLabel}>{row.label}</Text>
              <Text style={styles.healthValue}>{row.value}</Text>
              {row.hint ? <Text style={styles.healthHint}>{row.hint}</Text> : null}
            </View>
            <View style={[styles.healthDot, { backgroundColor: dotFor(row.tone) }]} />
          </View>
        ))}
        <Pressable
          onPress={() => onFix({ to: 'petForm', petId: pet.id })}
          accessibilityRole="button"
          accessibilityLabel={`Update ${pet.name}'s details`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.cardLink}>Update {pet.name}’s details ›</Text>
        </Pressable>
      </View>
    </CCCard>
  );
}

/* ----------------------------------------------------------- pet spending -- */

/** One pet's line in the crew's month-at-a-glance list. */
export interface CrewSpendRow {
  petId: string;
  name: string;
  total: number;
  /** The pet's own accent fill (utils/petAccent), for the row's dot. */
  accent: string;
}

export interface PetSpendingCardProps {
  pet: Pet;
  /** The month's name, e.g. "September". */
  monthLabel: string;
  /** The selected pet's spend for that month. */
  spend: SpendSummary;
  /** Every pet's spend for that month (used when the household has more than one). */
  crew: CrewSpendRow[];
  /** The whole household's month total. */
  monthTotal: number;
  onFix: (fix: FixAction) => void;
}

/**
 * Pet Spending: the month for the selected pet, a small category breakdown, a
 * playful line about it, and — when the house has more than one pet — what the
 * rest of the crew spent.
 */
export function PetSpendingCard({
  pet,
  monthLabel,
  spend,
  crew,
  monthTotal,
  onFix,
}: PetSpendingCardProps): React.JSX.Element {
  const openExpenses = () => onFix({ to: 'petModule', petId: pet.id, module: 'Expenses' });

  if (spend.count === 0) {
    return (
      <View>
        <CCEmptyState
          emoji="💸"
          title={`Nothing logged for ${pet.name} in ${monthLabel}`}
          message="A food run, a vet bill, a suspiciously expensive toy — log one and the month builds itself."
          actionLabel="+ Log an expense"
          onAction={openExpenses}
          accent={COLOR.tangerine}
          testID="home-spending-empty"
        />
        {monthTotal > 0 ? (
          <Text style={[styles.footNote, styles.footNoteSpaced]}>
            The rest of the crew has logged {money(monthTotal)} between them this month.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <CCCard glowTint={COLOR.tangerine} accent={COLOR.tangerine}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{monthLabel} · {pet.name}</Text>
          <Text style={styles.money}>{money(spend.total)}</Text>
        </View>
        <CCPill
          label={`${spend.count} item${spend.count === 1 ? '' : 's'}`}
          tone="tangerine"
          emoji="💸"
        />
      </View>
      <Text style={styles.praise}>{spendPraise(pet.name, spend.total)}</Text>
      {spend.top ? (
        <Text style={styles.footNote}>
          Most of it went on {spend.top.category.toLowerCase()} — {money(spend.top.amount)}.
        </Text>
      ) : null}

      <View style={styles.bars}>
        {spend.slices.map((slice) => (
          <View key={slice.category} style={styles.barRow}>
            <Text style={styles.barLabel}>{slice.category}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    // A tiny share still shows a visible stub, so the row reads.
                    width: `${Math.max(slice.share * 100, 3)}%` as DimensionValue,
                    backgroundColor: categoryColor(slice.category),
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>{money(slice.amount)}</Text>
          </View>
        ))}
      </View>

      {crew.length > 1 ? (
        <View style={styles.crewBlock}>
          <Text style={styles.kicker}>This month, per pet</Text>
          {crew.map((row) => (
            <View key={row.petId} style={styles.crewRow}>
              <View style={[styles.crewDot, { backgroundColor: row.accent }]} />
              <Text style={styles.crewName} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={styles.crewAmount}>{money(row.total)}</Text>
            </View>
          ))}
          <Text style={styles.footNote}>Household total {money(monthTotal)}.</Text>
        </View>
      ) : null}

      <Pressable
        onPress={openExpenses}
        accessibilityRole="button"
        accessibilityLabel={`See ${pet.name}'s expenses`}
        style={({ pressed }) => [styles.cardLinkWrap, pressed && styles.pressed]}
      >
        <Text style={styles.cardLink}>See {pet.name}’s expenses ›</Text>
      </Pressable>
    </CCCard>
  );
}

/* ---------------------------------------------------------------- memories -- */

export interface MemoriesCardProps {
  pet: Pet;
  /** That pet's newest journal entries (already per-pet sorted, capped). */
  entries: JournalEntry[];
  /** The display zone, so a stored date reads as the owner typed it. */
  timeZone?: string;
  /** Empty-state and footer actions. */
  onAdd: () => void;
  onSeeAll: () => void;
}

/**
 * Their Story: the last few journal entries for the selected pet, photos and
 * moods included. With nothing written yet it is an illustrated prompt — the
 * entry point to the journal the app already has.
 */
export function MemoriesCard({
  pet,
  entries,
  timeZone,
  onAdd,
  onSeeAll,
}: MemoriesCardProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <CCEmptyState
        emoji="📖"
        title="No story yet"
        message={`Add a memory from the + button — a photo, a mood, a small brave moment — and ${pet.name}'s story starts filling in.`}
        actionLabel="+ Add a memory"
        onAction={onAdd}
        accent={COLOR.coral}
        testID="home-memories-empty"
      />
    );
  }

  return (
    <CCCard glowTint={COLOR.coral}>
      <View style={styles.rows}>
        {entries.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={onSeeAll}
            accessibilityRole="button"
            accessibilityLabel={`Open ${pet.name}'s story`}
            testID={`home-memory-${entry.id}`}
            style={({ pressed }) => [styles.memoryRow, pressed && styles.pressed]}
          >
            {entry.photoUri ? (
              <Image
                source={{ uri: entry.photoUri }}
                style={styles.memoryPhoto}
                resizeMode="cover"
                accessibilityLabel="Memory photo"
              />
            ) : entry.photoEmoji ? (
              /* A picture with no file behind it (no camera roll, or a glyph picked on purpose). */
              <View style={[styles.memoryPhoto, styles.memoryPlate]}>
                <Text style={styles.memoryGlyph}>{entry.photoEmoji}</Text>
              </View>
            ) : (
              <View style={[styles.memoryPhoto, styles.memoryPlate]}>
                <Text style={styles.memoryPlateGlyph}>{petEmojiFor(pet)}</Text>
              </View>
            )}
            <View style={styles.flex}>
              <Text style={styles.memoryTitle} numberOfLines={1}>
                {entry.title?.trim() || 'A moment'}
              </Text>
              <Text style={styles.memoryBody} numberOfLines={2}>
                {entry.body}
              </Text>
              <Text style={styles.memoryMeta}>
                {entry.mood ? `${journalMoodEmoji(entry.mood)} ${entry.mood} · ` : ''}
                {shortDate(entry.entryDate, timeZone)}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.links}>
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add a memory"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.cardLink}>＋ Add a memory</Text>
        </Pressable>
        <Pressable
          onPress={onSeeAll}
          accessibilityRole="button"
          accessibilityLabel={`See every memory for ${pet.name}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.cardLink}>See all ›</Text>
        </Pressable>
      </View>
    </CCCard>
  );
}

/* ----------------------------------------------------- blueprint completion -- */

export interface BlueprintCompletionCardProps {
  /** One strip per pet — the section is deliberately per pet. */
  progress: BlueprintProgress[];
  onFix: (fix: FixAction) => void;
}

/**
 * Blueprint Completion: how far along each pet's profile and records are, as a
 * gentle progress strip. No rewards and no grades — an unfinished blueprint is
 * simply "still filling in", and the "next" line is an offer, not a nag.
 */
export function BlueprintCompletionCard({
  progress,
  onFix,
}: BlueprintCompletionCardProps): React.JSX.Element {
  if (progress.length === 0) return <View />;
  const allComplete = progress.every((pet) => pet.percent === 100);

  return (
    <CCCard glowTint={COLOR.sunshine} accent={COLOR.tangerine}>
      <Text style={styles.cardTitle}>
        {allComplete
          ? 'Every blueprint is complete 🎉'
          : progress.length === 1
            ? 'Your blueprint is filling in'
            : 'Each blueprint, filling in'}
      </Text>
      <Text style={styles.footNote}>
        A map of what’s already in place — no score, no rush, nothing to lose.
      </Text>

      <View style={styles.blueprintRows}>
        {progress.map((petProgress) => {
          const next = petProgress.next;
          return (
            <View key={petProgress.petId} style={styles.blueprintRow} testID={`home-blueprint-${petProgress.petId}`}>
              <View style={styles.rowBetween}>
                <Text style={styles.blueprintName}>{petProgress.petName}</Text>
                <Text style={styles.blueprintCount}>
                  {petProgress.doneCount} of {petProgress.total} in place
                </Text>
              </View>
              <View style={styles.blueprintTrack}>
                <LinearGradient
                  colors={gradientColors('achievements')}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.blueprintFill,
                    // A sliver of colour at 0% keeps the strip legible.
                    { width: `${Math.max(petProgress.percent, 4)}%` as DimensionValue },
                  ]}
                />
              </View>
              {next ? (
                <Pressable
                  onPress={() => onFix(next.fix)}
                  accessibilityRole="button"
                  accessibilityLabel={`Next for ${petProgress.petName}: ${next.label}`}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <Text style={styles.blueprintNext}>
                    Next: {next.label} · Fix Now →
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.blueprintDone}>Everything’s in place. Beautifully kept. 🐾</Text>
              )}
            </View>
          );
        })}
      </View>
    </CCCard>
  );
}

/* ---------------------------------------------------------------- styles -- */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.9 },
  hiddenOverflow: { overflow: 'hidden' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.s2,
  },
  rows: { gap: SPACE.s2 },
  kicker: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  cardTitle: { fontFamily: FONT_HEAD, fontSize: 16.5, fontWeight: '700', color: COLOR.text },
  footNote: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: COLOR.textMuted,
    marginTop: SPACE.s1,
  },
  footNoteSpaced: { marginTop: SPACE.s2, textAlign: 'center' },
  cardLink: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.accent },
  cardLinkWrap: { marginTop: SPACE.s3 },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACE.s3,
    marginTop: SPACE.s3,
  },

  /* health snapshot */
  healthHead: { padding: SPACE.s4, gap: SPACE.s1 },
  healthHeadRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  healthAvatar: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: COLOR.white,
    backgroundColor: COLOR.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  healthAvatarPhoto: { width: '100%', height: '100%' },
  healthAvatarGlyph: { fontSize: 22, lineHeight: 28 },
  healthPill: {
    backgroundColor: 'rgba(255,255,255,0.24)',
    borderRadius: RADIUS.pill,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  healthPillText: { fontFamily: FONT_BODY, fontSize: 12, fontWeight: '700', color: COLOR.white },
  healthBody: { padding: SPACE.s4, gap: SPACE.s2 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  healthEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  healthLabel: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  healthValue: { fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: '700', color: COLOR.text },
  healthHint: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.textMuted, marginTop: 1 },
  healthDot: { width: 9, height: 9, borderRadius: RADIUS.pill },

  /* spending */
  money: {
    fontFamily: FONT_HEAD,
    fontSize: 30,
    fontWeight: '700',
    color: COLOR.text,
    letterSpacing: -0.5,
  },
  praise: {
    fontFamily: FONT_BODY,
    fontSize: 13.5,
    fontWeight: '600',
    color: TONE.tangerine.fg,
    marginTop: SPACE.s1,
  },
  bars: { gap: SPACE.s2, marginTop: SPACE.s3 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  barLabel: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.text, width: 82 },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.surfaceSoft,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: RADIUS.pill },
  barValue: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    fontWeight: '700',
    color: COLOR.text,
    width: 60,
    textAlign: 'right',
  },
  crewBlock: { marginTop: SPACE.s4, gap: SPACE.s1 },
  crewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2 },
  crewDot: { width: 10, height: 10, borderRadius: RADIUS.pill },
  crewName: { flex: 1, fontFamily: FONT_BODY, fontSize: 13.5, color: COLOR.text },
  crewAmount: { fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: '700', color: COLOR.text },

  /* memories */
  memoryRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  memoryPhoto: { width: 62, height: 62, borderRadius: RADIUS.thumb },
  memoryPlate: {
    backgroundColor: hexWithAlpha(COLOR.coral, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryPlateGlyph: { fontSize: 26 },
  memoryGlyph: { fontSize: 34 },
  memoryTitle: { fontFamily: FONT_HEAD, fontSize: 15, fontWeight: '700', color: COLOR.text },
  memoryBody: { fontFamily: FONT_BODY, fontSize: 13, lineHeight: 18, color: COLOR.textMuted },
  memoryMeta: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textFaint, marginTop: 2 },

  /* blueprint */
  blueprintRows: { gap: SPACE.s4, marginTop: SPACE.s3 },
  blueprintRow: { gap: SPACE.s1 },
  blueprintName: { fontFamily: FONT_HEAD, fontSize: 15, fontWeight: '700', color: COLOR.text },
  blueprintCount: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.textMuted },
  blueprintTrack: {
    height: 12,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.surfaceSoft,
    overflow: 'hidden',
    marginTop: SPACE.s1,
  },
  blueprintFill: { height: '100%', borderRadius: RADIUS.pill },
  blueprintNext: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    fontWeight: '700',
    color: TONE.tangerine.fg,
    marginTop: SPACE.s1,
  },
  blueprintDone: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    color: TONE.leaf.fg,
    fontWeight: '600',
    marginTop: SPACE.s1,
  },
});
