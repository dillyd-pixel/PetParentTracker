/**
 * Emergency Pet Card pack — the Keep screen (Keepsakes → Emergency pet card
 * pack), and the app's fourth and final finished upsell product (4/4).
 *
 * What it does, all on the device:
 *  - choose one, several or every pet — a card is made for each one, and the
 *    list is never hidden behind a demo pet;
 *  - fill in the few facts only the owner knows (their own number, the vet's, an
 *    emergency vet, the microchip number, allergies in their own words, a note
 *    for whoever finds the pet) — kept on this device and reused every time;
 *  - choose how it prints: one card per page at its true 85.6 × 54 mm (ID-1), or
 *    eight cards per Letter/A4 sheet at that same true size with corner marks to
 *    cut along — the layout a home printer can actually feed;
 *  - look at the whole pack for free, and, with Blueprint Premium, Generate the
 *    PDF · Download a copy · Print · Share it.
 *
 * Where every line comes from: the SAME stores the rest of the app uses — the
 * pet's own profile and photo, their medications, their vet records, their care
 * instructions, the owner's name from Settings, and the card details the owner
 * typed here. There is no fetch, no server, no AI and no account anywhere in
 * this feature, and nothing is invented: a field with nothing behind it prints
 * "—" or is left out, never a guessed value. The QR encodes a plain-text
 * summary (no link, no app, no signal needed to read it).
 *
 * Tone: this is the sheet a stranger reads when the worst happens. The preview
 * is always free, the copy never dramatises, and the card says exactly what the
 * phone knows — including how little that is, in the app's own honest voice.
 *
 * No file accumulates: the PDF is written to the app's temporary folder only when
 * the owner asks for it, the previous temporary file is removed first, and a copy
 * is saved somewhere visible only when the owner Downloads it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { EmergencyCardFace } from '../components/EmergencyCardFace';
import { EmergencyWebFrame } from '../components/EmergencyWebFrame';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  EMERGENCY_PAPERS,
  type EmergencyCardPaper,
} from '../pdf/emergency/card';
import {
  buildEmergencyCard,
  type EmergencyCard,
  type EmergencyCardExtras,
} from '../pdf/emergency/document';
import { cardInitial } from '../pdf/emergency/document';
import {
  useEmergencyCardBuilders,
  useEmergencyDetails,
} from '../pdf/emergency/useEmergencyCards';
import {
  deleteTempFile,
  emergencyCardsFileName,
  formatBytes,
  generateEmergencyCardsPdf,
  printEmergencyCardsPdf,
  saveEmergencyCardsPdf,
  shareEmergencyCardsPdf,
} from '../pdf/emergency/cardFile';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import type { MainTabParamList, RootStackParamList } from '../navigation/RootNavigator';
import { BS, COLOR, FONT_BODY, RADIUS, SHADOW, SPACE } from '../theme';

/** What the screen is doing right now (so only one action runs at a time). */
type BusyAction = 'generate' | 'download' | 'print' | 'share' | null;

/**
 * This screen's navigation: its own Shop stack, plus the tab and root routes it
 * may bubble up to (the empty state sends the owner to the Pets tab).
 * Type-only, so nothing is imported at runtime.
 */
type CardsNavigation = NativeStackNavigationProp<
  ShopStackParamList & MainTabParamList & RootStackParamList
>;

/** One field of the card-details form: what it is called and what it hints at. */
interface DetailField {
  key: keyof EmergencyCardExtras;
  label: string;
  placeholder: string;
  /** Paragraph-sized (allergies, a behaviour note) rather than one line. */
  multiline?: boolean;
  /** A quiet line under the box, when the field needs explaining. */
  hint?: string;
}

/**
 * The card details the app itself cannot know. Every one is optional: a card
 * with none of them still prints — it simply shows "—" where the number would
 * be, which is the honest thing to show.
 */
