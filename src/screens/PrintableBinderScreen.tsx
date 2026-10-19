/**
 * Printable binder — HANDOFF, unit 3 of 3, the screen the owner starts from.
 *
 * One thing to decide (whose binder, and what paper) and the care file is ready:
 *
 *  - pick ONE pet, SEVERAL, or EVERY pet — each gets its own chapter;
 *  - US Letter or A4;
 *  - Preview the finished document (free, on-device);
 *  - with Blueprint Premium: Generate the PDF · Download a copy · Print · Share,
 *    through the planner's own on-device PDF engine and the same gate helper
 *    every other premium creator in Sitter Mode uses.
 *
 * Where the content comes from: the SAME stores the rest of the app uses — the
 * pet profile, the emergency-card details, vaccinations, medications, the vet
 * records store, expenses and the pet's care instructions. Nothing is re-typed,
 * nothing is invented, and a fact with nothing stored prints the app's one
 * placeholder, "Not on file".
 *
 * There is no fetch, no server and no account anywhere in this feature: the PDF
 * is rendered from an HTML string on this device. No file accumulates — the PDF
 * is written to the app's temporary folder only when the owner asks for it, the
 * previous temporary file is removed first, and a copy is saved somewhere
 * visible only when the owner Downloads it.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useGoToPremium } from '../components/CarePassPremiumLock';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { PET_DEEP_LINK_ORIGIN, usePetDeepLinkBack } from '../navigation/petDeepLink';
import {
  binderFileName,
  binderSummaryLine,
} from '../pdf/binder/document';
import { useBinderBuilders } from '../pdf/binder/useBinderDocument';
import { BINDER_SECTIONS } from '../pdf/binder/sections';
import { PAPER_SIZES, type PaperSize } from '../pdf/planner/sections';
import {
  deleteTempFile,
  formatBytes,
  generatePlannerPdf,
  printPlannerPdf,
  savePlannerPdf,
  sharePlannerPdf,
} from '../pdf/planner/plannerFile';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, RADIUS, SHADOW, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'PrintableBinder'>;

/** What the screen is doing right now (so only one action runs at a time). */
type BusyAction = 'generate' | 'download' | 'print' | 'share' | null;

/** The PDF generated this visit, if one has been made. */
interface GeneratedInfo {
  uri: string;
  bytes: number;
  fileName: string;
  summary: string;
}

