/**
 * Printable Pet Planner — the on-device preview of the printed document.
 *
 * The planner's PDF is built by turning a `PlannerDocument` into print HTML
 * (see ../pdf/planner/html). A WebView isn't part of this stack, so on a device
 * the preview renders THE SAME document model with native views instead: the
 * ivory paper, the serif headings, the Blueprint Blue section rules, the
 * labelled records, the write-in tables and the 12-month grid — the document's
 * content, shown faithfully, with nothing fetched and nothing downloaded.
 *
 * In the browser the preview uses the real print HTML (an inline frame), so
 * what the owner prints there is literally the generated document.
 *
 * 100% offline: this component only draws data it was handed.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import type { PlannerBlock, PlannerDocument, PlannerMonth } from '../pdf/planner/document';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** One month's blank grid with the pet's known dates marked on their days. */
function MonthGrid({ month }: { month: PlannerMonth }): React.JSX.Element {
  const cells: Array<number | null> = [];
  for (let i = 0; i < month.firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= month.daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.month}>
      <Text style={styles.monthName}>{month.label}</Text>
      <View style={styles.gridRow}>
        {WEEKDAYS.map((day, index) => (
          <Text key={`${day}-${index}`} style={styles.gridHead}>
            {day}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={`w${weekIndex}`} style={styles.gridRow}>
          {week.map((day, dayIndex) => {
            const marks = day ? month.marks[day] : undefined;
            return (
              <View
                key={`d${dayIndex}`}
                style={[styles.gridCell, marks ? styles.gridCellMarked : null]}
              >
                <Text style={styles.gridCellText}>{day ?? ''}</Text>
                {marks ? <Text style={styles.mark}>{marks.join('')}</Text> : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** One block of a section, rendered natively. */
function Block({ block }: { block: PlannerBlock }): React.JSX.Element | null {
  switch (block.kind) {
    case 'text':
      return <Text style={block.muted ? styles.empty : styles.line}>{block.text}</Text>;
    case 'subheading':
      return <Text style={styles.subheading}>{block.text}</Text>;
    case 'kv':
      return (
        <View style={styles.kvTable}>
          {block.rows.map((row, index) => (
            <View key={`${row.label}-${index}`} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{row.label}</Text>
              <Text style={styles.kvValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      );
    case 'list':
      return (
        <View>
          {block.items.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.listItem}>
              <Text style={styles.listTitle}>{item.title}</Text>
              {item.meta ? <Text style={styles.meta}>{item.meta}</Text> : null}
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
            </View>
          ))}
        </View>
      );
    case 'log':
      return (
        <View style={styles.logTable}>
          <View style={styles.logHeadRow}>
            {block.columns.map((column) => (
              <Text key={column} style={styles.logHead}>
                {column}
              </Text>
            ))}
          </View>
          {block.rows.map((row, rowIndex) => (
            <View key={`row${rowIndex}`} style={styles.logRow}>
              {row.map((cell, cellIndex) => (
                <Text key={`cell${cellIndex}`} style={styles.logCell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
          {block.hint ? <Text style={styles.hint}>{block.hint}</Text> : null}
        </View>
      );
    case 'calendar':
      return (
        <View>
          <View style={styles.months}>
            {block.months.map((month) => (
              <MonthGrid key={month.label} month={month} />
            ))}
          </View>
          {block.legend.length > 0 ? (
            <Text style={styles.legend}>
              Key: {block.legend.map((entry) => `${entry.emoji} ${entry.label}`).join(' · ')}
            </Text>
          ) : null}
        </View>
      );
    case 'frame':
      return (
        <View style={styles.frame}>
          <Text style={styles.frameText}>{block.text}</Text>
        </View>
      );
    default:
      return null;
  }
}

/**
 * The whole planner, as native "paper". Rendered inside a ScrollView by the
 * preview screen (this component is just the document itself, so it can be
 * dropped into a scroll view, a modal or the screen body unchanged).
 */
export function PlannerPaperView({ doc }: { doc: PlannerDocument }): React.JSX.Element {
  return (
    <View>
      <View style={styles.cover}>
        <Text style={styles.kicker}>{doc.kicker}</Text>
        <Text style={styles.title}>{doc.title}</Text>
        <Text style={styles.subtitle}>{doc.subtitle}</Text>
        <Text style={styles.index}>Inside: {doc.sectionTitles.join(' · ')}</Text>
      </View>
      {doc.chapters.map((chapter) => (
        <View key={chapter.petId} style={styles.chapter}>
          <Text style={styles.petName}>
            {chapter.petEmoji} {chapter.petName}
          </Text>
          <Text style={styles.petMeta}>{chapter.meta}</Text>
          {chapter.sections.map((section) => (
            <View key={`${chapter.petId}-${section.id}`}>
              <Text style={styles.sectionTitle}>
                {section.emoji} {section.title}
              </Text>
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.footer}>
        Made with 💛 by Pet Parent Tracker — printed at home, nothing left the device.
      </Text>
    </View>
  );
}

/** The paper: ivory, white-ish, with print-like type. */
export function PlannerPaper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.paper}>{children}</View>;
}

const styles = StyleSheet.create({
  paper: {
    backgroundColor: COLOR.bg,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    padding: SPACE.s4,
  },
  cover: {
    borderBottomWidth: 3,
    borderBottomColor: COLOR.blue,
    paddingBottom: SPACE.s2,
    marginBottom: SPACE.s3,
  },
  kicker: {
    fontFamily: FONT_HEAD,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLOR.blue,
  },
  title: {
    fontFamily: FONT_HEAD,
    fontSize: 26,
    fontWeight: '700',
    color: COLOR.text,
    lineHeight: 30,
    marginTop: 4,
  },
  subtitle: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted, marginTop: 4 },
  index: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textMuted, marginTop: 6 },
  chapter: { marginTop: SPACE.s4 },
  petName: {
    fontFamily: FONT_HEAD,
    fontSize: 20,
    fontWeight: '700',
    color: COLOR.text,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.aqua,
    paddingBottom: 4,
  },
  petMeta: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted, marginTop: 4 },
  sectionTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 15.5,
    fontWeight: '700',
    color: COLOR.accent700,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.aqua,
    paddingBottom: 3,
    marginTop: SPACE.s3,
  },
  subheading: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '700',
    color: COLOR.text,
    marginTop: SPACE.s2,
    marginBottom: 2,
  },
  line: { fontFamily: FONT_BODY, fontSize: 13, color: COLOR.text, marginTop: 4, lineHeight: 19 },
  empty: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLOR.textMuted,
    marginTop: 4,
    lineHeight: 19,
  },
  kvTable: { marginTop: 4 },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
    paddingVertical: 5,
  },
  kvLabel: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.textMuted, width: '34%' },
  kvValue: { fontFamily: FONT_BODY, fontSize: 12.5, color: COLOR.text, flex: 1 },
  listItem: {
    borderLeftWidth: 2.5,
    borderLeftColor: COLOR.aqua,
    paddingLeft: 8,
    marginTop: 8,
  },
  listTitle: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.text },
  meta: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted, marginTop: 1 },
  note: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.text, marginTop: 2 },
  logTable: { marginTop: 6 },
  logHeadRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOR.blue },
  logHead: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLOR.accent700,
    paddingBottom: 3,
  },
  logRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
    minHeight: 24,
    alignItems: 'flex-end',
  },
  logCell: { flex: 1, fontFamily: FONT_BODY, fontSize: 12, color: COLOR.text, paddingVertical: 4 },
  hint: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    fontStyle: 'italic',
    color: COLOR.textMuted,
    marginTop: 4,
  },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  month: {
    width: '48%',
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 6,
    padding: 5,
    marginBottom: 6,
  },
  monthName: {
    fontFamily: FONT_HEAD,
    fontSize: 11.5,
    fontWeight: '700',
    color: COLOR.accent700,
    marginBottom: 3,
  },
  gridRow: { flexDirection: 'row' },
  gridHead: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONT_BODY,
    fontSize: 8.5,
    color: COLOR.textMuted,
  },
  gridCell: { flex: 1, alignItems: 'center', minHeight: 17, borderRadius: 3 },
  gridCellMarked: { backgroundColor: COLOR.surfaceSoft },
  gridCellText: { fontFamily: FONT_BODY, fontSize: 9, color: COLOR.text },
  mark: { fontSize: 5.5, lineHeight: 7 },
  legend: { fontFamily: FONT_BODY, fontSize: 10.5, color: COLOR.textMuted, marginTop: 4 },
  frame: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    borderRadius: 8,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginTop: 8,
  },
  frameText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLOR.textMuted,
    textAlign: 'center',
  },
  footer: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    color: COLOR.textMuted,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
    paddingTop: 8,
    marginTop: SPACE.s4,
  },
});
