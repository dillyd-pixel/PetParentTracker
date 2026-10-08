/**
 * Emergency Pet Card — the on-device card face (native preview).
 *
 * The pack's PDF is built by turning an `EmergencyCardDeck` into print HTML (see
 * ../pdf/emergency/html). A WebView isn't part of this stack, so on a device the
 * preview draws the same card with native views instead: the white card at its
 * true shape (85.6 × 54 mm, ID-1), the coloured top bar, the photo plate (the
 * pet's own photo, or the illustrated initial), the name and facts, the alert
 * chips, the contact blocks, the medication and behaviour lists and the QR —
 * the card's real content, laid out at the same fractions of its width as the
 * printed card, with nothing fetched and nothing downloaded.
 *
 * The QR is the encoder's own matrix: every dark run of modules is a small black
 * view, so what the preview shows is the code that prints, not a stand-in. A
 * card with no encodable payload simply has no QR block.
 *
 * In the browser the preview uses the real print HTML (an inline frame), so what
 * the owner prints there is literally the generated card — this component is
 * native-only, drawn only when there is no frame to show.
 *
 * 100% offline: it only draws data it was handed.
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CARD_ASPECT, CARD_WIDTH_MM } from '../pdf/emergency/card';
import {
  extraMedicationsNote,
  type EmergencyCard,
  type EmergencyCardFace,
} from '../pdf/emergency/document';
import type { EmergencyQr } from '../pdf/emergency/qr';
import { COLOR, FONT_BODY, FONT_HEAD, RADIUS } from '../theme';

/** The font stack for the big initial and the pet's name (the house serif). */
const SERIF = FONT_HEAD;

/** The card's own colours, matching the print sheet exactly. */
const INK = '#202126';
const SOFT = '#4A4B52';
const MUTED = '#6B6C75';
const BLUE = '#246BFD';
const CORAL = '#FF6B78';
const LINE = '#E3DED3';

/**
 * The QR matrix as native views: one absolutely-positioned bar per dark run of
 * modules, on a white tile with a four-module quiet zone. Deterministic — the
 * same code always draws the same picture.
 */
