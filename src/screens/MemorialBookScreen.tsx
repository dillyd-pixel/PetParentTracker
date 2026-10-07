/**
 * Pet Memorial Book — the Keep screen (Keepsakes → Memorial book), and the
 * app's second finished upsell product (2/4).
 *
 * What it does, all on the device:
 *  - choose ONE pet — the pets that already have memories, a photo or
 *    milestones are marked, and a pet with nothing on file is honestly marked
 *    as a blank book rather than hidden or filled with demo data;
 *  - toggle each of the book's six sections (all on by default);
 *  - write an optional note of your own, printed as a letter;
 *  - pick US Letter or A4;
 *  - Preview the finished book (free), and, with Blueprint Premium, Generate the
 *    PDF · Download a copy · Print · Share.
 *
 * Where the content comes from: the SAME stores the rest of the app uses — the
 * pet's own profile and photo, the journal (memories and written entries alike),
 * the awards shelf, care check-ins, vet records and vaccinations. Nothing is
 * re-typed, nothing is invented, and a section with no data prints a warm,
 * honest note instead of a blank page. There is no fetch, no server, no AI and
 * no account anywhere in this feature: the book is rendered from an HTML string
 * on this device.
 *
 * Tone: this is a keepsake. The copy is warm and never pressuring — nothing here
 * celebrates an absence, counts a "missed" anything, or asks for a purchase to
 * see the book. The preview is always free; ticking off the PDF actions is the
 * only thing behind Blueprint Premium, exactly as with the printable planner.
 *
 * No file accumulates: the PDF is written to the app's temporary folder only when
 * the owner asks for it, the previous temporary file is removed first, and a copy
 * is saved somewhere visible only when the owner Downloads it.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { useMemorialBuilders } from '../pdf/memorial/useMemorialDocument';
import { memorialContentSummary } from '../pdf/memorial/document';
import type { MemorialContentSummary } from '../pdf/memorial/document';
import {
  MEMORIAL_SECTIONS,
  type MemorialSectionId,
} from '../pdf/memorial/sections';
import { PAPER_SIZES, type PaperSize } from '../pdf/planner/sections';
import {
  deleteTempFile,
  formatBytes,
  generateMemorialPdf,
  memorialFileName,
  printMemorialPdf,
  saveMemorialPdf,
  shareMemorialPdf,
} from '../pdf/memorial/memorialFile';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, RADIUS, SHADOW, SPACE } from '../theme';

/** What the screen is doing right now (so only one action runs at a time). */
type BusyAction = 'generate' | 'download' | 'print' | 'share' | null;

/** The PDF generated this visit, if one has been made. */
interface GeneratedInfo {
  uri: string;
  bytes: number;
  fileName: string;
  /** e.g. "Bella · US Letter · 6 of 6 pages". */
  summary: string;
}

/** A compact, honest marker for what a pet's book would have to print. */
function markerFor(summary: MemorialContentSummary): string {
  if (summary.total === 0) return 'a blank book — a lovely place to start';
  const parts: string[] = [];
  if (summary.pictures > 0) {
    parts.push(`${summary.pictures} photo ${summary.pictures === 1 ? 'memory' : 'memories'}`);
  }
  const written = summary.journal - summary.pictures;
  if (written > 0) parts.push(`${written} written ${written === 1 ? 'entry' : 'entries'}`);
  if (summary.milestones > 0) parts.push(`${summary.milestones} milestones`);
  if (summary.records > 0) parts.push(`${summary.records} dated records`);
  if (summary.petPhoto > 0) parts.push('a photo of them');
  return parts.join(' · ');
}

