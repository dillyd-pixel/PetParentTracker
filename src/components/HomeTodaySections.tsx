/**
 * Home's day sections (design Phase B2) — Today's Tasks, Needs Attention and
 * the Upcoming rail.
 *
 * Three cards that every one of them renders only real data: the view models are
 * built by `utils/homeSections` from the app's own stores (schedules, vaccines,
 * medications, vet visits, pets), and here they are drawn in the Command Center
 * language — white cards, 18–24px corners, a soft coloured glow per section, the
 * serif section rhythm supplied by the screen.
 *
 * Tone rules, kept identical to the rest of the app: a task that is not ticked is
 * "not yet" (never red, never late); a surfaced item is an invitation with a
 * "Fix Now →" that goes somewhere real; an empty section is an illustrated
 * prompt, not a blank box. No negative copy exists in this file.
 *
 * 100% offline: presentation only — no storage, no network, no new dependency.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CCCard, CCEmptyState, CCPill } from './CC';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE, TONE } from '../theme';
import { hexWithAlpha } from '../utils/petAccent';
import { relativeDayLabel } from '../utils/homeSections';
import type { AttentionItem, FixAction, HomeTask, TimelineItem } from '../utils/homeSections';

/* ----------------------------------------------------------- today's tasks -- */

export interface HomeTasksCardProps {
  /** The selected pet's meals and meds for today, in time order. */
  tasks: HomeTask[];
  /** That pet's name, for the card's copy. */
  petName: string;
  /** A task row was tapped — the screen records (or removes) its check-in. */
  onToggle: (task: HomeTask) => void;
  /** The empty state's action, and the card's footer links. */
  onAddFeeding: () => void;
  onAddMedication: () => void;
}

/** One task line: a tick circle, the task, and whether it is done. */
function TaskRow({
  task,
  onToggle,
}: {
  task: HomeTask;
  onToggle: (task: HomeTask) => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={() => onToggle(task)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: task.done }}
      accessibilityLabel={`${task.title} — ${task.done ? 'recorded for today' : 'not yet today'}`}
      testID={`home-task-${task.id}`}
      style={({ pressed }) => [styles.taskRow, task.done && styles.taskRowDone, pressed && styles.pressed]}
    >
      <View style={[styles.tick, task.done ? styles.tickDone : styles.tickTodo]}>
        <Text style={[styles.tickGlyph, task.done && styles.tickGlyphDone]}>
          {task.done ? '✓' : task.emoji}
        </Text>
      </View>
      <View style={styles.taskText}>
        <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
        <Text style={styles.taskDetail}>{task.detail}</Text>
      </View>
      <Text style={[styles.taskState, task.done && styles.taskStateDone]}>
        {task.done ? 'Undo' : 'Tick'}
      </Text>
    </Pressable>
  );
}

/**
 * Today's Tasks: the pet's own feeding times and medication doses, tickable.
 * A tick writes the matching care check-in, so this list and the Daily Care Ring
 * can never disagree.
 */
export function HomeTasksCard({
  tasks,
  petName,
  onToggle,
  onAddFeeding,
  onAddMedication,
}: HomeTasksCardProps): React.JSX.Element {
  if (tasks.length === 0) {
    return (
      <CCEmptyState
        emoji="🍽️"
        title={`Nothing scheduled for ${petName} yet`}
        message="Add a feeding time or a medication and it lands here every day, ready to tick."
        actionLabel="+ Add a feeding time"
        onAction={onAddFeeding}
        accent={COLOR.sunshine}
        testID="home-tasks-empty"
      />
    );
  }

  const doneCount = tasks.filter((task) => task.done).length;
  const allDone = doneCount === tasks.length;

  return (
    <CCCard glowTint={COLOR.sunshine} accent={COLOR.sunshine}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          {allDone ? `All of ${petName}'s day is ticked 🎉` : `${doneCount} of ${tasks.length} ticked`}
        </Text>
        <CCPill
          label={allDone ? 'Done' : `${tasks.length - doneCount} to go`}
          tone={allDone ? 'leaf' : 'neutral'}
          emoji={allDone ? '🐾' : undefined}
        />
      </View>
      <View style={styles.rows}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} />
        ))}
      </View>
      <Text style={styles.footNote}>
        A tick records it — the Care Ring above fills in too, and a second tap undoes it.
      </Text>
      <View style={styles.links}>
        <Pressable
          onPress={onAddMedication}
          accessibilityRole="button"
          accessibilityLabel="Add a medication"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.link}>💊 Add a medication</Text>
        </Pressable>
        <Pressable
          onPress={onAddFeeding}
          accessibilityRole="button"
          accessibilityLabel="Add a feeding time"
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <Text style={styles.link}>🍽️ Add a feeding time</Text>
        </Pressable>
      </View>
    </CCCard>
  );
}