function QrBlock({ qr, size }: { qr: EmergencyQr; size: number }): React.JSX.Element {
  /** Modules (plus the quiet zone) per side, and one module's size in points. */
  const quiet = 4;
  const span = qr.size + quiet * 2;
  const module = size / span;
  return (
    <View
      style={[styles.qrTile, { width: size, height: size }]}
      accessibilityLabel="QR code with the pet's emergency summary"
    >
      <View style={{ width: size, height: size }}>
        {qr.runs.map((run) => (
          <View
            key={`${run.y}-${run.x}`}
            style={{
              position: 'absolute',
              left: (run.x + quiet) * module,
              top: (run.y + quiet) * module,
              width: run.width * module,
              height: module,
              backgroundColor: INK,
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** The photo plate: the pet's own photo, or the illustrated initial. */
function Plate({ card, s }: { card: EmergencyCard; s: number }): React.JSX.Element {
  return (
    <View
      style={[
        styles.plate,
        { left: 4 * s, top: 7.6 * s, width: 24 * s, height: 26 * s, borderRadius: 2 * s },
      ]}
    >
      {card.photo ? (
        <Image source={{ uri: card.photo }} style={styles.photo} resizeMode="cover" />
      ) : (
        <LinearGradient
          colors={['#EAF1FF', '#FFF1E3']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.photo}
        >
          <Text style={[styles.initial, { fontSize: 15 * s, lineHeight: 25 * s }]}>
            {card.initial}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

/** The front of one card. */
function Front({ card, s }: { card: EmergencyCard; s: number }): React.JSX.Element {
  return (
    <>
      <LinearGradient
        colors={[BLUE, '#31D7D7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { height: 2 * s }]}
      />
      <Text
        style={[styles.eyebrow, { left: 4 * s, top: 3.2 * s, fontSize: 1.9 * s }]}
        numberOfLines={1}
      >
        If found · please help
      </Text>
      <Plate card={card} s={s} />
      <View style={{ position: 'absolute', left: 31 * s, top: 7.2 * s, width: 50.6 * s }}>
        <Text style={[styles.name, { fontSize: 6 * s, lineHeight: 6.4 * s }]} numberOfLines={2}>
          {card.petName}
        </Text>
        <Text style={[styles.species, { fontSize: 2.4 * s, lineHeight: 3 * s }]} numberOfLines={1}>
          {card.speciesLine}
        </Text>
        <Text style={[styles.facts, { fontSize: 2.5 * s, lineHeight: 3 * s }]} numberOfLines={1}>
          {card.factsLine}
        </Text>
        {card.microchip ? (
          <Text style={[styles.idline, { fontSize: 2.4 * s, lineHeight: 3 * s }]} numberOfLines={1}>
            {card.microchip}
          </Text>
        ) : null}
      </View>
      <View style={[styles.chips, { left: 4 * s, top: 34.4 * s, width: 77.6 * s }]}>
        {card.alerts.length > 0 ? (
          card.alerts.map((alert) => {
            const allergy = alert.startsWith('ALLERGIC');
            return (
              <View
                key={alert}
                style={[
                  styles.chip,
                  {
                    backgroundColor: allergy ? '#FFE9EB' : '#FFF0E4',
                    borderColor: allergy ? '#FFC4CA' : '#FFD3B0',
                    borderRadius: 5 * s,
                    paddingHorizontal: 1.5 * s,
                    paddingVertical: 0.7 * s,
                    marginRight: 1 * s,
                    marginBottom: 1 * s,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { fontSize: 2.1 * s, lineHeight: 2.6 * s, color: allergy ? '#B3202E' : '#A2500F' },
                  ]}
                  numberOfLines={1}
                >
                  {alert}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={[styles.alertNote, { fontSize: 2.1 * s, lineHeight: 2.7 * s }]}>
            {card.alertsNote}
          </Text>
        )}
      </View>
      <Text
        style={[styles.foot, { left: 4 * s, bottom: 2.4 * s, width: 77.6 * s, fontSize: 2.3 * s }]}
        numberOfLines={3}
      >
        {card.ifFound}
      </Text>
    </>
  );
}

/** One contact block on the back. */
function Contact({
  card,
  index,
  s,
}: {
  card: EmergencyCard;
  index: number;
  s: number;
}): React.JSX.Element | null {
  const contact = card.contacts[index];
  if (!contact) return null;
  const left = index % 2 === 0 ? 4 : 45;
  const top = index < 2 ? 7.4 : 19;
  return (
    <View style={{ position: 'absolute', left: left * s, top: top * s, width: 36.6 * s }}>
      <Text style={[styles.clabel, { fontSize: 1.75 * s }]} numberOfLines={1}>
        {contact.label}
      </Text>
      <Text style={[styles.cname, { fontSize: 2.6 * s, lineHeight: 3 * s }]} numberOfLines={1}>
        {contact.name}
      </Text>
      {contact.detail ? (
        <Text style={[styles.cdetail, { fontSize: 2 * s }]} numberOfLines={1}>
          {contact.detail}
        </Text>
      ) : null}
      <Text style={[styles.cphone, { fontSize: 3 * s, lineHeight: 3.5 * s }]} numberOfLines={1}>
        {contact.phone}
      </Text>
    </View>
  );
}

/** The back of one card. */
function Back({ card, s }: { card: EmergencyCard; s: number }): React.JSX.Element {
  const medsExtra = extraMedicationsNote(card);
  return (
    <>
      <LinearGradient
        colors={[BLUE, '#31D7D7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bar, { height: 2 * s }]}
      />
      <View style={[styles.bhead, { left: 4 * s, top: 3.1 * s, width: 77.6 * s }]}>
        <Text style={[styles.bk, { fontSize: 1.8 * s }]} numberOfLines={1}>
          Emergency information
        </Text>
        <Text style={[styles.bp, { fontSize: 1.8 * s }]} numberOfLines={1}>
          {card.petName}
        </Text>
      </View>
      {[0, 1, 2, 3].map((index) => (
        <Contact key={index} card={card} index={index} s={s} />
      ))}
      <View style={{ position: 'absolute', left: 4 * s, top: 29.4 * s, width: 52 * s }}>
        <Text style={[styles.clabel, { fontSize: 1.75 * s }]} numberOfLines={1}>
          Medications
        </Text>
        {card.medications.length > 0 ? (
          card.medications.map((line) => (
            <Text key={line} style={[styles.lline, { fontSize: 2.3 * s, lineHeight: 2.9 * s }]}>
              {line}
            </Text>
          ))
        ) : (
          <Text style={[styles.lnone, { fontSize: 2.1 * s, lineHeight: 2.7 * s }]}>
            {card.medsNote}
          </Text>
        )}
        {medsExtra ? (
          <Text style={[styles.lnone, { fontSize: 2.1 * s, lineHeight: 2.7 * s }]}>
            {medsExtra}
          </Text>
        ) : null}
      </View>
      <View style={{ position: 'absolute', left: 4 * s, top: 40.4 * s, width: 52 * s }}>
        <Text style={[styles.clabel, { fontSize: 1.75 * s }]} numberOfLines={1}>
          Behaviour
        </Text>
        {card.notes.length > 0 ? (
          card.notes.map((line) => (
            <Text
              key={line}
              style={[styles.lline, { fontSize: 2.2 * s, lineHeight: 2.8 * s }]}
              numberOfLines={1}
            >
              {line}
            </Text>
          ))
        ) : (
          <Text style={[styles.lnone, { fontSize: 2.1 * s, lineHeight: 2.7 * s }]}>
            {card.notesNote}
          </Text>
        )}
      </View>
      <View style={{ position: 'absolute', left: 59.6 * s, top: 29.4 * s, width: 22 * s }}>
        {card.qr ? (
          <>
            <QrBlock qr={card.qr} size={20 * s} />
            <Text style={[styles.qrcap, { fontSize: 1.5 * s, lineHeight: 1.9 * s }]}>
              Scan for a plain-text summary — no link, no app
            </Text>
          </>
        ) : (
          <View
            style={{
              width: 20 * s,
              height: 20 * s,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: LINE,
              borderRadius: 1.5 * s,
            }}
          />
        )}
      </View>
    </>
  );
}

/**
 * One card face at a chosen width: the same card the PDF carries, drawn natively.
 * `width` is in points; everything inside is a fraction of it, so the card keeps
 * its true ID-1 shape at any size.
 */
export function EmergencyCardFace({
  face,
  width,
}: {
  face: EmergencyCardFace;
  width: number;
}): React.JSX.Element {
  const height = width / CARD_ASPECT;
  const s = width / CARD_WIDTH_MM;
  const card = face.card;
  return (
    <View
      style={[styles.card, { width, height }]}
      accessibilityLabel={`${card.petName} emergency card, ${face.kind}`}
    >
      {face.kind === 'front' ? <Front card={card} s={s} /> : <Back card={card} s={s} />}
    </View>
  );
}

/** A card's real height at a chosen width, in points. */
export function emergencyCardHeight(width: number): number {
  return width / CARD_ASPECT;
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: RADIUS.thumb,
    overflow: 'hidden',
  },
  bar: { position: 'absolute', left: 0, top: 0, width: '100%' },
  eyebrow: {
    position: 'absolute',
    width: '100%',
    color: CORAL,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  plate: {
    position: 'absolute',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LINE,
    backgroundColor: '#EAF1FF',
  },
  photo: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: SERIF, fontWeight: '700', color: BLUE, textAlign: 'center' },
  name: { fontFamily: SERIF, fontWeight: '700', color: INK },
  species: { color: SOFT, letterSpacing: 0.3, textTransform: 'uppercase' },
  facts: { color: INK, fontWeight: '700' },
  idline: { color: BLUE, fontWeight: '700' },
  chips: { position: 'absolute', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  chip: { borderWidth: 1 },
  chipText: { fontWeight: '700' },
  alertNote: { color: MUTED },
  foot: { position: 'absolute', color: SOFT },
  bhead: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  bk: { color: BLUE, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  bp: { color: INK, fontWeight: '700', textTransform: 'uppercase' },
  clabel: { color: MUTED, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  cname: { color: INK, fontWeight: '700' },
  cdetail: { color: MUTED },
  cphone: { color: BLUE, fontWeight: '700' },
  lline: { color: INK },
  lnone: { color: MUTED },
  qrTile: { backgroundColor: '#FFFFFF' },
  qrcap: { color: MUTED, textAlign: 'center', marginTop: 2 },
});
