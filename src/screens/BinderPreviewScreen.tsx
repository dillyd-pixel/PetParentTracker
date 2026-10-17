/**
 * Printable binder — the full-screen preview.
 *
 * Free for everyone (no premium gate): the owner can look through the whole care
 * file before deciding anything. It renders the SAME document the PDF is built
 * from, through the planner's own preview machinery:
 *  - in the browser: the real print HTML in an inline frame, which is also what
 *    the "Print" action sends to the browser's print dialog;
 *  - on a device: the same document model drawn with the planner's native paper
 *    views (this stack has no WebView), so the content and layout are faithful
 *    without any new dependency.
 *
 * Nothing is fetched, stored or generated here — the preview builds the document
 * in memory from the records the app already holds.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { PlannerPaper, PlannerPaperView } from '../components/PlannerPaperView';
import { PlannerWebFrame } from '../components/PlannerWebFrame';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { useBinderBuilders } from '../pdf/binder/useBinderDocument';
import { paperSizeDef } from '../pdf/planner/sections';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'BinderPreview'>;

/** The binder preview for the choices made on the binder screen. */
export default function BinderPreviewScreen({ navigation, route }: Props): React.JSX.Element {
  const builders = useBinderBuilders();
  const { petIds, paper, autoPrint } = route.params;

  const config = useMemo(() => ({ petIds, paper }), [petIds, paper]);
  const doc = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => builders.html(config), [builders, config]);
  const size = paperSizeDef(paper);

  /* ---- browser: the real document, in a frame ---- */
  if (Platform.OS === 'web') {
    return (
      <View style={BS.screen}>
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the binder">
            <Text style={BS.link}>‹ Binder</Text>
          </TouchableOpacity>
          <Text style={BS.caption} testID="binder-preview-caption">
            {doc.petNames.length === 1 ? doc.petNames[0] : `${doc.petNames.length} pets`} ·{' '}
            {size.short}
          </Text>
        </View>
        <PlannerWebFrame
          html={html}
          autoPrint={autoPrint}
          title="Care binder preview"
          printLabel="🖨️ Print this binder"
        />
      </View>
    );
  }

  /* ---- device: the same document, drawn natively ---- */
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the binder">
          <Text style={BS.link}>‹ Binder</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Preview</Text>
        <Text style={BS.h1} testID="binder-preview-title">
          {doc.title}
        </Text>
        <Text style={BS.italic}>
          The finished care file — {size.label}, {doc.chapters.length}{' '}
          {doc.chapters.length === 1 ? 'pet' : 'pets'}, {doc.sectionTitles.length} sections. Printing
          it produces exactly this, page for page.
        </Text>
        <PlannerPaper>
          <PlannerPaperView doc={doc} />
        </PlannerPaper>
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          Preview is always free. Generating, downloading, printing and sharing the PDF are part of
          Blueprint Premium — back on the binder screen.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: SPACE.s4, paddingBottom: SPACE.s6 },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s3,
    backgroundColor: COLOR.bg,
  },
});
