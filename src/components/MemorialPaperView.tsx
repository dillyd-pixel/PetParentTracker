/**
 * Pet Memorial Book — the on-device preview of the printed book.
 *
 * The book's PDF is built by turning a `MemorialDocument` into print HTML (see
 * ../pdf/memorial/html). A WebView isn't part of this stack, so on a device the
 * preview renders THE SAME document model with native views instead: the ivory
 * paper, the serif headings, the memories gradient (Coral → Lavender) rules, the
 * labelled facts, the memory cards, the timeline, the framed photo space and the
 * owner's letter — the book's content, shown faithfully, with nothing fetched
 * and nothing downloaded.
 *
 * In the browser the preview uses the real print HTML (an inline frame), so what
 * the owner prints there is literally the generated book.
 *
 * Photos: a local file CAN be drawn natively (unlike in the print document, which
 * carries no images), so this preview shows the pet's real photo where there is
 * one — the book on paper keeps the framed space for it.
 *
 * 100% offline: this component only draws data it was handed.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';
import type {
  MemorialBlock,
  MemorialDocument,
  MemorialTimelineEntry,
} from '../pdf/memorial/document';

/** The memories gradient (Coral → Lavender) as the book's accent rule. */
function Rule({ tall = false }: { tall?: boolean }): React.JSX.Element {
  return (
    <LinearGradient
      colors={[COLOR.coral, COLOR.lavender]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.rule, tall ? styles.ruleTall : null]}
    />
  );
}

/** One timeline row: the date on the left, the moment on the right. */
function TimelineRow({ entry }: { entry: MemorialTimelineEntry }): React.JSX.Element {
  return (
    <View style={styles.timelineRow}>
      <Text style={styles.timelineDate}>{entry.dateLabel}</Text>
      <View style={styles.timelineBody}>
        <Text style={styles.timelineTitle}>
          {entry.emoji} {entry.title}
        </Text>
        {entry.meta ? <Text style={styles.meta}>{entry.meta}</Text> : null}
        {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
      </View>
    </View>
  );
}

/** One block of a section, rendered natively. */
function Block({ block }: { block: MemorialBlock }): React.JSX.Element | null {
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
    case 'timeline':
      return (
        <View style={styles.timeline}>
          {block.entries.map((entry, index) => (
            <TimelineRow key={`${entry.date}-${index}`} entry={entry} />
          ))}
          {block.note ? <Text style={styles.hint}>{block.note}</Text> : null}
        </View>
      );
    case 'frame':
      return (
        <View style={[styles.frame, block.tall ? styles.frameTall : null]}>
          <Text style={styles.frameText}>{block.text}</Text>
        </View>
      );
    case 'letter':
      return (
        <View style={styles.letter}>
          <Text style={block.muted ? styles.letterWaiting : styles.letterBody}>{block.text}</Text>
          {block.ruleLines && block.ruleLines > 0 ? (
            <View style={styles.writeLines}>
              {Array.from({ length: block.ruleLines }, (_unused, index) => (
                <View key={`line-${index}`} style={styles.writeLine} />
              ))}
            </View>
          ) : null}
          {block.signOff ? <Text style={styles.signOff}>{block.signOff}</Text> : null}
        </View>
      );
    default:
      return null;
  }
}

/**
 * The whole book, as native "paper". Rendered inside a ScrollView by the preview
 * screen (this component is just the document itself, so it can be dropped into a
 * scroll view, a modal or the screen body unchanged).
 *
 * `photoUri` is the pet's own uploaded photo: the print document cannot embed it,
 * so the native preview shows it above the framed space the printed page keeps.
 */
