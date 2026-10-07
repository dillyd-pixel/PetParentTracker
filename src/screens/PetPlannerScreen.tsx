/**
 * Printable Pet Planner — the Customize screen (Keepsakes → Printable pet
 * planner), and the app's first finished upsell product.
 *
 * What it does, all on the device:
 *  - choose ONE pet, SEVERAL pets, or THE WHOLE HOUSEHOLD;
 *  - toggle each of the 14 planner sections (all on by default);
 *  - pick US Letter or A4;
 *  - Preview the finished document (free), and, with Blueprint Premium,
 *    Generate the PDF · Download a copy · Print · Share.
 *
 * Where the content comes from: the SAME stores the rest of the app uses —
 * pets, feeding, medications, vaccines, vet records, expenses, journal, care
 * check-ins, care instructions and the owner's own name. Nothing is re-typed,
 * nothing is invented, and a section with no data prints an honest friendly
 * empty note. There is no fetch, no server and no account anywhere in this
 * feature: the PDF is rendered from an HTML string on this device.
 *
 * No file accumulates: the PDF is written to the app's temporary folder only
 * when the owner asks for it, the previous temporary file is removed first, and
 * a copy is saved somewhere visible only when the owner Downloads it.
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { usePlannerBuilders } from '../pdf/planner/usePlannerDocument';
import {
  PAPER_SIZES,
  PLANNER_SECTIONS,
  type PaperSize,
  type PlannerSectionId,
} from '../pdf/planner/sections';
import {
  deleteTempFile,
  formatBytes,
  generatePlannerPdf,
  plannerFileName,
  printPlannerPdf,
  savePlannerPdf,
  sharePlannerPdf,
} from '../pdf/planner/plannerFile';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, RADIUS, SHADOW, SPACE } from '../theme';

/** Which pets the planner covers. */
type PetMode = 'one' | 'several' | 'household';

/** What the screen is doing right now (so only one action runs at a time). */
type BusyAction = 'generate' | 'download' | 'print' | 'share' | null;

/** The PDF generated this visit, if one has been made. */
interface GeneratedInfo {
  uri: string;
  bytes: number;
  fileName: string;
  /** e.g. "2 pets · US Letter · 14 sections". */
  summary: string;
}

