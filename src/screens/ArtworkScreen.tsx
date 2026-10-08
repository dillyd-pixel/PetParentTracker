/**
 * Custom Pet Artwork — the Keep screen (Keepsakes → Custom pet artwork), and the
 * app's third finished upsell product (3/4).
 *
 * What it does, all on the device:
 *  - choose ONE pet — only the pets that already have a photo can be framed, and
 *    a pet with no photo yet is named honestly with a way to fix it (never hidden,
 *    and never filled in with a demo pet);
 *  - pick one of five treatments, with the piece redrawing live as they switch;
 *  - write an optional caption in their own words;
 *  - choose US Letter or A4;
 *  - look at the finished piece for free, and, with Blueprint Premium, Generate
 *    the PDF · Download a copy · Print · Share it.
 *
 * Where the picture comes from: the SAME store the rest of the app uses — the
 * pet's own photo, the name they were given, the owner's own words and the name
 * in Settings for nothing but its absence (this product signs nothing). There is
 * no fetch, no server, no AI and no account anywhere in this feature: the "art"
 * is the template, and the sheet is rendered from an HTML string on this device.
 *
 * Tone: this is a keepsake. The preview is always free, the copy never counts a
 * "missed" anything, and nothing asks for a purchase to look at the piece.
 *
 * No file accumulates: the PDF is written to the app's temporary folder only when
 * the owner asks for it, the previous temporary file is removed first, and a copy
 * is saved somewhere visible only when the owner Downloads it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import { ArtworkCanvas } from '../components/ArtworkCanvas';
import { ArtworkWebFrame } from '../components/ArtworkWebFrame';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import {
  ARTWORK_TEMPLATES,
  DEFAULT_ARTWORK_TEMPLATE_ID,
  type ArtworkTemplateId,
} from '../pdf/artwork/templates';
import { artworkSummary, petsWithPhoto, petsWithoutPhoto } from '../pdf/artwork/document';
import type { ArtworkConfig } from '../pdf/artwork/document';
import { useArtworkBuilders } from '../pdf/artwork/useArtworkDocument';
import {
  artworkFileName,
  deleteTempFile,
  formatBytes,
  generateArtworkPdf,
  printArtworkPdf,
  saveArtworkPdf,
  shareArtworkPdf,
} from '../pdf/artwork/artworkFile';
import { PAPER_SIZES, type PaperSize } from '../pdf/planner/sections';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import type { MainTabParamList, RootStackParamList } from '../navigation/RootNavigator';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, RADIUS, SHADOW, SPACE } from '../theme';

/** What the screen is doing right now (so only one action runs at a time). */
type BusyAction = 'generate' | 'download' | 'print' | 'share' | null;

/**
 * This screen's navigation: its own Shop stack, plus the tab and root routes it
 * may bubble up to (the empty state sends the owner to the pet's page in the
 * Pets tab to add a photo). Type-only, so nothing is imported at runtime.
 */
type ArtworkNavigation = NativeStackNavigationProp<
  ShopStackParamList & MainTabParamList & RootStackParamList
>;

/** The PDF generated this visit, if one has been made. */
interface GeneratedInfo {
  uri: string;
  bytes: number;
  fileName: string;
  /** e.g. "Bella · Polaroid · US Letter". */
  summary: string;
}

/** How wide a template thumbnail is drawn, in points. */
const THUMB_WIDTH = 72;