const DETAIL_FIELDS: readonly DetailField[] = [
  { key: 'ownerPhone', label: 'Your phone number', placeholder: 'e.g. 555-0142' },
  { key: 'coParentName', label: 'Co-parent’s name', placeholder: 'e.g. Alex' },
  { key: 'coParentPhone', label: 'Co-parent’s phone', placeholder: 'e.g. 555-0199' },
  {
    key: 'vetName',
    label: 'Vet name',
    placeholder: 'e.g. Dr. Morales',
    hint: 'Leave this blank and the card uses the vet from this pet’s own visit records.',
  },
  { key: 'vetPhone', label: 'Vet phone', placeholder: 'e.g. 555-0102' },
  {
    key: 'emergencyVetName',
    label: 'Emergency vet',
    placeholder: 'e.g. City Animal ER',
    hint: 'The out-of-hours clinic — the number a stranger should try at night.',
  },
  { key: 'emergencyVetPhone', label: 'Emergency vet phone', placeholder: 'e.g. 555-0911' },
  {
    key: 'microchip',
    label: 'Microchip number',
    placeholder: 'e.g. 981020001234567',
    hint: 'The app keeps no chip field of its own, so this is the number off your paperwork.',
  },
  {
    key: 'allergies',
    label: 'Allergies or conditions',
    placeholder: 'e.g. peanuts — hives; take straight to a vet',
    multiline: true,
    hint: 'Your own words. It prints as an ALLERGIC alert on the front of the card.',
  },
  {
    key: 'behaviorNote',
    label: 'A note for whoever finds them',
    placeholder: 'e.g. shy with strangers — approach slowly',
    multiline: true,
  },
];

/** A card as one line of the picker: the pet, its card, and what is still missing. */
interface PickerRow {
  petId: string;
  name: string;
  photoUri: string | null;
  initial: string;
  /** e.g. "Dog · Border collie · 9 yr". */
  meta: string;
  /** What the card will be short of, in the owner's words. */
  missing: string[];
}

/** How wide a card is drawn in the on-device preview, at most. */
const MAX_PREVIEW_WIDTH = 420;