export default function PetPlannerScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { pets, activePet } = usePets();
  const premium = usePremium();
  const unlocked = premium.isPremium();
  const builders = usePlannerBuilders();

  const [mode, setMode] = useState<PetMode>('one');
  const [singleId, setSingleId] = useState<string | null>(activePet?.id ?? pets[0]?.id ?? null);
  const [multiIds, setMultiIds] = useState<string[]>(() => {
    const first = activePet?.id ?? pets[0]?.id;
    return first ? [first] : [];
  });
  const [paper, setPaper] = useState<PaperSize>('letter');
  const [offIds, setOffIds] = useState<PlannerSectionId[]>([]);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [generated, setGenerated] = useState<GeneratedInfo | null>(null);
  /** The temp file from the last "Generate" — deleted before a new one is made. */
  const lastTempRef = useRef<string | null>(null);

  const isWeb = Platform.OS === 'web';
  const allPetIds = useMemo(() => pets.map((pet) => pet.id), [pets]);

  /* ---- the owner's choices, resolved into one pet list ---- */
  const petIds = useMemo(() => {
    if (mode === 'household') return allPetIds;
    if (mode === 'one') {
      const chosen = singleId && allPetIds.includes(singleId) ? singleId : allPetIds[0];
      return chosen ? [chosen] : [];
    }
    const chosen = multiIds.filter((id) => allPetIds.includes(id));
    return chosen.length > 0 ? chosen : allPetIds.slice(0, 1);
  }, [mode, singleId, multiIds, allPetIds]);

  const sectionIds = useMemo(
    () => PLANNER_SECTIONS.map((section) => section.id).filter((id) => !offIds.includes(id)),
    [offIds],
  );

  const config = useMemo(
    () => ({ petIds, sectionIds, paper }),
    [petIds, sectionIds, paper],
  );

  const selectedPets = useMemo(
    () => pets.filter((pet) => petIds.includes(pet.id)),
    [pets, petIds],
  );

  const summary = useMemo(() => {
    const petPart =
      selectedPets.length === 1
        ? selectedPets[0].name
        : selectedPets.length === 0
          ? 'No pets selected'
          : `${selectedPets.length} pets`;
    const paperPart = paper === 'a4' ? 'A4' : 'US Letter';
    return `${petPart} · ${paperPart} · ${sectionIds.length} of ${PLANNER_SECTIONS.length} sections`;
  }, [selectedPets, paper, sectionIds.length]);

  const toggleSection = useCallback((id: PlannerSectionId) => {
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
    navigation.navigate('PetPlannerPreview', { petIds, sectionIds, paper });
  }, [navigation, petIds, sectionIds, paper]);

  /**
   * Web print: the browser can't save a PDF file for us, but it CAN print the
   * document — so this opens the preview (which renders the real print HTML) and
   * asks it to open the browser's print dialog once the document has loaded.
   */
  const handleWebPrint = useCallback(() => {
    navigation.navigate('PetPlannerPreview', { petIds, sectionIds, paper, autoPrint: true });
  }, [navigation, petIds, sectionIds, paper]);

  /* ---- the file actions (native; the web shows friendly notes instead) ---- */

  /**
   * Render the PDF for the current choices. Any previously generated temporary
   * file is removed first, so nothing piles up in the app's temporary folder.
   */
  const ensurePdf = useCallback(async () => {
    const html = builders.html(config);
    deleteTempFile(lastTempRef.current);
    const pdf = await generatePlannerPdf(html, paper);
    lastTempRef.current = pdf.uri;
    return pdf;
  }, [builders, config, paper]);

  const handleGenerate = useCallback(async () => {
    if (busy) return;
    setBusy('generate');
    try {
      const html = builders.html(config);
      deleteTempFile(lastTempRef.current);
      const pdf = await generatePlannerPdf(html, paper);
      lastTempRef.current = pdf.uri;
      const fileName = plannerFileName(selectedPets.map((pet) => pet.name));
      setGenerated({ uri: pdf.uri, bytes: pdf.bytes, fileName, summary });
      Alert.alert(
        'Generated ✨',
        `${summary}.\n\nTemporary file (${formatBytes(pdf.bytes)}):\n${pdf.uri}\n\nIt lives in the app's temporary folder. Download, print or share it to keep a copy — nothing is uploaded, ever.`,
      );
    } catch (e) {
      Alert.alert(
        'Couldn’t generate the planner',
        e instanceof Error ? e.message : 'Something went wrong building the PDF. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, builders, config, paper, selectedPets, summary]);

  const handleDownload = useCallback(async () => {
    if (busy) return;
    setBusy('download');
    try {
      const { uri, base64, bytes } = await ensurePdf();
      const fileName = plannerFileName(selectedPets.map((pet) => pet.name));
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
        'Couldn’t save the planner',
        e instanceof Error ? e.message : 'Something went wrong saving the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, selectedPets]);

  const handlePrint = useCallback(async () => {
    if (busy) return;
    setBusy('print');
    try {
      const html = builders.html(config);
      await printPlannerPdf(html);
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
      const title = plannerFileName(selectedPets.map((pet) => pet.name));
      const shared = await sharePlannerPdf(uri, title);
      if (!shared) {
        Alert.alert('Sharing isn’t available here', `The planner (${formatBytes(bytes)}) is saved on this device:\n${uri}`);
      }
    } catch (e) {
      Alert.alert(
        'Couldn’t share the planner',
        e instanceof Error ? e.message : 'Something went wrong sharing the file. Try again.',
      );
    } finally {
      setBusy(null);
    }
  }, [busy, ensurePdf, selectedPets]);

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
          <Text style={BS.h1}>Printable pet planner</Text>
          <Text style={BS.italic}>
            Add a pet first — the planner is built from that pet’s own records, so there is nothing
            to print yet.
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
        <Text style={BS.h1}>Printable pet planner</Text>
        <Text style={BS.italic}>
          A themed pet-care planner built from what you already track — print it at home and keep it
          on the fridge. Generated on this device: no account, no server, nothing uploaded.
        </Text>

        {/* ---- pets ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Who is this planner for?</Text>
          <View style={BS.seg}>
            {(
              [
                { id: 'one', label: 'One pet' },
                { id: 'several', label: 'Several' },
                { id: 'household', label: 'Whole household' },
              ] as Array<{ id: PetMode; label: string }>
            ).map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[BS.segOpt, mode === option.id && BS.segOptActive]}
                onPress={() => setMode(option.id)}
                accessibilityLabel={option.label}
              >
                <Text style={mode === option.id ? BS.segTextActive : BS.segText}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'household' ? (
            <Text style={BS.caption}>
              Every pet on this device — {pets.map((pet) => pet.name).join(', ')} — one chapter
              each.
            </Text>
          ) : (
            <View style={styles.petChips}>
              {pets.map((pet) => {
                const chosen =
                  mode === 'one' ? petIds[0] === pet.id : multiIds.includes(pet.id);
                return (
                  <TouchableOpacity
                    key={pet.id}
                    style={[styles.chip, chosen && styles.chipOn]}
                    onPress={() => {
                      if (mode === 'one') {
                        setSingleId(pet.id);
                        return;
                      }
                      setMultiIds((prev) => {
                        if (prev.includes(pet.id)) {
                          const next = prev.filter((id) => id !== pet.id);
                          return next.length > 0 ? next : prev;
                        }
                        return [...prev, pet.id];
                      });
                    }}
                    accessibilityLabel={`${pet.name}${chosen ? ' selected' : ''}`}
                  >
                    <Text style={[styles.chipText, chosen && styles.chipTextOn]}>
                      {petEmojiFor(pet)} {pet.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {mode === 'several' && (
            <Text style={BS.caption}>
              {multiIds.length} selected — each pet gets its own chapter in the document.
            </Text>
          )}
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
              ? 'A4 · 210 × 297 mm — the template is set to A4, on paper and on screen.'
              : 'US Letter · 8.5 × 11 in — the template is set to Letter, on paper and on screen.'}
          </Text>
        </View>

        {/* ---- sections ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Sections</Text>
            <Text style={BS.caption}>
              {sectionIds.length} of {PLANNER_SECTIONS.length} on
            </Text>
          </View>
          <Text style={BS.caption}>
            Everything is on to start. Switch off anything you don’t want printed.
          </Text>
          {PLANNER_SECTIONS.map((section) => {
            const on = !offIds.includes(section.id);
            return (
              <View key={section.id} style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>
                  {section.emoji} {section.title}
                </Text>
                <Switch
                  value={on}
                  onValueChange={() => toggleSection(section.id)}
                  trackColor={{ true: COLOR.blue, false: COLOR.divider }}
                  thumbColor={COLOR.white}
                  accessibilityLabel={`${section.title} section`}
                />
              </View>
            );
          })}
          {offIds.length > 0 && (
            <TouchableOpacity onPress={() => setOffIds([])} accessibilityLabel="Turn every section on">
              <Text style={[BS.link, { marginTop: SPACE.s2 }]}>Turn every section back on</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ---- actions ---- */}
        <View style={BS.card}>
          <Text style={BS.cardKicker}>Your planner</Text>
          <Text style={BS.body}>{summary}</Text>

          <TouchableOpacity
            style={BS.btnPrimary}
            onPress={preview}
            accessibilityLabel="Preview planner"
          >
            <Text style={BS.btnPrimaryText}>👀 Preview planner</Text>
          </TouchableOpacity>
          <Text style={BS.caption}>
            The whole document, free to look through before you decide anything.
          </Text>

          {!unlocked ? (
            <TouchableOpacity style={styles.lockRow} onPress={goToPremium} accessibilityLabel="Blueprint Premium">
              <Text style={styles.lockEmoji}>🔒</Text>
              <View style={styles.lockCopy}>
                <Text style={styles.lockTitle}>Planning PDFs — Blueprint Premium</Text>
                <Text style={styles.lockText}>
                  Part of Blueprint Premium — start your 14-day free trial
                </Text>
                <Text style={BS.caption}>
                  Generate, download, print and share. Preview and customizing stay free.
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
            PDFs are generated on request only — the app keeps no copies. The file sits in the
            app’s temporary folder until you download, print or share it, and it is never uploaded.
          </Text>
        </View>

        {/* ---- the generated file ---- */}
        {generated && (
          <View style={[BS.card, styles.generatedCard]}>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  toggleLabel: { fontSize: 15, color: COLOR.text, flex: 1, paddingRight: SPACE.s2 },
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
