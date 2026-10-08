/**
 * Custom Pet Artwork — the full-screen preview.
 *
 * Free for everyone (no premium gate): the owner can look at the whole piece
 * before deciding anything. It renders the SAME document the PDF is built from:
 *  - in the browser: the real print HTML in an inline frame, which is also what
 *    the "Print" action sends to the browser's print dialog;
 *  - on a device: the same document model drawn with `ArtworkCanvas` (this stack
 *    has no WebView), so the sheet, the frame and the words are faithful without
 *    any new dependency — and the pet's own photo, which the PDF carries inline,
 *    is drawn straight from its file.
 *
 * The photo is resolved HERE too, because the print document needs it inline: on
 * a device the local file is read into a `data:` URI (see ../pdf/artwork/photoData),
 * in a browser the picked URI already is one.
 *
 * Nothing is fetched, stored or generated here — the piece is built in memory
 * from the record the app already holds, and the caption travels to this screen
 * as a navigation parameter, not through a server.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ArtworkCanvas } from '../components/ArtworkCanvas';
import { ArtworkWebFrame } from '../components/ArtworkWebFrame';
import { useArtworkBuilders } from '../pdf/artwork/useArtworkDocument';
import { paperSizeDef } from '../pdf/planner/sections';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, COLOR, RADIUS, SHADOW, SPACE } from '../theme';

/** The piece preview for the choices made on the artwork screen. */
export default function ArtworkPreviewScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<ShopStackParamList, 'ArtworkPreview'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const builders = useArtworkBuilders();
  const { width } = useWindowDimensions();
  const { petId, templateId, paper, caption, autoPrint } = route.params;

  const pet = useMemo(
    () => builders.source.pets.find((candidate) => candidate.id === petId) ?? null,
    [builders.source.pets, petId],
  );

  /** The photo the sheet will carry, resolved the same way the PDF resolves it. */
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    builders.resolvePhoto(pet?.photoUri).then((resolved) => {
      if (alive) setPhoto(resolved);
    });
    return () => {
      alive = false;
    };
  }, [builders, pet?.photoUri]);

  const config = useMemo(
    () => ({ petId: petId ?? null, templateId, paper, caption: caption ?? '', photo }),
    [petId, templateId, paper, caption, photo],
  );
  const doc = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => builders.html(config), [builders, config]);
  const size = paperSizeDef(paper);

  /** The paper mount inside the card, never a stretched poster. */
  const canvasWidth = useMemo(
    () => Math.max(180, Math.min(width - 2 * SPACE.s4 - 2 * SPACE.s2 - 1, 420)),
    [width],
  );

  /* ---- browser: the real sheet, in a frame ---- */
  if (Platform.OS === 'web') {
    return (
      <View style={BS.screen}>
        <View style={styles.webHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to the artwork"
          >
            <Text style={BS.link}>‹ Custom pet artwork</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            {doc.petName} · {size.short}
          </Text>
        </View>
        <ArtworkWebFrame html={html} autoPrint={autoPrint} />
      </View>
    );
  }

  /* ---- device: the same sheet, drawn natively ---- */
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the artwork">
          <Text style={BS.link}>‹ Custom pet artwork</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Preview</Text>
        <Text style={BS.h1}>{doc.petName}</Text>
        <Text style={BS.italic}>
          {doc.template.title} — {size.label}. Printing this produces exactly what you see here,
          edge to edge, with your own photo in the frame.
        </Text>
        <View style={styles.paper}>
          <ArtworkCanvas doc={doc} width={canvasWidth} photoUri={pet?.photoUri ?? null} />
        </View>
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          Preview is always free. Generating, downloading, printing and sharing the PDF are part of
          Blueprint Premium — back on the artwork screen.
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
  /** The white mount the sheet sits on, like a print on a mat. */
  paper: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.cardSm,
    padding: SPACE.s2,
    alignSelf: 'center',
    ...SHADOW.card,
  },
});
