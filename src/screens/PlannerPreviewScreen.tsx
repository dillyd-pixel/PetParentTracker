/**
 * Printable Pet Planner — the full-screen preview.
 *
 * Free for everyone (no premium gate): the owner can look through the whole
 * document before deciding anything. It renders the SAME document the PDF is
 * built from:
 *  - in the browser: the real print HTML in an inline frame, which is also what
 *    the "Print" action sends to the browser's print dialog;
 *  - on a device: the same document model drawn with native paper views (this
 *    stack has no WebView), so the content and layout are faithful without any
 *    new dependency.
 *
 * Nothing is fetched, stored or generated here — the preview builds the document
 * in memory from the records the app already holds.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { PlannerPaper, PlannerPaperView } from '../components/PlannerPaperView';
import { PlannerWebFrame } from '../components/PlannerWebFrame';
import { usePlannerBuilders } from '../pdf/planner/usePlannerDocument';
import { paperSizeDef } from '../pdf/planner/sections';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, SPACE } from '../theme';

/** The document preview for the choices made on the Customize screen. */
export default function PlannerPreviewScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<ShopStackParamList, 'PetPlannerPreview'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const builders = usePlannerBuilders();
  const { petIds, sectionIds, paper, autoPrint } = route.params;

  const config = useMemo(() => ({ petIds, sectionIds, paper }), [petIds, sectionIds, paper]);
  const doc = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => builders.html(config), [builders, config]);
  const size = paperSizeDef(paper);

  /* ---- browser: the real document, in a frame ---- */
  if (Platform.OS === 'web') {
    return (
      <View style={BS.screen}>
        <View style={styles.webHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the planner">
            <Text style={BS.link}>‹ Planner</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            {doc.petNames.length === 1 ? doc.petNames[0] : `${doc.petNames.length} pets`} ·{' '}
            {size.short}
          </Text>
        </View>
        <PlannerWebFrame html={html} autoPrint={autoPrint} />
      </View>
    );
  }

  /* ---- device: the same document, drawn natively ---- */
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the planner">
          <Text style={BS.link}>‹ Planner</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Preview</Text>
        <Text style={BS.h1}>{doc.title}</Text>
        <Text style={BS.italic}>
          The finished document — {size.label}, {doc.chapters.length}{' '}
          {doc.chapters.length === 1 ? 'pet' : 'pets'}, {doc.sectionTitles.length} sections. Printing
          it produces exactly this, page for page.
        </Text>
        <PlannerPaper>
          <PlannerPaperView doc={doc} />
        </PlannerPaper>
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          Preview is always free. Generating, downloading, printing and sharing the PDF are part of
          Blueprint Premium — back on the planner screen.
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
    backgroundColor: BS.screen.backgroundColor,
  },
});