export function MemorialPaperView({
  doc,
  photoUri,
}: {
  doc: MemorialDocument;
  photoUri?: string;
}): React.JSX.Element {
  return (
    <View>
      <View style={styles.cover}>
        <Rule tall />
        <Text style={styles.kicker}>{doc.kicker}</Text>
        <Text style={styles.title}>
          {doc.petEmoji ? `${doc.petEmoji} ` : ''}
          {doc.title}
        </Text>
        {doc.petMeta ? <Text style={styles.petMeta}>{doc.petMeta}</Text> : null}
        <Text style={styles.subtitle}>{doc.subtitle}</Text>
        {doc.sectionTitles.length > 0 ? (
          <Text style={styles.index}>Inside: {doc.sectionTitles.join(' · ')}</Text>
        ) : null}
      </View>

      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`${doc.petName}'s photo`}
        />
      ) : null}

      {doc.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Rule />
          <Text style={styles.sectionTitle}>
            {section.emoji} {section.title}
          </Text>
          {section.blocks.map((block, index) => (
            <Block key={`${section.id}-${index}`} block={block} />
          ))}
        </View>
      ))}

      <Text style={styles.footer}>
        Made with 💛 by Pet Parent Tracker — kept on this device, printed at home.
      </Text>
    </View>
  );
}

/** The paper: ivory, card-edged, with the printed book's own type. */
export function MemorialPaper({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
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
  rule: { height: 3, borderRadius: 2, marginBottom: 6 },
  ruleTall: { height: 7, marginBottom: SPACE.s2 },
  cover: { paddingBottom: SPACE.s2 },
  kicker: {
    fontFamily: FONT_HEAD,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: COLOR.premiumDeep,
  },
  title: {
    fontFamily: FONT_HEAD,
    fontSize: 25,
    fontWeight: '700',
    color: COLOR.text,
    lineHeight: 30,
    marginTop: 4,
  },
  petMeta: { fontFamily: FONT_BODY, fontSize: 13, color: COLOR.text, marginTop: 4 },
  subtitle: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted, marginTop: 4 },
  index: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textMuted, marginTop: 6 },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: RADIUS.cardSm,
    backgroundColor: COLOR.surfaceSoft,
    marginTop: SPACE.s2,
  },
  section: {
    marginTop: SPACE.s3,
    paddingHorizontal: SPACE.s3,
    paddingTop: SPACE.s3,
    paddingBottom: SPACE.s3,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: RADIUS.cardSm,
    backgroundColor: COLOR.surface,
  },
  sectionTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: '700',
    color: COLOR.premiumDeep,
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
    borderLeftColor: COLOR.lavender,
    paddingLeft: 8,
    marginTop: 8,
  },
  listTitle: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.text },
  meta: { fontFamily: FONT_BODY, fontSize: 11.5, color: COLOR.textMuted, marginTop: 1 },
  note: { fontFamily: FONT_BODY, fontSize: 12, color: COLOR.text, marginTop: 2, lineHeight: 18 },
  timeline: { marginTop: 6 },
  timelineRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  timelineDate: { fontFamily: FONT_BODY, fontSize: 11, color: COLOR.textMuted, width: '30%' },
  timelineBody: { flex: 1 },
  timelineTitle: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '700', color: COLOR.text },
  hint: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    fontStyle: 'italic',
    color: COLOR.textMuted,
    marginTop: 5,
  },
  frame: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    backgroundColor: COLOR.canvasSoft,
    borderRadius: RADIUS.cardSm,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    marginTop: 8,
  },
  frameTall: { height: 320 },
  frameText: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: COLOR.textMuted,
    textAlign: 'center',
  },
  letter: {
    borderWidth: 1,
    borderColor: COLOR.accent2Soft,
    borderLeftWidth: 4,
    borderLeftColor: COLOR.coral,
    borderRadius: RADIUS.cardSm,
    backgroundColor: COLOR.surface,
    padding: SPACE.s3,
    marginTop: 6,
  },
  letterBody: {
    fontFamily: FONT_HEAD,
    fontSize: 14.5,
    lineHeight: 22,
    color: COLOR.text,
  },
  letterWaiting: {
    fontFamily: FONT_HEAD,
    fontSize: 13.5,
    lineHeight: 20,
    fontStyle: 'italic',
    color: COLOR.textMuted,
  },
  writeLines: { marginTop: 6 },
  writeLine: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: COLOR.divider,
    height: 26,
  },
  signOff: {
    fontFamily: FONT_HEAD,
    fontSize: 14,
    color: COLOR.premiumDeep,
    marginTop: 10,
    textAlign: 'right',
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
