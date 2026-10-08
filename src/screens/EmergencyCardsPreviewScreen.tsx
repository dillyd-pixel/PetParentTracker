/**
 * Emergency Pet Card pack — the full-screen preview.
 *
 * Free for everyone (no premium gate): the owner can look at the whole pack
 * before deciding anything. It renders the SAME card the PDF is built from:
 *  - in the browser: the real print HTML in an inline frame — the sheets, at the
 *    size they print, which is also what the "Print" action sends to the
 *    browser's print dialog;
 *  - on a device: the same deck drawn with `EmergencyCardFace` (this stack has no
 *    WebView), so the card, its photo, its text, its chips and its QR are
 *    faithful without any new dependency — and the pet's own photo, which the PDF
 *    carries inline, is drawn straight from its file.
 *
 * Every chosen pet's card is shown, front and back, in print order. The line
 * under them says exactly what prints and how big it is — 85.6 × 54 mm per card
 * (ID-1), at 100% scale — because a keepsake that a stranger may have to read is
 * no place for a surprise.
 *
 * Nothing is fetched, stored or generated here — the deck is built in memory from
 * the records the app already holds, and the typed card details travel to this
 * screen as navigation parameters, not through a server.
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

import { EmergencyCardFace } from '../components/EmergencyCardFace';
import { EmergencyWebFrame } from '../components/EmergencyWebFrame';
import { useEmergencyCardBuilders } from '../pdf/emergency/useEmergencyCards';
import { CARD_HEIGHT_MM, CARD_WIDTH_MM } from '../pdf/emergency/card';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, COLOR, RADIUS, SHADOW, SPACE } from '../theme';

/** The pack preview for the choices made on the card screen. */
export default function EmergencyCardsPreviewScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<ShopStackParamList, 'EmergencyCardsPreview'>>();
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const builders = useEmergencyCardBuilders();
  const { width } = useWindowDimensions();
  const { petIds, paper, extras, autoPrint } = route.params;

  /** Every chosen pet's photo, resolved the same way the PDF resolves it. */
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const selectionKey = useMemo(
    () =>
      petIds
        .map((id) => `${id}:${builders.source.pets.find((pet) => pet.id === id)?.photoUri ?? ''}`)
        .join('|'),
    [builders.source.pets, petIds],
  );
  useEffect(() => {
    let alive = true;
    const targets = builders.source.pets.filter((pet) => petIds.includes(pet.id));
    if (targets.length === 0) return;
    builders
      .resolvePhotos(targets)
      .then((resolved) => {
        if (alive) setPhotos(resolved);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // `selectionKey` covers the chosen pets and their photo URIs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builders, selectionKey]);

  const deck = useMemo(
    () => builders.document({ petIds, paper, extras: extras ?? {}, photos }),
    [builders, petIds, paper, extras, photos],
  );
  const html = useMemo(
    () => builders.html({ petIds, paper, extras: extras ?? {}, photos }),
    [builders, petIds, paper, extras, photos],
  );

  /** The card is drawn as wide as the screen allows, and never a stretched poster. */
  const cardWidth = useMemo(
    () => Math.max(180, Math.min(width - 2 * SPACE.s4 - 2 * SPACE.s2 - 1, 420)),
    [width],
  );

  /* ---- browser: the real sheets, in a frame ---- */
  if (Platform.OS === 'web') {
    return (
      <View style={BS.screen}>
        <View style={styles.webHeader}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to the cards"
          >
            <Text style={BS.link}>‹ Emergency pet cards</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            {deck.cards.length} {deck.cards.length === 1 ? 'card' : 'cards'} ·{' '}
            {deck.sheet.short}
          </Text>
        </View>
        <EmergencyWebFrame html={html} autoPrint={autoPrint} />
      </View>
    );
  }

  /* ---- device: the same cards, drawn natively ---- */
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={styles.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to the cards"
        >
          <Text style={BS.link}>‹ Emergency pet cards</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Preview</Text>
        <Text style={BS.h1}>
          {deck.cards.length === 1 ? deck.cards[0].petName : `${deck.cards.length} cards`}
        </Text>
        <Text style={BS.italic}>
          {deck.summary} Every card is {CARD_WIDTH_MM} × {CARD_HEIGHT_MM} mm (ID-1) and printed at
          100% — front, then back.
        </Text>

        <View style={styles.cards}>
          {deck.faces.map((face) => (
            <View key={`${face.card.petId}-${face.kind}`} style={styles.face}>
              <EmergencyCardFace face={face} width={cardWidth} />
              <Text style={BS.caption}>
                {face.label} · exactly {CARD_WIDTH_MM} × {CARD_HEIGHT_MM} mm on paper
              </Text>
            </View>
          ))}
        </View>

        {deck.cards.length === 0 ? (
          <Text style={BS.italic}>
            No pets picked yet — go back and choose whose cards you need.
          </Text>
        ) : null}

        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          Preview is always free. Generating, downloading, printing and sharing the PDF are part of
          Blueprint Premium — back on the card screen.
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
  /** The white mount each card sits on, like a print on a mat. */
  cards: { gap: SPACE.s4, marginTop: SPACE.s3, alignItems: 'center' },
  face: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.cardSm,
    padding: SPACE.s2,
    gap: SPACE.s1,
    ...SHADOW.card,
  },
});
