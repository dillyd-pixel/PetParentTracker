/**
 * Pet Memorial Book — the full-screen preview.
 *
 * Free for everyone (no premium gate): the owner can look through the whole book
 * before deciding anything. It renders the SAME document the PDF is built from:
 *  - in the browser: the real print HTML in an inline frame, which is also what
 *    the "Print" action sends to the browser's print dialog;
 *  - on a device: the same document model drawn with native paper views (this
 *    stack has no WebView), so the content and layout are faithful without any
 *    new dependency — and the pet's own photo, which cannot be embedded in a
 *    print document, is shown above the framed space the printed page keeps.
 *
 * Nothing is fetched, stored or generated here — the preview builds the book in
 * memory from the records the app already holds. Nothing is uploaded either: the
 * note the owner typed travels to this screen as a navigation parameter, not
 * through a server.
 */
import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MemorialPaper, MemorialPaperView } from '../components/MemorialPaperView';
import { MemorialWebFrame } from '../components/MemorialWebFrame';
import { useMemorialBuilders } from '../pdf/memorial/useMemorialDocument';
import { paperSizeDef } from '../pdf/planner/sections';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, COLOR, SPACE } from '../theme';

/** The book preview for the choices made on the Keep screen. */
export default function MemorialBookPreviewScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<ShopStackParamList, 'MemorialBookPreview'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const builders = useMemorialBuilders();
  const { petId, sectionIds, paper, note, autoPrint } = route.params;

  const config = useMemo(
    () => ({ petId: petId ?? null, sectionIds, paper, note }),
    [petId, sectionIds, paper, note],
  );
  const doc = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => builders.html(config), [builders, config]);
  const size = paperSizeDef(paper);

  /** The pet's own uploaded photo — drawn natively, never embedded in the PDF. */
  const photoUri = useMemo(() => {
    const pet = builders.source.pets.find((candidate) => candidate.id === petId);
    return pet?.photoUri;
  }, [builders.source.pets, petId]);

  /* ---- browser: the real book, in a frame ---- */
  if (Platform.OS === 'web') {
    return (
      <View style={BS.screen}>
        <View style={styles.webHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to the memorial book"
          >
            <Text style={BS.link}>‹ Memorial book</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            {doc.petName ? doc.petName : 'Memorial book'} · {size.short}
          </Text>
        </View>
        <MemorialWebFrame html={html} autoPrint={autoPrint} />
      </View>
    );
  }

  /* ---- device: the same book, drawn natively ---- */
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to the memorial book"
        >
          <Text style={BS.link}>‹ Memorial book</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Preview</Text>
        <Text style={BS.h1}>{doc.title}</Text>
        <Text style={BS.italic}>
          The finished book — {size.label}, {doc.sections.length}{' '}
          {doc.sections.length === 1 ? 'page' : 'pages'}. Printing it produces exactly this, page
          for page.
        </Text>
        <MemorialPaper>
          <MemorialPaperView doc={doc} photoUri={photoUri} />
        </MemorialPaper>
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          Preview is always free. Making, downloading, printing and sharing the PDF are part of
          Blueprint Premium — back on the memorial book screen.
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