export default function EmergencyCardsScreen(): React.JSX.Element {
  const navigation = useNavigation<CardsNavigation>();
  const { pets, activePet } = usePets();
  const premium = usePremium();
  const unlocked = premium.isPremium();
  const builders = useEmergencyCardBuilders();
  const details = useEmergencyDetails();
  const { width } = useWindowDimensions();

  /** The pets whose cards are being made (the active pet, to begin with). */
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [paper, setPaper] = useState<EmergencyCardPaper>('card');
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  /** Which pet the "card details" form is currently editing. */
  const [detailPetId, setDetailPetId] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [generated, setGenerated] = useState<{ uri: string; bytes: number; fileName: string } | null>(
    null,
  );
  /** The temp file from the last "Generate" — deleted before a new one is made. */
  const lastTempRef = useRef<string | null>(null);

  const isWeb = Platform.OS === 'web';

  /* ---- the owner's choice, resolved into a list of pets ---- */
  useEffect(() => {
    if (selectedIds.length > 0 || pets.length === 0) return;
    const first = pets.find((candidate) => candidate.id === activePet?.id) ?? pets[0];
    setSelectedIds([first.id]);
  }, [activePet?.id, pets, selectedIds.length]);

  /* ---- which pet the details form is editing (always one of the chosen) ---- */
  useEffect(() => {
    if (selectedIds.length === 0) return;
    setDetailPetId((current) =>
      current && selectedIds.includes(current) ? current : selectedIds[0],
    );
  }, [selectedIds]);

  const chosen = useMemo(
    () =>
      selectedIds
        .map((id) => pets.find((candidate) => candidate.id === id))
        .filter((pet): pet is NonNullable<typeof pet> => !!pet),
    [pets, selectedIds],
  );

  /**
   * The pets whose cards are being made, in the owner's chosen order — the
   * effect below re-runs when the selection changes or one of those photos is
   * edited on the pet's page.
   */
  const selectedPhotoKey = useMemo(
    () =>
      selectedIds
        .map((id) => `${id}:${pets.find((pet) => pet.id === id)?.photoUri ?? ''}`)
        .join('|'),
    [pets, selectedIds],
  );

  /** Each chosen pet's photo, resolved into something the sheet can carry. */
  useEffect(() => {
    let alive = true;
    const targets = pets.filter((pet) => selectedIds.includes(pet.id));
    if (targets.length === 0) {
      setPhotos({});
      return;
    }
    builders
      .resolvePhotos(targets)
      .then((resolved) => {
        if (alive) setPhotos(resolved);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // `selectedPhotoKey` is the selection plus the photos it points at; the
    // resolved map itself must not be a dependency (it is what this sets).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builders, selectedPhotoKey]);

  const config = useMemo(
    () => ({
      petIds: selectedIds,
      paper,
      extras: details.details,
      photos,
    }),
    [selectedIds, paper, details.details, photos],
  );
  const deck = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => builders.html(config), [builders, config]);

  /** One card per pet, for the picker's honest "what is still missing" lines. */
  const rows = useMemo<PickerRow[]>(
    () =>
      pets.map((pet) => {
        const card = buildEmergencyCard(
          builders.source,
          pet,
          details.details[pet.id] ?? {},
          photos[pet.id] ?? null,
        );
        return {
          petId: pet.id,
          name: pet.name,
          photoUri: pet.photoUri ?? null,
          initial: cardInitial(pet.name),
          meta: [pet.species === 'Other' ? pet.customSpecies || 'Other' : pet.species]
            .concat(card.factsLine ? [card.factsLine] : [])
            .join(' · '),
          missing: card.missing,
        };
      }),
    [pets, builders.source, details.details, photos],
  );

  /** The pet whose details are being edited right now. */
  const detailPet = useMemo(
    () => chosen.find((pet) => pet.id === detailPetId) ?? chosen[0] ?? null,
    [chosen, detailPetId],
  );
  const detailCard: EmergencyCard | null = useMemo(
    () =>
      detailPet
        ? buildEmergencyCard(
            builders.source,
            detailPet,
            details.details[detailPet.id] ?? {},
            photos[detailPet.id] ?? null,
          )
        : null,
    [detailPet, builders.source, details.details, photos],
  );
  /** The vet the card would use from the pet's own records, if any. */
  const recordVetName = useMemo(() => {
    if (!detailPet) return '';
    const record = builders.source.vetRecords
      .filter(
        (entry) => entry.petId === detailPet.id && (entry.kind ?? 'visit') !== 'document',
      )
      .slice()
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0];
    return (record?.veterinarian || record?.clinicName || '').trim();
  }, [builders.source.vetRecords, detailPet]);

  const canvasWidth = useMemo(
    () => Math.max(180, Math.min(width - 2 * SPACE.s4 - 1, MAX_PREVIEW_WIDTH)),
    [width],
  );

  const toggle = useCallback((petId: string) => {
    setSelectedIds((current) =>
      current.includes(petId)
        ? current.filter((id) => id !== petId)
        : [...current, petId],
    );
  }, []);

  const selectAll = useCallback(
    () => setSelectedIds(pets.map((pet) => pet.id)),
    [pets],
  );

  const goToPremium = useCallback(() => {
    try {
      navigation.navigate('Premium');
    } catch {
      // Navigation must never crash the screen — the lock row stays visible.
    }
  }, [navigation]);

  const goAddPet = useCallback(() => {
    try {
      navigation.navigate('Pets', { screen: 'PetList' });
    } catch {
      // The guidance above still says exactly where a pet is added.
    }
  }, [navigation]);

  const preview = useCallback(
    (autoPrint = false) => {
      navigation.navigate('EmergencyCardsPreview', {
        petIds: selectedIds,
        paper,
        extras: details.details,
        autoPrint,
      });
    },
    [navigation, selectedIds, paper, details.details],
  );

  /* ---- the file actions (native; the web shows a friendly note instead) ---- */

  const ensurePdf = useCallback(async () => {
    deleteTempFile(lastTempRef.current);
    const pdf = await generateEmergencyCardsPdf(builders.html(config), paper);
    lastTempRef.current = pdf.uri;
    return pdf;
  }, [builders, config, paper]);

  const fileName = useMemo(
    () => emergencyCardsFileName(deck.cards.map((card) => card.petName)),
    [deck.cards],
  );

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    setBusy('generate');
    try {
      const pdf = await ensurePdf();
      setGenerated({ uri: pdf.uri, bytes: pdf.bytes, fileName });
      Alert.alert(
        'Your cards are ready ✨',
        `${deck.summary}\n\nTemporary file (${formatBytes(pdf.bytes)}):\n${pdf.uri}\n\nIt lives in the app's temporary folder. Download, print or share it to keep a copy — nothing is uploaded, ever.`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t make the cards',
        e instanceof Error ? e.message : 'Something went wrong building the PDF. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, deck.summary, fileName]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('download');
    try {
      const { uri, base64, bytes } = await ensurePdf();
      const savedTo = await saveEmergencyCardsPdf({ uri, base64, fileName });
      if (!savedTo) return; // the owner cancelled the folder picker
      setGenerated({ uri: savedTo, bytes, fileName });
      Alert.alert(
        'Saved 🎉',
        Platform.OS === 'android'
          ? `${fileName} (${formatBytes(bytes)}) is in the folder you chose (your Downloads folder, by default).`
          : `${fileName} (${formatBytes(bytes)}) was saved on this device:\n${savedTo}`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t save the cards',
        e instanceof Error ? e.message : 'Something went wrong saving the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, fileName]);

  const handlePrint = useCallback(async () => {
    if (busy) return;
    setBusy('print');
    try {
      await printEmergencyCardsPdf(builders.html(config));
    } catch (e) {
      Alert.alert(
        'Couldn’t open the print dialog',
        e instanceof Error ? e.message : 'Something went wrong printing. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, builders, config]);

  const handleShare = useCallback(async () => {
    if (busy) return;
    setBusy('share');
    try {
      const { uri, bytes } = await ensurePdf();
      const shared = await shareEmergencyCardsPdf(uri, fileName);
      if (!shared) {
        Alert.alert(
          'Sharing isn’t available here',
          `The cards (${formatBytes(bytes)}) are saved on this device:\n${uri}`,
        );
      }
    } catch (e) {
      Alert.alert(
        'Couldn’t share the cards',
        e instanceof Error ? e.message : 'Something went wrong sharing the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, fileName]);

  /* ---- no pets at all ---- */
  if (pets.length === 0) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={[BS.pad, styles.pad]}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the shop">
            <Text style={BS.link}>‹ Shop</Text>
          </TouchableOpacity>
          <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Keepsake</Text>
          <Text style={BS.h1}>Emergency pet cards</Text>
          <Text style={BS.italic}>
            A wallet card that speaks for your pet if they are ever found without you. It is built
            from their own records — so there is nothing to make until they have a page here.
          </Text>

          <View style={BS.card}>
            {/* the illustration: a card-shaped plate, waiting for a pet */}
            <View style={styles.emptyArt}>
              <View style={styles.emptyCardShape}>
                <View style={styles.emptyBar} />
                <View style={styles.emptyPlateRow}>
                  <View style={styles.emptyMiniPlate}>
                    <Text style={styles.emptyMiniInitial}>?</Text>
                  </View>
                  <View style={styles.emptyLines}>
                    <View style={[styles.emptyLine, { width: 52 }]} />
                    <View style={[styles.emptyLine, { width: 36 }]} />
                    <View style={[styles.emptyLine, { width: 44 }]} />
                  </View>
                </View>
              </View>
              <LinearGradient
                colors={['#FFD84D', '#FF9548']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyRule}
              />
            </View>
            <Text style={BS.cardTitleLg}>Add a pet first</Text>
            <Text style={BS.body}>
              Every card carries your pet’s own details — their name, their photo, the vet on their
              records and the notes you have already written. There is no demo pet in this space, so
              the first step is your own animal.
            </Text>
            <TouchableOpacity
              style={BS.btnPrimary}
              onPress={goAddPet}
              accessibilityLabel="Add a pet"
            >
              <Text style={BS.btnPrimaryText}>＋ Add a pet →</Text>
            </TouchableOpacity>
            <Text style={BS.caption}>
              Pets → ＋ Add. Then come back here and pick who needs a card.
            </Text>
          </View>

          <View style={BS.card}>
            <Text style={BS.cardKicker}>What goes on a card</Text>
            <View style={styles.waitingRow}>
              <Text style={styles.waitingGlyph}>🪪</Text>
              <View style={styles.waitingCopy}>
                <Text style={styles.waitingTitle}>Front — who they are</Text>
                <Text style={BS.caption}>
                  Photo, name, species and breed, age, weight, microchip, allergies and a small “if
                  found” line.
                </Text>
              </View>
            </View>
            <View style={[styles.waitingRow, styles.waitingRowLast]}>
              <Text style={styles.waitingGlyph}>☎️</Text>
              <View style={styles.waitingCopy}>
                <Text style={styles.waitingTitle}>Back — who to call</Text>
                <Text style={BS.caption}>
                  Vet and emergency vet, you and a co-parent, current medications, a behaviour note
                  and an offline QR with a plain-text summary.
                </Text>
              </View>
            </View>
            <Text style={BS.caption}>
              Card size is the real thing: 85.6 × 54 mm (ID-1), the size of a bank card.
            </Text>
          </View>

          <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
            Previewing is free, always. Making, downloading, printing and sharing the PDF are part
            of Blueprint Premium.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={[BS.pad, styles.pad]}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the shop">
          <Text style={BS.link}>‹ Shop</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Keepsake</Text>
        <Text style={BS.h1}>Emergency pet cards</Text>
        <Text style={BS.italic}>
          Wallet-sized cards that speak for your pet — every line from their own records, made on
          this device. No account, no server, nothing uploaded.
        </Text>

        {/* ---- whose cards ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Whose cards are these?</Text>
            <Text style={BS.caption}>
              {selectedIds.length} of {pets.length}
            </Text>
          </View>
          <View style={styles.petList}>
            {rows.map((row) => {
              const on = selectedIds.includes(row.petId);
              return (
                <TouchableOpacity
                  key={row.petId}
                  style={[styles.petRow, on && styles.petRowOn]}
                  onPress={() => toggle(row.petId)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.name}${on ? ' selected' : ''}`}
                  testID={`emergency-card-pet-${row.petId}`}
                >
                  <View style={[styles.thumb, on && styles.thumbOn]}>
                    {row.photoUri ? (
                      <Image source={{ uri: row.photoUri }} style={styles.thumbImg} resizeMode="cover" />
                    ) : (
                      <Text style={styles.thumbInitial}>{row.initial}</Text>
                    )}
                  </View>
                  <View style={styles.petCopy}>
                    <Text style={[styles.petName, on && styles.petNameOn]}>{row.name}</Text>
                    <Text style={[BS.caption, on && styles.petMarkerOn]}>{row.meta}</Text>
                    <Text style={[BS.caption, styles.petMissing]}>
                      {row.missing.length === 0
                        ? 'Everything the card asks for is on file.'
                        : `Card will print without: ${row.missing.slice(0, 3).join(', ')}${
                            row.missing.length > 3 ? `, +${row.missing.length - 3} more` : ''
                          }.`}
                    </Text>
                  </View>
                  <Text style={[styles.tick, on && styles.tickOn]}>{on ? '✓' : '＋'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.shortcutRow}>
            <TouchableOpacity
              style={styles.shortcut}
              onPress={selectAll}
              accessibilityLabel={`All ${pets.length} pets`}
            >
              <Text style={styles.shortcutText}>
                All {pets.length} {pets.length === 1 ? 'pet' : 'pets'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.shortcut}
              onPress={() => setSelectedIds([])}
              accessibilityLabel="Clear the selection"
            >
              <Text style={styles.shortcutText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <Text style={BS.caption}>
            Each chosen pet gets their own card — front and back. Two faces per card, so a card is
            never crowded.
          </Text>
        </View>

        {/* ---- the details only the owner knows ---- */}
        {detailPet && detailCard ? (
          <View style={BS.card}>
            <View style={BS.rowBetween}>
              <Text style={BS.cardKicker}>Card details</Text>
              <Text style={BS.caption}>kept on this device</Text>
            </View>
            {chosen.length > 1 ? (
              <View style={styles.detailPicker}>
                {chosen.map((candidate) => {
                  const on = candidate.id === detailPet.id;
                  return (
                    <TouchableOpacity
                      key={candidate.id}
                      style={[styles.detailChip, on && styles.detailChipOn]}
                      onPress={() => setDetailPetId(candidate.id)}
                      accessibilityLabel={`Details for ${candidate.name}`}
                    >
                      <Text style={[styles.detailChipText, on && styles.detailChipTextOn]}>
                        {candidate.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}
            <Text style={BS.body}>
              The app stores no phone numbers, no microchip field and no medical notes of its own —
              so these are yours to fill in, in your own words. Everything typed here stays on this
              phone and is reused every time you print for {detailPet.name}.
            </Text>
            {DETAIL_FIELDS.map((field) => {
              const value = details.forPet(detailPet.id)[field.key] ?? '';
              return (
                <View key={field.key} style={styles.field}>
                  <Text style={BS.fieldLabel}>{field.label}</Text>
                  <TextInput
                    style={[BS.input, field.multiline && styles.fieldMultiline]}
                    value={value}
                    onChangeText={(text) =>
                      details.update(detailPet.id, { [field.key]: text })
                    }
                    placeholder={field.placeholder}
                    placeholderTextColor={COLOR.textFaint}
                    multiline={field.multiline}
                    numberOfLines={field.multiline ? 3 : 1}
                    maxLength={120}
                    accessibilityLabel={`${field.label} for ${detailPet.name}`}
                    testID={`emergency-detail-${field.key}`}
                  />
                  {field.key === 'vetName' && recordVetName ? (
                    <Text style={BS.caption}>
                      From {detailPet.name}’s records: {recordVetName} — leave this blank and the card
                      uses it.
                    </Text>
                  ) : field.hint ? (
                    <Text style={BS.caption}>{field.hint}</Text>
                  ) : null}
                </View>
              );
            })}
            <Text style={BS.caption}>
              Anything left blank prints as “—” rather than as a guess. Nothing here is uploaded, and
              there is no server to upload it to.
            </Text>
          </View>
        ) : null}

        {/* ---- how it prints ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>How it prints</Text>
          <View style={styles.listList}>
            {EMERGENCY_PAPERS.map((entry) => {
              const on = entry.id === paper;
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.paperRow, on && styles.paperRowOn]}
                  onPress={() => setPaper(entry.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.label}${on ? ' selected' : ''}`}
                  testID={`emergency-paper-${entry.id}`}
                >
                  <Text style={[styles.paperTick, on && styles.paperTickOn]}>{on ? '●' : '○'}</Text>
                  <View style={styles.paperCopy}>
                    <Text style={[styles.paperTitle, on && styles.paperTitleOn]}>{entry.label}</Text>
                    <Text style={BS.caption}>
                      {entry.id === 'card'
                        ? 'One card face per page, page exactly 85.6 × 54 mm — the truest card, and what a print shop or a PDF export wants.'
                        : 'Eight cards per sheet at the same real size, with grey corner marks to cut along — what an ordinary home printer can feed.'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={BS.caption}>
            Both print at 100% — nothing is ever scaled to fit. A card is {CARD_WIDTH_MM} ×{' '}
            {CARD_HEIGHT_MM} mm (ID-1), the size of a bank card, on either choice.
          </Text>
        </View>

        {/* ---- the live preview ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Your cards</Text>
            <Text style={BS.caption}>{deck.sheets} {deck.sheets === 1 ? 'page' : 'pages'}</Text>
          </View>

          <View style={styles.previewBox}>
            {isWeb ? (
              <EmergencyWebFrame html={html} showPrintBar={false} />
            ) : deck.faces.length > 0 ? (
              <View style={styles.cardStack}>
                <EmergencyCardFace face={deck.faces[0]} width={canvasWidth} />
                {deck.faces[1] ? (
                  <EmergencyCardFace face={deck.faces[1]} width={canvasWidth} />
                ) : null}
              </View>
            ) : (
              <Text style={BS.italic}>
                Pick a pet above and their card appears here.
              </Text>
            )}
          </View>
          <Text style={BS.caption}>
            {deck.faces.length > 2
              ? `Showing the first card’s two faces — all ${deck.faces.length} faces are in the preview and the PDF.`
              : 'Exactly what prints — front, then back.'}{' '}
            The preview is free, always.
          </Text>
        </View>

        {/* ---- actions ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Your pack</Text>
          <Text style={BS.body}>{deck.summary}</Text>
          {deck.cards.length > 0 ? (
            <Text style={BS.caption}>
              {deck.title}. {deck.printNote}
            </Text>
          ) : null}

          <TouchableOpacity
            style={BS.btnPrimary}
            onPress={() => preview(false)}
            disabled={deck.cards.length === 0}
            accessibilityLabel="Preview the cards"
          >
            <Text style={BS.btnPrimaryText}>👀 Preview them full size</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            Free to look at, and free to change your mind — no rush at all.
          </Text>

          {!unlocked ? (
            <TouchableOpacity
              style={styles.lockRow}
              onPress={goToPremium}
              accessibilityLabel="Blueprint Premium"
            >
              <Text style={styles.lockEmoji}>🔒</Text>
              <View style={styles.lockCopy}>
                <Text style={styles.lockTitle}>Keepsake PDFs — Blueprint Premium</Text>
                <Text style={styles.lockText}>
                  Part of Blueprint Premium — start your 14-day free trial
                </Text>
                <Text style={BS.caption}>
                  Generate, download, print and share. Preview and customising stay free.
                </Text>
              </View>
            </TouchableOpacity>
          ) : isWeb ? (
            <>
              <TouchableOpacity
                style={BS.btnSecondary}
                onPress={() => preview(true)}
                accessibilityLabel="Print in the browser"
              >
                <Text style={BS.btnSecondaryText}>🖨️ Print</Text>
              </TouchableOpacity>
              <Text style={styles.webNote}>
                Print opens the preview and your browser’s own print dialog — the real sheets, ready
                to send to a printer at 100%. Making, downloading and sharing the PDF file itself
                works on your Android phone.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'generate' && styles.busy]}
                onPress={handleGenerate}
                disabled={busy !== null || deck.cards.length === 0}
              >
                {busy === 'generate' ? (
                  <ActivityIndicator color={COLOR.lavender} />
                ) : (
                  <Text style={BS.btnSecondaryText}>📄 Generate PDF</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'download' && styles.busy]}
                onPress={handleDownload}
                disabled={busy !== null || deck.cards.length === 0}
              >
                {busy === 'download' ? (
                  <ActivityIndicator color={COLOR.lavender} />
                ) : (
                  <Text style={BS.btnSecondaryText}>⬇️ Download a copy</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'print' && styles.busy]}
                onPress={handlePrint}
                disabled={busy !== null || deck.cards.length === 0}
              >
                {busy === 'print' ? (
                  <ActivityIndicator color={COLOR.lavender} />
                ) : (
                  <Text style={BS.btnSecondaryText}>🖨️ Print</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'share' && styles.busy]}
                onPress={handleShare}
                disabled={busy !== null || deck.cards.length === 0}
              >
                {busy === 'share' ? (
                  <ActivityIndicator color={COLOR.lavender} />
                ) : (
                  <Text style={BS.btnSecondaryText}>📤 Share</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={BS.caption}>
            PDFs are made on request only — the app keeps no copies. The file sits in the app’s
            temporary folder until you download, print or share it, and it is never uploaded.
          </Text>
        </View>

        {/* ---- the generated file ---- */}
        {generated ? (
          <View style={[BS.card, styles.generatedCard]}>
            <Text style={BS.cardKicker}>Made ✨</Text>
            <Text style={BS.rowLabel}>{generated.fileName}</Text>
            <Text style={BS.caption}>{deck.summary}</Text>
            <Text style={styles.pathText}>{generated.uri}</Text>
            <Text style={BS.caption}>
              Temporary, {formatBytes(generated.bytes)} — download, print or share it to keep a copy.
            </Text>
          </View>
        ) : null}

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          Made from your own records, on this device. The QR carries plain text only — no link, no
          app, no signal needed to read it. Nothing is uploaded, and the app has no server to send
          anything to.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingBottom: 120 },

  /* ---- the pet picker ---- */
  petList: { gap: SPACE.s2 },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
  },
  petRowOn: { borderColor: COLOR.lavender, backgroundColor: COLOR.brandSoft },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.input,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
  },
  thumbOn: { borderColor: COLOR.lavender },
  thumbImg: { width: '100%', height: '100%' },
  thumbInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: COLOR.blue,
    fontFamily: FONT_BODY,
  },
  petCopy: { flex: 1 },
  petName: { fontFamily: FONT_BODY, fontSize: 15.5, fontWeight: '700', color: COLOR.text },
  petNameOn: { color: COLOR.premiumDeep },
  petMarkerOn: { color: COLOR.premiumDeep },
  petMissing: { marginTop: 2 },
  tick: { fontSize: 18, fontWeight: '700', color: COLOR.textFaint },
  tickOn: { color: COLOR.premiumDeep },
  shortcutRow: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s3 },
  shortcut: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLOR.blue,
    backgroundColor: COLOR.surface,
  },
  shortcutText: { fontFamily: FONT_BODY, fontSize: 13.5, fontWeight: '700', color: COLOR.blue },

  /* ---- the details form ---- */
  detailPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s2 },
  detailChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
  },
  detailChipOn: { borderColor: COLOR.blue, backgroundColor: COLOR.brandSoft },
  detailChipText: { fontFamily: FONT_BODY, fontSize: 13, color: COLOR.text },
  detailChipTextOn: { color: COLOR.accent700, fontWeight: '700' },
  field: { marginTop: SPACE.s3, gap: 4 },
  fieldMultiline: { minHeight: 76, paddingTop: SPACE.s2, textAlignVertical: 'top' },

  /* ---- how it prints ---- */
  listList: { gap: SPACE.s2, marginTop: SPACE.s2 },
  paperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACE.s2,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
  },
  paperRowOn: { borderColor: COLOR.blue, backgroundColor: COLOR.brandSoft },
  paperTick: { fontSize: 14, color: COLOR.textFaint, marginTop: 2 },
  paperTickOn: { color: COLOR.blue },
  paperCopy: { flex: 1 },
  paperTitle: { fontFamily: FONT_BODY, fontSize: 14.5, fontWeight: '700', color: COLOR.text },
  paperTitleOn: { color: COLOR.accent700 },

  /* ---- the live preview ---- */
  previewBox: {
    backgroundColor: COLOR.surfaceSoft,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    padding: SPACE.s2,
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 220,
  },
  cardStack: { gap: SPACE.s3 },

  /* ---- actions ---- */
  busy: { opacity: 0.6 },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLOR.surfaceSoft,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: RADIUS.cardSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: SPACE.s2,
    gap: SPACE.s2,
  },
  lockEmoji: { fontSize: 20 },
  lockCopy: { flex: 1, gap: 2 },
  lockTitle: { fontSize: 14, fontWeight: '700', color: COLOR.text },
  lockText: { fontSize: 13, fontWeight: '600', color: COLOR.premiumDeep },
  webNote: {
    fontSize: 12.5,
    color: COLOR.textMuted,
    lineHeight: 18,
    backgroundColor: COLOR.surfaceSoft,
    borderRadius: RADIUS.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: SPACE.s2,
  },
  generatedCard: { ...SHADOW.card },
  pathText: { fontSize: 11.5, color: COLOR.textFaint },

  /* ---- the illustrated empty state ---- */
  emptyArt: {
    height: 150,
    borderRadius: RADIUS.cardSm,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyCardShape: {
    width: 148,
    height: 94,
    borderRadius: RADIUS.input,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    overflow: 'hidden',
    paddingTop: 12,
  },
  emptyBar: { position: 'absolute', left: 0, right: 0, top: 0, height: 5, backgroundColor: COLOR.blue, opacity: 0.85 },
  emptyPlateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  emptyMiniPlate: {
    width: 34,
    height: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.surfaceSoft,
  },
  emptyMiniInitial: { fontSize: 18, fontWeight: '700', color: COLOR.blue, fontFamily: FONT_BODY },
  emptyLines: { gap: 6, flex: 1 },
  emptyLine: { height: 6, borderRadius: 3, backgroundColor: COLOR.divider },
  emptyRule: { width: 64, height: 3, borderRadius: 999, marginTop: SPACE.s3 },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  waitingRowLast: { borderBottomWidth: 0 },
  waitingGlyph: { fontSize: 20 },
  waitingCopy: { flex: 1 },
  waitingTitle: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600', color: COLOR.text },
});