export default function PrintableBinderScreen({ navigation, route }: Props): React.JSX.Element {
  const { pets, activePet } = usePets();
  const premium = usePremium();
  const entitled = premium.isPremium();
  const goToPremium = useGoToPremium();
  const builders = useBinderBuilders();

  const allPetIds = useMemo(() => pets.map((pet) => pet.id), [pets]);
  const [petIds, setPetIds] = useState<string[]>(() => {
    // A per-pet row on a pet's page names its pet (`pet-handoff-binder`); the
    // More / Sitter Home doors name none, so the active pet is the honest
    // default there. An unknown id falls back to the first pet below.
    const first = route.params?.petId ?? activePet?.id ?? pets[0]?.id;
    return first ? [first] : [];
  });
  const [paper, setPaper] = useState<PaperSize>('letter');
  const [busy, setBusy] = useState<BusyAction>(null);
  const [generated, setGenerated] = useState<GeneratedInfo | null>(null);
  /** The temp file from the last action — deleted before a new one is made. */
  const lastTempRef = useRef<string | null>(null);

  const isWeb = Platform.OS === 'web';

  /* ---- the owner's choices, resolved into one pet list ---- */
  const chosenIds = useMemo(() => {
    const known = petIds.filter((id) => allPetIds.includes(id));
    if (known.length > 0) return known;
    return allPetIds.slice(0, 1);
  }, [petIds, allPetIds]);

  const selectedPets = useMemo(
    () => pets.filter((pet) => chosenIds.includes(pet.id)),
    [pets, chosenIds],
  );
  const everyPet = selectedPets.length === pets.length && pets.length > 0;

  const config = useMemo(() => ({ petIds: chosenIds, paper }), [chosenIds, paper]);
  const summary = useMemo(
    () => binderSummaryLine(selectedPets.map((pet) => pet.name), paper, BINDER_SECTIONS.length),
    [selectedPets, paper],
  );

  const togglePet = useCallback((petId: string) => {
    setGenerated(null);
    setPetIds((prev) => {
      const known = prev.filter((id) => allPetIds.includes(id));
      if (known.includes(petId)) {
        const next = known.filter((id) => id !== petId);
        // A binder with no pet is not a binder — keep at least one chosen.
        return next.length > 0 ? next : known;
      }
      return [...known, petId];
    });
  }, [allPetIds]);

  const chooseEveryPet = useCallback(() => {
    setGenerated(null);
    setPetIds(allPetIds);
  }, [allPetIds]);

  const preview = useCallback(() => {
    navigation.navigate('BinderPreview', { petIds: chosenIds, paper });
  }, [navigation, chosenIds, paper]);

  /**
   * Web print: the browser cannot save a PDF file for us, but it CAN print the
   * document — so this opens the preview (which renders the real print HTML) and
   * asks it to open the browser's print dialog once the document has loaded.
   */
  const handleWebPrint = useCallback(() => {
    navigation.navigate('BinderPreview', { petIds: chosenIds, paper, autoPrint: true });
  }, [navigation, chosenIds, paper]);

  /* ---- the file actions (native; the web shows the browser's own print) ---- */

  /** Render the PDF for the current choices, removing any previous temp file. */
  const ensurePdf = useCallback(async () => {
    const html = builders.html(config);
    deleteTempFile(lastTempRef.current);
    const pdf = await generatePlannerPdf(html, paper);
    lastTempRef.current = pdf.uri;
    return pdf;
  }, [builders, config, paper]);

  const petNames = useMemo(() => selectedPets.map((pet) => pet.name), [selectedPets]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    setBusy('generate');
    try {
      const pdf = await ensurePdf();
      const fileName = binderFileName(petNames);
      setGenerated({ uri: pdf.uri, bytes: pdf.bytes, fileName, summary });
      Alert.alert(
        'Binder ready ✨',
        `${summary}.\n\nTemporary file (${formatBytes(pdf.bytes)}):\n${pdf.uri}\n\nIt lives in the app's temporary folder. Download, print or share it to keep a copy — nothing is uploaded, ever.`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t build the binder',
        e instanceof Error ? e.message : 'Something went wrong building the PDF. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, petNames, summary]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('download');
    try {
      const { uri, base64, bytes } = await ensurePdf();
      const fileName = binderFileName(petNames);
      const savedTo = await savePlannerPdf({ uri, base64, fileName });
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
        'Couldn’t save the binder',
        e instanceof Error ? e.message : 'Something went wrong saving the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, petNames, summary]);

  const handlePrint = useCallback(async () => {
    if (busy) return;
    setBusy('print');
    try {
      await printPlannerPdf(builders.html(config));
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
      const title = binderFileName(petNames);
      const shared = await sharePlannerPdf(uri, title);
      if (!shared) {
        Alert.alert(
          'Sharing isn’t available here',
          `The binder (${formatBytes(bytes)}) is saved on this device:\n${uri}`,
        );
      }
      setGenerated({ uri, bytes, fileName: title, summary });
    } catch (e) {
      Alert.alert(
        'Couldn’t share the binder',
        e instanceof Error ? e.message : 'Something went wrong sharing the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, petNames, summary]);

  // `‹ Back` returns to the pet's page when the row that opened this screen was
  // on one (`pet-handoff-binder`), and to Sitter Mode on the normal path — the
  // same helper Vet Mode and Emergency Mode use (nav/petDeepLink.ts). Without
  // it a deep link would leave nothing beneath this screen, and Back would fall
  // through to the tab navigator and land on Home.
  const goBack = usePetDeepLinkBack(navigation, route.params);
  const linkedPet = route.params?.petId
    ? pets.find((entry) => entry.id === route.params?.petId) ?? activePet
    : activePet;
  const backLabel =
    route.params?.from === PET_DEEP_LINK_ORIGIN
      ? linkedPet
        ? `${linkedPet.name}’s page`
        : 'Pet page'
      : 'Sitter Mode';

  /* ---- no pets yet ---- */
  if (pets.length === 0) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel={`Back to ${backLabel}`}
            testID="binder-back"
          >
            <Text style={BS.link}>‹ {backLabel}</Text>
          </TouchableOpacity>
          <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Handoff</Text>
          <Text style={BS.h1}>Printable binder</Text>
          <Text style={BS.italic}>
            Add a pet first — the binder is their whole care file read off this device, so there is
            nothing to print yet.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={[BS.pad, styles.pad]}>
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={`Back to ${backLabel}`}
          testID="binder-back"
        >
          <Text style={BS.link}>‹ {backLabel}</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Handoff · 3 of 3</Text>
        <Text style={BS.h1} testID="binder-title">
          Printable binder
        </Text>
        <Text style={BS.italic}>
          One tap turns your pet’s whole care file into paper: who they are, what a vet should know,
          every visit on record, what the care has cost, and exactly how to look after them. Built on
          this device from what you already track — hand it to a sitter, a vet or family.
        </Text>

        {/* ---- pets ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Whose binder?</Text>
            <TouchableOpacity onPress={chooseEveryPet} accessibilityLabel="Every pet">
              <Text style={BS.link}>{everyPet ? 'Every pet ✓' : 'Every pet'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.petChips}>
            {pets.map((pet) => {
              const chosen = chosenIds.includes(pet.id);
              return (
                <TouchableOpacity
                  key={pet.id}
                  style={[styles.chip, chosen && styles.chipOn]}
                  onPress={() => togglePet(pet.id)}
                  accessibilityLabel={`${pet.name}${chosen ? ' in the binder' : ''}`}
                  testID={`binder-pet-${pet.id}`}
                >
                  <Text style={[styles.chipText, chosen && styles.chipTextOn]}>
                    {petEmojiFor(pet)} {pet.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={BS.caption}>
            {selectedPets.length === 0
              ? 'Choose at least one pet.'
              : selectedPets.length === 1
                ? `${selectedPets[0].name} gets one chapter — every section, nothing left out.`
                : `${selectedPets.length} pets — one chapter each, in your own pet order.`}
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
                onPress={() => {
                  setPaper(size.id);
                  setGenerated(null);
                }}
                accessibilityLabel={size.label}
                testID={`binder-paper-${size.id}`}
              >
                <Text style={paper === size.id ? BS.segTextActive : BS.segText}>{size.short}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={BS.caption}>
            {paper === 'a4'
              ? 'A4 · 210 × 297 mm — the template is set to A4, on paper and on screen.'
              : 'US Letter · 8.5 × 11 in — the template is set to Letter, on paper and on screen.'}
          </Text>
        </View>

        {/* ---- what is inside ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>What goes in the file</Text>
          {BINDER_SECTIONS.map((section) => (
            <View key={section.id} style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>
                {section.emoji} {section.title}
              </Text>
            </View>
          ))}
          <Text style={BS.caption}>
            Everything is drawn from your own records — a fact with nothing stored says “Not on file”
            rather than being guessed, and costs are added up only from the amounts you logged.
          </Text>
        </View>

        {/* ---- actions ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Your binder</Text>
          <Text style={BS.body} testID="binder-summary">
            {summary}
          </Text>

          <TouchableOpacity style={BS.btnPrimary} onPress={preview} accessibilityLabel="Preview binder" testID="binder-preview">
            <Text style={BS.btnPrimaryText}>👀 Preview binder</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            The whole document, free to look through before you decide anything.
          </Text>

          {!entitled ? (
            <TouchableOpacity
              style={styles.lockRow}
              onPress={goToPremium}
              accessibilityLabel="Blueprint Premium"
              testID="binder-lock"
            >
              <Text style={styles.lockEmoji}>🔒</Text>
              <View style={styles.lockCopy}>
                <Text style={styles.lockTitle}>Binder PDFs — Blueprint Premium</Text>
                <Text style={styles.lockText}>
                  Part of Blueprint Premium — start your 14-day free trial
                </Text>
                <Text style={BS.caption}>
                  Generate, download, print and share. Preview stays free.
                </Text>
              </View>
            </TouchableOpacity>
          ) : isWeb ? (
            <>
              <TouchableOpacity
                style={BS.btnSecondary}
                onPress={handleWebPrint}
                accessibilityLabel="Print in the browser"
                testID="binder-print-web"
              >
                <Text style={BS.btnSecondaryText}>🖨️ Print</Text>
              </TouchableOpacity>
              <Text style={styles.webNote}>
                Print opens the preview and your browser’s own print dialog — the real document,
                ready to send to a printer or save as PDF. Making, downloading and sharing the PDF
                file itself works on your Android phone.
              </Text>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'generate' && styles.busy]}
                onPress={handleGenerate}
                disabled={busy !== null}
                accessibilityLabel="Generate binder PDF"
                testID="binder-generate"
              >
                {busy === 'generate' ? (
                  <ActivityIndicator color={COLOR.blue} />
                ) : (
                  <Text style={BS.btnSecondaryText}>📄 Generate PDF</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'download' && styles.busy]}
                onPress={handleDownload}
                disabled={busy !== null}
                accessibilityLabel="Download the binder"
                testID="binder-download"
              >
                {busy === 'download' ? (
                  <ActivityIndicator color={COLOR.blue} />
                ) : (
                  <Text style={BS.btnSecondaryText}>⬇️ Download a copy</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'print' && styles.busy]}
                onPress={handlePrint}
                disabled={busy !== null}
                accessibilityLabel="Print the binder"
                testID="binder-print"
              >
                {busy === 'print' ? (
                  <ActivityIndicator color={COLOR.blue} />
                ) : (
                  <Text style={BS.btnSecondaryText}>🖨️ Print</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[BS.btnSecondary, busy === 'share' && styles.busy]}
                onPress={handleShare}
                disabled={busy !== null}
                accessibilityLabel="Share the binder"
                testID="binder-share"
              >
                {busy === 'share' ? (
                  <ActivityIndicator color={COLOR.blue} />
                ) : (
                  <Text style={BS.btnSecondaryText}>📤 Share</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={BS.caption}>
            PDFs are built on request only — the app keeps no copies. The file sits in the app’s
            temporary folder until you download, print or share it, and it is never uploaded.
          </Text>
        </View>

        {/* ---- the generated file ---- */}
        {generated && (
          <View style={[BS.card, styles.generatedCard]} testID="binder-generated">
            <Text style={BS.cardKicker}>Generated ✨</Text>
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
  petChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.s2,
    marginTop: SPACE.s2,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.surfaceSoft,
    borderWidth: 1,
    borderColor: COLOR.divider,
  },
  chipOn: { backgroundColor: COLOR.blue, borderColor: COLOR.blue },
  chipText: { fontSize: 14, color: COLOR.text },
  chipTextOn: { color: COLOR.white, fontWeight: '700' },
  sectionRow: {
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  sectionLabel: { fontSize: 15, color: COLOR.text },
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
  lockText: { fontSize: 13, fontWeight: '600', color: COLOR.blue },
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