export default function MemorialBookScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { pets, activePet } = usePets();
  const premium = usePremium();
  const unlocked = premium.isPremium();
  const builders = useMemorialBuilders();
  const source = builders.source;

  const [petId, setPetId] = useState<string | null>(activePet?.id ?? pets[0]?.id ?? null);
  const [paper, setPaper] = useState<PaperSize>('letter');
  const [offIds, setOffIds] = useState<MemorialSectionId[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [generated, setGenerated] = useState<GeneratedInfo | null>(null);
  /** The temp file from the last "Generate" — deleted before a new one is made. */
  const lastTempRef = useRef<string | null>(null);

  const isWeb = Platform.OS === 'web';

  /* ---- the owner's choice, resolved into one pet ---- */
  const pet = useMemo(() => {
    const chosen = pets.find((candidate) => candidate.id === petId);
    return chosen ?? activePet ?? pets[0] ?? null;
  }, [pets, petId, activePet]);

  const sectionIds = useMemo(
    () => MEMORIAL_SECTIONS.map((section) => section.id).filter((id) => !offIds.includes(id)),
    [offIds],
  );

  const config = useMemo(
    () => ({ petId: pet?.id ?? null, sectionIds, paper, note }),
    [pet?.id, sectionIds, paper, note],
  );

  const summary = useMemo(() => {
    const petPart = pet ? pet.name : 'No pet selected';
    const paperPart = paper === 'a4' ? 'A4' : 'US Letter';
    return `${petPart} · ${paperPart} · ${sectionIds.length} of ${MEMORIAL_SECTIONS.length} pages`;
  }, [pet, paper, sectionIds.length]);

  /** Every pet's material, counted once per render for the picker's markers. */
  const markers = useMemo(() => {
    const entries: Array<[string, MemorialContentSummary]> = pets.map((candidate) => [
      candidate.id,
      memorialContentSummary(candidate, source),
    ]);
    return new Map(entries);
  }, [pets, source]);

  const toggleSection = useCallback((id: MemorialSectionId) => {
    setOffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const goToPremium = useCallback(() => {
    try {
      navigation.navigate('Premium');
    } catch {
      // Navigation must never crash the screen — the lock row stays visible.
    }
  }, [navigation]);

  const preview = useCallback(() => {
    navigation.navigate('MemorialBookPreview', { petId: pet?.id ?? null, sectionIds, paper, note });
  }, [navigation, pet?.id, sectionIds, paper, note]);

  /**
   * Web print: the browser can't save the PDF file for us, but it CAN print the
   * book — so this opens the preview (which renders the real print HTML) and asks
   * it to open the browser's print dialog once the document has loaded.
   */
  const handleWebPrint = useCallback(() => {
    navigation.navigate('MemorialBookPreview', {
      petId: pet?.id ?? null,
      sectionIds,
      paper,
      note,
      autoPrint: true,
    });
  }, [navigation, pet?.id, sectionIds, paper, note]);

  /* ---- the file actions (native; the web shows a friendly note instead) ---- */

  /**
   * Render the PDF for the current choices. Any previously generated temporary
   * file is removed first, so nothing piles up in the app's temporary folder.
   */
  const ensurePdf = useCallback(async () => {
    const html = builders.html(config);
    deleteTempFile(lastTempRef.current);
    const pdf = await generateMemorialPdf(html, paper);
    lastTempRef.current = pdf.uri;
    return pdf;
  }, [builders, config, paper]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    setBusy('generate');
    try {
      const html = builders.html(config);
      deleteTempFile(lastTempRef.current);
      const pdf = await generateMemorialPdf(html, paper);
      lastTempRef.current = pdf.uri;
      const fileName = memorialFileName(pet?.name ?? 'pet');
      setGenerated({ uri: pdf.uri, bytes: pdf.bytes, fileName, summary });
      Alert.alert(
        'Your book is ready ✨',
        `${summary}.\n\nTemporary file (${formatBytes(pdf.bytes)}):\n${pdf.uri}\n\nIt lives in the app's temporary folder. Download, print or share it to keep a copy — nothing is uploaded, ever.`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t make the book',
        e instanceof Error ? e.message : 'Something went wrong building the PDF. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, builders, config, paper, pet, summary]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('download');
    try {
      const { uri, base64, bytes } = await ensurePdf();
      const fileName = memorialFileName(pet?.name ?? 'pet');
      const savedTo = await saveMemorialPdf({ uri, base64, fileName });
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
        'Couldn’t save the book',
        e instanceof Error ? e.message : 'Something went wrong saving the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, pet, summary]);

  const handlePrint = useCallback(async () => {
    if (busy) return;
    setBusy('print');
    try {
      const html = builders.html(config);
      await printMemorialPdf(html);
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
      const title = memorialFileName(pet?.name ?? 'pet');
      const shared = await shareMemorialPdf(uri, title);
      if (!shared) {
        Alert.alert(
          'Sharing isn’t available here',
          `The book (${formatBytes(bytes)}) is saved on this device:\n${uri}`,
        );
      }
    } catch (e) {
      Alert.alert(
        'Couldn’t share the book',
        e instanceof Error ? e.message : 'Something went wrong sharing the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, pet]);

  /* ---- no pets yet ---- */
  if (pets.length === 0) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to the shop"
          >
            <Text style={BS.link}>‹ Shop</Text>
          </TouchableOpacity>
          <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Keepsake</Text>
          <Text style={BS.h1}>Memorial book</Text>
          <Text style={BS.italic}>
            Add a pet first — the book is built from that pet’s own memories and records, so there
            is nothing to gather yet.
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
        <Text style={BS.h1}>Memorial book</Text>
        <Text style={BS.italic}>
          A keepsake book made from the memories and records you already keep — their photos, your
          words, their milestones and the whole timeline of their life. Print it, or keep it on the
          phone. Made on this device: no account, no server, nothing uploaded.
        </Text>

        {/* ---- pet ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Whose story is this?</Text>
          <View style={styles.petList}>
            {pets.map((candidate) => {
              const chosen = pet?.id === candidate.id;
              const marker = markers.get(candidate.id);
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
                      {marker ? markerFor(marker) : 'a blank book — a lovely place to start'}
                    </Text>
                  </View>
                  {chosen ? <Text style={styles.petTick}>✓</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={BS.caption}>
            One pet, one book. Nothing on file is ever invented or filled in for you — a pet with
            little written down yet gets a shorter, honest book you can add to later.
          </Text>
        </View>

        {/* ---- sections ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Pages</Text>
            <Text style={BS.caption}>
              {sectionIds.length} of {MEMORIAL_SECTIONS.length} on
            </Text>
          </View>
          <Text style={BS.caption}>
            Every page is on to start. Switch off anything you would rather not print.
          </Text>
          {MEMORIAL_SECTIONS.map((section) => {
            const on = !offIds.includes(section.id);
            return (
              <View key={section.id} style={styles.toggleRow}>
                <View style={styles.toggleCopy}>
                  <Text style={styles.toggleLabel}>
                    {section.emoji} {section.title}
                  </Text>
                  <Text style={BS.caption}>{section.hint}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={() => toggleSection(section.id)}
                  trackColor={{ true: COLOR.lavender, false: COLOR.divider }}
                  thumbColor={COLOR.white}
                  accessibilityLabel={`${section.title} page`}
                />
              </View>
            );
          })}
          {offIds.length > 0 && (
            <TouchableOpacity
              onPress={() => setOffIds([])}
              accessibilityLabel="Turn every page on"
            >
              <Text style={[BS.link, { marginTop: SPACE.s2 }]}>Turn every page back on</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ---- the note ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>A note from you</Text>
          <Text style={BS.caption}>
            Optional, and yours alone — a few words to them, a memory you do not want to lose, or
            simply something you would like said. It prints as a letter on its own page, signed off
            with the name in Settings.
          </Text>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={6}
            placeholder="You came home and the house was yours…"
            placeholderTextColor={COLOR.textFaint}
            accessibilityLabel="A note from you"
          />
          <Text style={BS.caption}>
            Left blank, that page prints as a warm, line-ruled space for a hand-written letter — the
            app never writes words for you.
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
                <Text style={paper === size.id ? BS.segTextActive : BS.segText}>
                  {size.short}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={BS.caption}>
            {paper === 'a4'
              ? 'A4 · 210 × 297 mm — the book is set to A4, on paper and on screen.'
              : 'US Letter · 8.5 × 11 in — the book is set to Letter, on paper and on screen.'}
          </Text>
        </View>

        {/* ---- actions ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Your book</Text>
          <Text style={BS.body}>{summary}</Text>

          <TouchableOpacity
            style={BS.btnPrimary}
            onPress={preview}
            accessibilityLabel="Preview memorial book"
          >
            <Text style={BS.btnPrimaryText}>👀 Preview the book</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            Every page, free to look through before you decide anything — and no rush at all.
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
                Print opens the preview and your browser’s own print dialog — the real book, ready to
                send to a printer or save as PDF. Making, downloading and sharing the PDF file itself
                works on your Android phone.
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
              Temporary, {formatBytes(generated.bytes)} — download, print or share it to keep a copy.
            </Text>
          </View>
        )}
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
    gap: SPACE.s2,
  },
  toggleCopy: { flex: 1 },
  toggleLabel: { fontSize: 15, color: COLOR.text, fontWeight: '600' },
  noteInput: {
    ...BS.input,
    minHeight: 120,
    paddingTop: SPACE.s2,
    textAlignVertical: 'top',
  },
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