export default function ArtworkScreen(): React.JSX.Element {
  const navigation = useNavigation<ArtworkNavigation>();
  const { pets, activePet } = usePets();
  const premium = usePremium();
  const unlocked = premium.isPremium();
  const builders = useArtworkBuilders();
  const { width } = useWindowDimensions();

  /** The pets that can be framed — the ones with a photo on file. */
  const framable = useMemo(() => petsWithPhoto(builders.source.pets), [builders.source.pets]);
  /** The pets that cannot yet — named honestly, with a way to fix it. */
  const waiting = useMemo(() => petsWithoutPhoto(builders.source.pets), [builders.source.pets]);

  const [petId, setPetId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<ArtworkTemplateId>(DEFAULT_ARTWORK_TEMPLATE_ID);
  const [paper, setPaper] = useState<PaperSize>('letter');
  const [caption, setCaption] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [generated, setGenerated] = useState<GeneratedInfo | null>(null);
  /** The temp file from the last "Generate" — deleted before a new one is made. */
  const lastTempRef = useRef<string | null>(null);

  const isWeb = Platform.OS === 'web';

  /* ---- the owner's choice, resolved into one pet ---- */
  const pet = useMemo(() => {
    const chosen = framable.find((candidate) => candidate.id === petId);
    if (chosen) return chosen;
    const active = framable.find((candidate) => candidate.id === activePet?.id);
    return active ?? framable[0] ?? null;
  }, [framable, petId, activePet]);

  /**
   * The pet's photo as the sheet needs it: inlined as a `data:` URI on a device
   * (so the printed page carries the picture), passed straight through in a
   * browser. A photo that cannot be read resolves to null and the sheet says so
   * honestly rather than breaking.
   */
  useEffect(() => {
    let alive = true;
    builders.resolvePhoto(pet?.photoUri).then((resolved) => {
      if (alive) setPhoto(resolved);
    });
    return () => {
      alive = false;
    };
  }, [builders, pet?.photoUri]);

  const config = useMemo<ArtworkConfig>(
    () => ({ petId: pet?.id ?? null, templateId, paper, caption, photo }),
    [pet?.id, templateId, paper, caption, photo],
  );
  const doc = useMemo(() => builders.document(config), [builders, config]);
  const html = useMemo(() => (isWeb ? builders.html(config) : ''), [builders, config, isWeb]);
  const summary = useMemo(() => artworkSummary(doc), [doc]);

  /** The canvas is as wide as the card allows, and never a stretched poster. */
  const canvasWidth = useMemo(
    () => Math.max(180, Math.min(width - 2 * SPACE.s4 - 1, 420)),
    [width],
  );

  const goToPremium = useCallback(() => {
    try {
      navigation.navigate('Premium');
    } catch {
      // Navigation must never crash the screen — the lock row stays visible.
    }
  }, [navigation]);

  /** Send the owner to the pet's page, where a photo is added. */
  const goAddPhoto = useCallback(
    (targetId: string) => {
      try {
        navigation.navigate('Pets', { screen: 'PetProfile', params: { petId: targetId } });
      } catch {
        // The guidance above still says exactly where the photo goes.
      }
    },
    [navigation],
  );

  const preview = useCallback(() => {
    navigation.navigate('ArtworkPreview', {
      petId: pet?.id ?? null,
      templateId,
      paper,
      caption,
    });
  }, [navigation, pet?.id, templateId, paper, caption]);

  /**
   * Web print: the browser can't save the PDF file for us, but it CAN print the
   * sheet — so this opens the preview (which renders the real print HTML) and
   * asks it to open the browser's print dialog once the document has loaded.
   */
  const handleWebPrint = useCallback(() => {
    navigation.navigate('ArtworkPreview', {
      petId: pet?.id ?? null,
      templateId,
      paper,
      caption,
      autoPrint: true,
    });
  }, [navigation, pet?.id, templateId, paper, caption]);

  /* ---- the file actions (native; the web shows a friendly note instead) ---- */

  /**
   * Render the PDF for the current choices. Any previously generated temporary
   * file is removed first, so nothing piles up in the app's temporary folder.
   */
  const ensurePdf = useCallback(async () => {
    deleteTempFile(lastTempRef.current);
    const pdf = await generateArtworkPdf(builders.html(config), paper);
    lastTempRef.current = pdf.uri;
    return pdf;
  }, [builders, config, paper]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    setBusy('generate');
    try {
      const pdf = await ensurePdf();
      const fileName = artworkFileName(pet?.name ?? 'pet', templateId);
      setGenerated({ uri: pdf.uri, bytes: pdf.bytes, fileName, summary });
      Alert.alert(
        'Your artwork is ready ✨',
        `${summary}.\n\nTemporary file (${formatBytes(pdf.bytes)}):\n${pdf.uri}\n\nIt lives in the app's temporary folder. Download, print or share it to keep a copy — nothing is uploaded, ever.`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t make the artwork',
        e instanceof Error ? e.message : 'Something went wrong building the PDF. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, pet, templateId, summary]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('download');
    try {
      const { uri, base64, bytes } = await ensurePdf();
      const fileName = artworkFileName(pet?.name ?? 'pet', templateId);
      const savedTo = await saveArtworkPdf({ uri, base64, fileName });
      if (!savedTo) return; // the owner cancelled the folder picker
      setGenerated({ uri: savedTo, bytes, fileName, summary });
      Alert.alert(
        'Saved 🎉',
        Platform.OS === 'android'
          ? `${fileName} (${formatBytes(bytes)}) is in the folder you chose (your Downloads folder, by default).`
          : `${fileName} (${formatBytes(bytes)}) was saved on this device:\n${savedTo}`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t save the artwork',
        e instanceof Error ? e.message : 'Something went wrong saving the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, pet, templateId, summary]);

  const handlePrint = useCallback(async () => {
    if (busy) return;
    setBusy('print');
    try {
      await printArtworkPdf(builders.html(config));
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
      const title = artworkFileName(pet?.name ?? 'pet', templateId);
      const shared = await shareArtworkPdf(uri, title);
      if (!shared) {
        Alert.alert(
          'Sharing isn’t available here',
          `The artwork (${formatBytes(bytes)}) is saved on this device:\n${uri}`,
        );
      }
    } catch (e) {
      Alert.alert(
        'Couldn’t share the artwork',
        e instanceof Error ? e.message : 'Something went wrong sharing the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, pet, templateId]);

  /* ---- no pets at all ---- */
  if (pets.length === 0) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the shop">
            <Text style={BS.link}>‹ Shop</Text>
          </TouchableOpacity>
          <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Keepsake</Text>
          <Text style={BS.h1}>Custom pet artwork</Text>
          <Text style={BS.italic}>
            Add a pet first — every piece is framed from a photo of your own pet, so there is
            nothing to frame yet.
          </Text>
        </ScrollView>
      </View>
    );
  }

  /* ---- pets, but none with a photo yet: the illustrated way forward ---- */
  if (framable.length === 0) {
    const first = waiting[0];
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={[BS.pad, styles.pad]}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to the shop">
            <Text style={BS.link}>‹ Shop</Text>
          </TouchableOpacity>
          <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Keepsake</Text>
          <Text style={BS.h1}>Custom pet artwork</Text>
          <Text style={BS.italic}>
            Five looks, one photo — framed on this device and printed at home. No account, no
            server, nothing uploaded.
          </Text>

          <View style={BS.card}>
            {/* the illustration: an empty frame, waiting for a photo */}
            <View style={styles.emptyArt}>
              <View style={styles.emptyPlate}>
                <Text style={styles.emptyFrameGlyph}>🖼️</Text>
                <Text style={styles.emptyBadge}>{first ? petEmojiFor(first) : '🐾'}</Text>
              </View>
              <LinearGradient
                colors={['#9B78FF', '#246BFD']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.emptyRule}
              />
              <Text style={styles.emptyPaw}>🐾</Text>
              <Text style={[styles.emptyPaw, styles.emptyPawTwo]}>🐾</Text>
              <Text style={styles.emptySpark}>✦</Text>
            </View>

            <Text style={BS.cardTitleLg}>Add a photo, then pick a look</Text>
            <Text style={BS.body}>
              Every piece here is framed from a photo you already keep in the app. There is no demo
              pet in this space and nothing is drawn in for you — so the first step is a picture of
              your own animal.
            </Text>
            <Text style={BS.caption}>
              {waiting.length === 1
                ? `${waiting[0].name} has no photo yet.`
                : `${waiting.map((candidate) => candidate.name).join(', ')} have no photo yet.`}{' '}
              Add one on their page and they can wear any of the five looks — Polaroid, watercolour,
              midnight, golden hour or paws.
            </Text>
            {first ? (
              <TouchableOpacity
                style={BS.btnPrimary}
                onPress={() => goAddPhoto(first.id)}
                accessibilityLabel={`Add a photo to ${first.name}'s page`}
              >
                <Text style={BS.btnPrimaryText}>
                  Add a photo to {first.name}’s page →
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={BS.caption}>
              Pets → tap {first ? first.name : 'a pet'} → the photo plate. Then come back here and
              they will be waiting in the list.
            </Text>
          </View>

          <View style={BS.card}>
            <Text style={BS.cardKicker}>The five looks, waiting</Text>
            {ARTWORK_TEMPLATES.map((template) => (
              <View key={template.id} style={styles.waitingRow}>
                <Text style={styles.waitingGlyph}>🖼️</Text>
                <View style={styles.waitingCopy}>
                  <Text style={styles.waitingTitle}>{template.title}</Text>
                  <Text style={BS.caption}>{template.hint}</Text>
                </View>
              </View>
            ))}
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
        <Text style={BS.h1}>Custom pet artwork</Text>
        <Text style={BS.italic}>
          Your pet’s own photo, framed in one of five looks and printed at home — a polaroid, a
          painted wash, a midnight portrait, a golden-hour arch or a paw print frame. Made on this
          device: no account, no server, nothing uploaded.
        </Text>

        {/* ---- pet ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Whose portrait is this?</Text>
          <View style={styles.petList}>
            {framable.map((candidate) => {
              const chosen = pet?.id === candidate.id;
              return (
                <TouchableOpacity
                  key={candidate.id}
                  style={[styles.petRow, chosen && styles.petRowOn]}
                  onPress={() => setPetId(candidate.id)}
                  accessibilityLabel={`${candidate.name}${chosen ? ' selected' : ''}`}
                >
                  <Text style={styles.petEmoji}>{petEmojiFor(candidate)}</Text>
                  <View style={styles.petCopy}>
                    <Text style={[styles.petName, chosen && styles.petNameOn]}>
                      {candidate.name}
                    </Text>
                    <Text style={[BS.caption, chosen && styles.petMarkerOn]}>
                      photo on file — ready to frame
                    </Text>
                  </View>
                  {chosen ? <Text style={styles.petTick}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {waiting.length > 0 && (
            <Text style={BS.caption}>
              {waiting.length === 1
                ? `${waiting[0].name} has no photo yet`
                : `${waiting.map((candidate) => candidate.name).join(', ')} have no photo yet`}{' '}
              — add one on their page and they will show up here too. Nothing is faked in the
              meantime.
            </Text>
          )}
        </View>

        {/* ---- the piece: the live preview and the five looks ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Your artwork</Text>
            <Text style={BS.caption}>{doc.template.title}</Text>
          </View>

          <View style={styles.previewBox}>
            {isWeb ? (
              <ArtworkWebFrame html={html} showPrintBar={false} />
            ) : (
              <ArtworkCanvas doc={doc} width={canvasWidth} photoUri={pet?.photoUri ?? null} />
            )}
          </View>
          <Text style={BS.caption}>
            {photo
              ? 'Exactly what prints — your photo, in this frame.'
              : 'Your photo could not be read just now, so the sheet shows where it will print. Add it again on their page and it will appear here.'}
          </Text>

          <Text style={[BS.caption, styles.looksLabel]}>Pick a look</Text>
          <View style={styles.looks}>
            {ARTWORK_TEMPLATES.map((template) => {
              const chosen = template.id === templateId;
              return (
                <TouchableOpacity
                  key={template.id}
                  style={styles.look}
                  onPress={() => setTemplateId(template.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${template.title}${chosen ? ' selected' : ''}`}
                  testID={`artwork-template-${template.id}`}
                >
                  <View style={[styles.lookThumb, chosen && styles.lookThumbOn]}>
                    <ArtworkCanvas
                      doc={builders.document({ ...config, templateId: template.id })}
                      width={THUMB_WIDTH}
                      photoUri={pet?.photoUri ?? null}
                      footer={false}
                      placeholder={false}
                    />
                  </View>
                  <Text style={[styles.lookLabel, chosen && styles.lookLabelOn]} numberOfLines={2}>
                    {template.title.split(' ').slice(0, 2).join(' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={BS.caption}>
            {doc.template.hint} {doc.template.blurb}
          </Text>
        </View>

        {/* ---- the owner's own words ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>A caption, in your own words</Text>
          <Text style={BS.caption}>
            Optional. It prints under their name — a nickname, a date, the thing only you would
            know. Left blank, the piece prints their name and nothing else: the app never writes
            words for you.
          </Text>
          <TextInput
            style={styles.captionInput}
            value={caption}
            onChangeText={setCaption}
            multiline
            numberOfLines={3}
            maxLength={120}
            placeholder={pet ? `Queen of the sunny spot on the stairs` : 'A few words'}
            placeholderTextColor={COLOR.textFaint}
            accessibilityLabel="A caption, in your own words"
          />
          <Text style={BS.caption}>
            {caption.trim().length > 0
              ? `${caption.trim().length} of 120 characters`
              : 'No caption yet — only their name will print.'}
          </Text>
        </View>

        {/* ---- paper ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Paper size</Text>
          <View style={BS.seg}>
            {PAPER_SIZES.map((size) => (
              <TouchableOpacity
                key={size.id}
                style={[BS.segOpt, paper === size.id && BS.segOptActive]}
                onPress={() => setPaper(size.id)}
                accessibilityLabel={size.label}
              >
                <Text style={paper === size.id ? BS.segTextActive : BS.segText}>{size.short}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={BS.caption}>
            {paper === 'a4'
              ? 'A4 · 210 × 297 mm — the sheet is set to A4, on paper and on screen.'
              : 'US Letter · 8.5 × 11 in — the sheet is set to Letter, on paper and on screen.'}
          </Text>
        </View>

        {/* ---- actions ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Your piece</Text>
          <Text style={BS.body}>{summary}</Text>

          <TouchableOpacity
            style={BS.btnPrimary}
            onPress={preview}
            accessibilityLabel="Preview the artwork"
          >
            <Text style={BS.btnPrimaryText}>👀 Preview it full size</Text>
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
                onPress={handleWebPrint}
                accessibilityLabel="Print in the browser"
              >
                <Text style={BS.btnSecondaryText}>🖨️ Print</Text>
              </TouchableOpacity>
              <Text style={styles.webNote}>
                Print opens the preview and your browser’s own print dialog — the real sheet, ready
                to send to a printer or save as PDF. Making, downloading and sharing the PDF file
                itself works on your Android phone.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'generate' && styles.busy]}
                onPress={handleGenerate}
                disabled={busy !== null}
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
                disabled={busy !== null}
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
                disabled={busy !== null}
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
                disabled={busy !== null}
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
        {generated && (
          <View style={[BS.card, styles.generatedCard]}>
            <Text style={BS.cardKicker}>Made ✨</Text>
            <Text style={BS.rowLabel}>{generated.fileName}</Text>
            <Text style={BS.caption}>{generated.summary}</Text>
            <Text style={styles.pathText}>{generated.uri}</Text>
            <Text style={BS.caption}>
              Temporary, {formatBytes(generated.bytes)} — download, print or share it to keep a
              copy.
            </Text>
          </View>
        )}

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          Made and printed from your own photo, on this device. Nothing is uploaded, and the app
          has no server to send it to.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingBottom: 120 },
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
  petEmoji: { fontSize: 22 },
  petCopy: { flex: 1 },
  petName: { fontFamily: FONT_BODY, fontSize: 15.5, fontWeight: '700', color: COLOR.text },
  petNameOn: { color: COLOR.premiumDeep },
  petMarkerOn: { color: COLOR.premiumDeep },
  petTick: { fontSize: 16, fontWeight: '700', color: COLOR.premiumDeep },

  /* ---- the live preview ---- */
  /** A window onto the sheet: the real print HTML on the web, the canvas on a phone. */
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
  looksLabel: { marginTop: SPACE.s2 },
  looks: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginTop: SPACE.s1 },
  look: { width: THUMB_WIDTH + 10, alignItems: 'center', gap: 4 },
  lookThumb: {
    borderRadius: RADIUS.thumb,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    ...SHADOW.card,
  },
  lookThumbOn: { borderColor: COLOR.blue },
  lookLabel: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    color: COLOR.textMuted,
  },
  lookLabelOn: { color: COLOR.accent700, fontWeight: '700' },

  /* ---- the caption ---- */
  captionInput: {
    ...BS.input,
    minHeight: 84,
    paddingTop: SPACE.s2,
    textAlignVertical: 'top',
  },

  /* ---- the illustrated "no photo yet" state ---- */
  emptyArt: {
    height: 150,
    borderRadius: RADIUS.cardSm,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  emptyPlate: {
    width: 92,
    height: 92,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFrameGlyph: { fontSize: 34, lineHeight: 42, opacity: 0.55 },
  emptyBadge: { position: 'absolute', right: 2, bottom: 0, fontSize: 22 },
  emptyRule: {
    width: 64,
    height: 3,
    borderRadius: 999,
    marginTop: SPACE.s3,
  },
  emptyPaw: { position: 'absolute', left: 18, bottom: 16, fontSize: 18, opacity: 0.5 },
  emptyPawTwo: { left: 34, bottom: 30, fontSize: 12, opacity: 0.4 },
  emptySpark: { position: 'absolute', right: 22, top: 18, fontSize: 16, color: COLOR.sunshine },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  waitingGlyph: { fontSize: 20, opacity: 0.5 },
  waitingCopy: { flex: 1 },
  waitingTitle: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600', color: COLOR.text },

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
});