/* -------------------------------------------------------- needs attention -- */

export interface NeedsAttentionCardProps {
  /** Surfaced items across the household, most pressing first. */
  items: AttentionItem[];
  /** How many to show before the quiet "+N more" line. */
  max?: number;
  /** A "Fix Now →" was tapped — the screen navigates to the right editor. */
  onFix: (fix: FixAction) => void;
}

/**
 * Needs Attention: everything worth a look, each with a real destination. The
 * list is capped so the card never becomes a wall of chores — the rest stay
 * quietly in the pet pages.
 */
export function NeedsAttentionCard({
  items,
  max = 6,
  onFix,
}: NeedsAttentionCardProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <CCEmptyState
        emoji="🌿"
        title="Nothing needs you right now"
        message="Every record here is in place. Enjoy the quiet — we'll speak up when something's worth a look."
        accent={COLOR.leaf}
        testID="home-attention-empty"
      />
    );
  }

  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;

  return (
    <CCCard glowTint={COLOR.coral} accent={COLOR.coral}>
      <View style={styles.rows}>
        {shown.map((item) => {
          const tone = TONE[item.tone];
          return (
            <View key={item.id} style={styles.attentionRow} testID={`home-attention-${item.id}`}>
              <View style={[styles.attentionChip, { backgroundColor: tone.bg }]}>
                <Text style={styles.attentionEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.attentionText}>
                <Text style={[styles.kicker, { color: tone.fg }]}>{item.petName}</Text>
                <Text style={styles.attentionTitle}>{item.title}</Text>
                <Text style={styles.attentionDetail}>{item.detail}</Text>
              </View>
              <Pressable
                onPress={() => onFix(item.fix)}
                accessibilityRole="button"
                accessibilityLabel={`Fix now: ${item.title}`}
                testID={`home-fix-${item.id}`}
                style={({ pressed }) => [styles.fixWrap, pressed && styles.pressed]}
              >
                <Text style={[styles.fixLink, { color: tone.fg }]}>Fix Now →</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {hidden > 0 ? (
        <Text style={styles.footNote}>
          And {hidden} more quietly waiting in the pet pages — nothing that can’t keep.
        </Text>
      ) : null}
    </CCCard>
  );
}

/* --------------------------------------------------------------- upcoming -- */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface UpcomingTimelineCardProps {
  /** Every dated thing ahead, in date order. */
  items: TimelineItem[];
  /** How many to show before the quiet "+N more" line. */
  max?: number;
  /** A row was tapped — the screen opens that pet's matching screen. */
  onOpen: (fix: FixAction) => void;
  /** The empty state's action: add a record. */
  onAddRecord: () => void;
}

/**
 * Upcoming: the household's next dates on a vertical rail — vet visits, vaccine
 * due dates, medication courses ending, birthdays and adoption days. A pet with
 * no dates simply contributes nothing.
 */
export function UpcomingTimelineCard({
  items,
  max = 6,
  onOpen,
  onAddRecord,
}: UpcomingTimelineCardProps): React.JSX.Element {
  if (items.length === 0) {
    return (
      <CCEmptyState
        emoji="📅"
        title="Nothing on the calendar yet"
        message="Add a vet visit, a vaccine due date or a birthday and it lines up here in date order."
        actionLabel="+ Add a record"
        onAction={onAddRecord}
        accent={COLOR.lavender}
        testID="home-upcoming-empty"
      />
    );
  }

  const shown = items.slice(0, max);
  const hidden = items.length - shown.length;

  return (
    <CCCard glowTint={COLOR.lavender}>
      <View>
        {shown.map((item, index) => {
          const tone = TONE[item.tone];
          const [, month, day] = item.dateISO.split('-');
          return (
            <View key={item.id} style={styles.railRow} testID={`home-upcoming-${item.id}`}>
              <View style={[styles.railChip, { backgroundColor: tone.bg }]}>
                <Text style={[styles.railDay, { color: tone.fg }]}>{Number(day)}</Text>
                <Text style={[styles.railMonth, { color: tone.fg }]}>
                  {MONTHS_SHORT[Number(month) - 1] ?? month}
                </Text>
              </View>
              <View style={styles.railTrack}>
                <View style={[styles.railDot, { backgroundColor: tone.fg }]} />
                {index < shown.length - 1 ? <View style={styles.railLine} /> : null}
              </View>
              <Pressable
                onPress={() => onOpen(item.fix)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} — ${relativeDayLabel(item.days)}`}
                style={({ pressed }) => [styles.railBody, pressed && styles.pressed]}
              >
                <View style={styles.railHead}>
                  <Text style={styles.railTitle} numberOfLines={1}>
                    {item.emoji} {item.title}
                  </Text>
                  <Text style={styles.railWhen}>{relativeDayLabel(item.days)}</Text>
                </View>
                <Text style={styles.railDetail} numberOfLines={1}>
                  {item.petName}
                  {item.detail ? ` · ${item.detail}` : ''}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      {hidden > 0 ? <Text style={styles.footNote}>And {hidden} more further out.</Text> : null}
    </CCCard>
  );
}

/* ---------------------------------------------------------------- styles -- */

const styles = StyleSheet.create({
  pressed: { opacity: 0.9 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.s2,
  },
  rows: { gap: SPACE.s1 },
  cardTitle: { fontFamily: FONT_HEAD, fontSize: 16.5, fontWeight: '700', color: COLOR.text },
  footNote: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: COLOR.textMuted,
    marginTop: SPACE.s2,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s3, marginTop: SPACE.s2 },
  link: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.accent },
  kicker: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },

  /* tasks */
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s2,
    borderRadius: RADIUS.button,
    backgroundColor: COLOR.canvasSoft,
  },
  taskRowDone: { backgroundColor: 'rgba(85,201,141,0.10)' },
  tick: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  tickTodo: { borderColor: hexWithAlpha(COLOR.sunshine, 0.7), backgroundColor: COLOR.surface },
  tickDone: { borderColor: COLOR.leaf, backgroundColor: COLOR.leaf },
  tickGlyph: { fontSize: 18, lineHeight: 22 },
  tickGlyphDone: { color: COLOR.white, fontWeight: '700' },
  taskText: { flex: 1 },
  taskTitle: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600', color: COLOR.text },
  taskTitleDone: { textDecorationLine: 'line-through', color: COLOR.textMuted },
  taskDetail: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted, marginTop: 1 },
  taskState: { fontFamily: FONT_BODY, fontSize: 12, fontWeight: '700', color: COLOR.accent },
  taskStateDone: { color: COLOR.leaf },

  /* needs attention */
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
  },
  attentionChip: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionEmoji: { fontSize: 18 },
  attentionText: { flex: 1 },
  attentionTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 15,
    fontWeight: '700',
    color: COLOR.text,
    marginTop: 1,
  },
  attentionDetail: {
    fontFamily: FONT_BODY,
    fontSize: 12.5,
    lineHeight: 17,
    color: COLOR.textMuted,
    marginTop: 2,
  },
  fixWrap: { paddingVertical: SPACE.s1, paddingLeft: SPACE.s1 },
  fixLink: { fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: '700' },

  /* upcoming rail */
  railRow: { flexDirection: 'row', alignItems: 'stretch', gap: SPACE.s2, paddingVertical: SPACE.s1 },
  railChip: {
    width: 46,
    paddingVertical: SPACE.s1,
    borderRadius: RADIUS.cardSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railDay: { fontFamily: FONT_HEAD, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  railMonth: { fontFamily: FONT_BODY, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  railTrack: { width: 12, alignItems: 'center' },
  railDot: { width: 9, height: 9, borderRadius: RADIUS.pill, marginTop: 14 },
  railLine: { flex: 1, width: 2, backgroundColor: hexWithAlpha(COLOR.lavender, 0.35) },
  railBody: { flex: 1, paddingVertical: SPACE.s1 },
  railHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACE.s2 },
  railTitle: { fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: '700', color: COLOR.text, flex: 1 },
  railWhen: { fontFamily: FONT_BODY, fontSize: 11.5, fontWeight: '700', color: COLOR.premiumDeep },
  railDetail: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.textMuted, marginTop: 2 },
});
