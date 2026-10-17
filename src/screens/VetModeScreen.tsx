/**
 * 🩺 Vet Mode — the vet-visit companion (HANDOFF, unit 2 of 3). Free, offline.
 *
 * The screen that turns "we're going to the vet on Thursday" into something the
 * app can carry: what the visit is for, the questions the owner does not want to
 * forget, and — read straight off this device — what happened at the last visit
 * and what the pet is on right now. Afterwards the visit becomes a real record
 * in the pet's own file, and a recheck becomes a date on the Upcoming list.
 *
 * Four parts, in the order they read:
 *
 *   1. **The visit you're preparing for** — the day (a real calendar day, today
 *      or later), the reason, the questions to ask (add and remove, persisted
 *      with the prep) and the day the vet asked to see them again.
 *   2. **Last visit on file** — the pet's most recent recorded visit, read from
 *      the same vet records the Records tab and the emergency card use. Nothing
 *      is invented: a field with nothing stored says "Not on file".
 *   3. **Current medication** — the pet's active-today medication, read through
 *      the Care Pass wizard's own rule, so it can never disagree with a pass.
 *   4. **What was filed** — every visit saved from here, with its recheck's real
 *      state (Scheduled · Today · Needs scheduling · Not scheduled).
 *
 * What it deliberately does NOT do: it is not a second vet-records table. "Save
 * the visit" writes through the app's own vet store (`addVetRecord`), which is
 * why the record appears on the pet's Vet records screen and the recheck appears
 * on Home's Upcoming rail and Today with no new reminder path at all. No
 * notification is scheduled here — push reminders stay the premium feature they
 * already are, and this screen never touches that gate. The whole feature is
 * free and ungated, like Emergency Mode and Travel Mode.
 *
 * 100% offline: AsyncStorage reads and writes only.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CCButton, CCCard, CCEmptyState, CCPill } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { useVetRecords } from '../context/VetContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { PET_DEEP_LINK_ORIGIN, usePetDeepLinkBack } from '../navigation/petDeepLink';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { vetVisitRepository } from '../storage/vetVisits';
import { todayISOInTimeZone } from '../utils/datetime';
import { petAccent } from '../utils/petAccent';
import { petEmojiFor, petSpeciesLabel, shortDate } from '../utils/petDisplay';
import {
  buildVetLastVisitSummary,
  buildVetMedsSummary,
  resolveVetPet,
  vetDraftFromStored,
  vetDraftStatus,
  vetDraftStatusLabel,
  vetDraftStatusTone,
  vetDraftToInput,
  vetFollowUpTestId,
  vetDraftTestId,
  vetInitDraft,
  vetKindLabel,
  vetNeedsPicker,
  vetPetOptions,
  vetQuestionsLabel,
  vetRecheckDateError,
  vetRecheckSchedulable,
  vetRecheckRecordInput,
  vetRecheckStatus,
  vetRecheckStatusLabel,
  vetRecheckStatusLine,
  vetRecheckStatusTone,
  vetRecordKindOf,
  vetSavedDrafts,
  vetUpcomingDrafts,
  vetUpcomingLabel,
  vetVisitDateError,
  vetVisitDateNote,
  vetVisitRecordInput,
  vetVisitTitle,
  VET_MAX_QUESTIONS,
  VET_BACK_TESTID,
} from '../utils/vetMode';
import type { VetVisitDraft } from '../utils/vetMode';
import { BS, COLOR, FONT_BODY, SPACE, TONE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'VetMode'>;

/** One labelled line of the last-visit summary. */
function FactLine({
  label,
  value,
  blank,
  testID,
}: {
  label: string;
  value: string;
  blank: boolean;
  testID: string;
}): React.JSX.Element {
  return (
    <View style={styles.factRow}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, blank && styles.factBlank]} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

export default function VetModeScreen({ navigation, route }: Props): React.JSX.Element {
  const { pets, selectPet } = usePets();
  const { medicationsForPet } = useMedications();
  const { vetRecords, vetRecordsForPet, addVetRecord } = useVetRecords();
  const { timeZone } = useAccount();
  const rootNavigation = useTabRootNavigation();

  const todayKey = useMemo(() => todayISOInTimeZone(new Date(), timeZone), [timeZone]);

  const [chosenId, setChosenId] = useState<string | null>(route.params?.petId ?? null);
  const [drafts, setDrafts] = useState<VetVisitDraft[]>([]);
  /** The prep the owner is editing. Null means "a fresh one, derived below". */
  const [editing, setEditing] = useState<VetVisitDraft | null>(null);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const pet = useMemo(() => resolveVetPet(pets, chosenId), [pets, chosenId]);

  /** Re-read every prepared visit on this device. */
  const reload = useCallback(async (): Promise<VetVisitDraft[]> => {
    try {
      const loaded = await vetVisitRepository.list();
      setDrafts(loaded);
      return loaded;
    } catch {
      // A storage failure must not blank the screen; the list stays as it was.
      return [];
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Moving to another pet starts from a clean sheet — the editor never carries
  // one pet's words onto another pet.
  useEffect(() => {
    setEditing(null);
    setProblem('');
    setNotice('');
  }, [pet?.id]);

  /**
   * The prep being edited. Until the owner touches anything it is derived fresh
   * for this pet (today, nothing typed), so it is never built from half-loaded
   * pets; after the first edit it is exactly what they typed.
   */
  const active: VetVisitDraft = useMemo(
    () =>
      editing && pet && editing.petId === pet.id
        ? editing
        : vetInitDraft(pet?.id ?? '', todayKey),
    [editing, pet, todayKey],
  );

  const edit = useCallback(
    (change: (current: VetVisitDraft) => VetVisitDraft) => {
      setProblem('');
      setNotice('');
      setEditing((current) => {
        const base =
          current && pet && current.petId === pet.id
            ? current
            : vetInitDraft(pet?.id ?? '', todayKey);
        return change(base);
      });
    },
    [pet, todayKey],
  );

  /* ------------------------------------------------------------- readings -- */

  const lastVisit = useMemo(
    () =>
      buildVetLastVisitSummary({
        petId: pet?.id ?? '',
        petName: pet?.name ?? '',
        records: pet ? vetRecordsForPet(pet.id) : vetRecords,
        todayKey,
      }),
    [pet, todayKey, vetRecords, vetRecordsForPet],
  );

  const meds = useMemo(
    () =>
      buildVetMedsSummary({
        petId: pet?.id ?? '',
        petName: pet?.name ?? '',
        medications: pet ? medicationsForPet(pet.id) : [],
        todayKey,
      }),
    [medicationsForPet, pet, todayKey],
  );

  const upcoming = useMemo(() => vetUpcomingDrafts(drafts, pet?.id ?? ''), [drafts, pet?.id]);
  const filed = useMemo(() => vetSavedDrafts(drafts, pet?.id ?? ''), [drafts, pet?.id]);
  const petRecords = useMemo(
    () => (pet ? vetRecordsForPet(pet.id) : []),
    [pet, vetRecordsForPet],
  );

  const visitProblem =
    vetVisitDateError(active.visitDate, todayKey) ||
    vetRecheckDateError(active, todayKey);
  const dateNote = vetVisitDateNote(active.visitDate, todayKey, petRecords, pet?.id ?? '');
  const options = useMemo(() => vetPetOptions(pets, pet?.id ?? ''), [pet?.id, pets]);
  const accent = pet ? petAccent(pet.id) : null;

  /* -------------------------------------------------------------- actions -- */

  /** Write the prep to this device (free, never gated). Null when it cannot be. */
  const persist = useCallback(
    async (source: VetVisitDraft): Promise<VetVisitDraft | null> => {
      const block = vetVisitDateError(source.visitDate, todayKey) || vetRecheckDateError(source, todayKey);
      if (block) {
        setProblem(block);
        return null;
      }
      try {
        return await vetVisitRepository.save(vetDraftToInput(source), source.id || undefined);
      } catch {
        setProblem('That visit could not be saved just now. Nothing was lost — try again.');
        return null;
      }
    },
    [todayKey],
  );

  const onSaveDraft = useCallback(async () => {
    if (busy) return;
    const source = active;
    const wantsRecheck = source.recheckDate.trim() !== '';
    setBusy(true);
    const stored = await persist(source);
    setBusy(false);
    if (!stored) return;
    setEditing(stored);
    await reload();
    setNotice(
      `Saved on this device — “${vetVisitTitle(stored.reason)}” is on the list of visits you are preparing for.` +
        (wantsRecheck && !vetRecheckSchedulable(stored, todayKey)
          ? ' The recheck date has already passed, so nothing is booked for it — it needs a new date.'
          : ''),
    );
  }, [active, busy, persist, reload, todayKey]);

  /**
   * "Save the visit": file it as a real record in the pet's own file — through
   * the app's own vet store, so the Records tab, the emergency card and Home all
   * see it at once — and turn a live recheck date into a follow-up appointment
   * record, which is what puts it on the Upcoming rail.
   */
  const onSaveVisit = useCallback(async () => {
    if (busy || !pet) return;
    const source = active;
    const block = vetVisitDateError(source.visitDate, todayKey) || vetRecheckDateError(source, todayKey);
    if (block) {
      setProblem(block);
      return;
    }
    setBusy(true);
    try {
      // 1. The prep is written first, so nothing the owner typed is lost if a
      //    later step fails.
      const stored = await persist(source);
      if (!stored) return;
      // 2. The visit itself, in the pet's own records.
      const record = await addVetRecord(vetVisitRecordInput(stored, todayKey));
      // 3. The recheck, when it is a day still to come.
      let recheckRecordId = '';
      if (vetRecheckSchedulable(stored, todayKey)) {
        const followUp = await addVetRecord(vetRecheckRecordInput(stored, todayKey));
        recheckRecordId = followUp.id;
      }
      // 4. Mark the prep as filed, so it leaves the upcoming list.
      await vetVisitRepository.save(
        {
          ...vetDraftToInput(stored),
          savedVisitId: record.id,
          savedAt: new Date().toISOString(),
          recheckRecordId,
        },
        stored.id,
      );
      await reload();
      setEditing(null);
      const kind = vetRecordKindOf(record);
      const filed_line =
        kind === 'appointment'
          ? `That day is still ahead, so ${pet.name}’s file now holds an appointment for ${shortDate(record.visitDate)} rather than a visit.`
          : `“${record.visitTitle}” is in ${pet.name}’s vet records for ${shortDate(record.visitDate)}.`;
      const recheck_line =
        recheckRecordId !== ''
          ? ` The recheck for ${shortDate(stored.recheckDate)} is on the Upcoming list.`
          : stored.recheckDate !== ''
            ? ` The recheck date has already passed, so nothing was booked — it stays here as needing a date.`
            : '';
      setNotice(
        `${filed_line} ${kind === 'appointment' ? '' : 'It has left the list of visits you were preparing for.'}${recheck_line}`.trim(),
      );
    } catch {
      setProblem('The visit could not be filed just now. Nothing was lost — try again.');
    } finally {
      setBusy(false);
    }
  }, [active, addVetRecord, busy, persist, pet, reload, todayKey]);

  /** Open a saved prep in the editor. */
  const openDraft = useCallback((draft: VetVisitDraft) => {
    const clean = vetDraftFromStored(draft);
    if (!clean) return;
    setProblem('');
    setNotice('');
    setEditing(clean);
  }, []);

  /** Open the pet's own records file (the same store this screen writes to). */
  const openRecords = useCallback(async () => {
    if (!pet) return;
    try {
      await selectPet(pet.id);
    } catch {
      /* selection is a convenience; the records screen falls back either way */
    }
    rootNavigation.navigate('Pets', { screen: 'VetRecords' });
  }, [pet, rootNavigation, selectPet]);

  /* ---------------------------------------------------------------- render -- */

  const questions = Array.isArray(active.questions) ? active.questions : [];
  // `‹ Back` returns to the pet page when the row that opened this screen was
  // on one, and to Sitter Mode on the normal path (nav/petDeepLink.ts).
  const goBack = usePetDeepLinkBack(navigation, route.params);
  const backLabel =
    route.params?.from === PET_DEEP_LINK_ORIGIN
      ? pet
        ? `${pet.name}’s page`
        : 'Pet page'
      : 'Back';

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel={`Go back to ${backLabel}`}
          testID={VET_BACK_TESTID}
        >
          <Text style={BS.link}>‹ {backLabel}</Text>
        </TouchableOpacity>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Handoff · free · offline</Text>
        <Text style={BS.h1}>🩺 Vet Mode</Text>
        <Text style={BS.body}>
          Get ready for the visit, then file what happened. The reason and your questions wait here
          on this device; the visit itself lands in your pet’s own vet records, and a recheck shows
          up on your Upcoming list. Nothing is sent anywhere, and nothing is invented — anything you
          haven’t stored says “Not on file”.
        </Text>

        {!pet ? (
          <CCEmptyState
            emoji="🐾"
            title="Add a pet first"
            message="Vet Mode prepares one pet's visit at a time and files it in that pet's own records — add yours and come straight back here."
            actionLabel="Go to Pets"
            onAction={() => rootNavigation.navigate('Pets', { screen: 'PetList' })}
            testID="vet-no-pets"
          />
        ) : (
          <>
            {/* ------------------------------------------------------- picker -- */}
            {vetNeedsPicker(pets) ? (
              <>
                <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Which pet?</Text>
                <View style={BS.rowWrap}>
                  {options.map((option) => (
                    <TouchableOpacity
                      key={option.petId}
                      style={[
                        BS.tag,
                        option.selected ? BS.tagAccent2 : BS.tagNeutral,
                        option.selected ? { borderColor: COLOR.blue } : null,
                      ]}
                      onPress={() => setChosenId(option.petId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Vet visit for ${option.name}`}
                      testID={option.testID}
                    >
                      <Text style={option.selected ? BS.tagTextAccent2 : BS.tagTextNeutral}>
                        {option.emoji} {option.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            {/* ------------------------------------------------ the visit prep -- */}
            <CCCard
              glowTint={accent ? accent.fill : COLOR.blue}
              accent={COLOR.blue}
              style={{ marginTop: SPACE.s3 }}
            >
              <View style={styles.head}>
                <View
                  style={[
                    styles.avatarRing,
                    { borderColor: accent ? accent.fill : COLOR.blue },
                  ]}
                >
                  {pet.photoUri ? (
                    <Image
                      source={{ uri: pet.photoUri }}
                      style={styles.avatarPhoto}
                      resizeMode="cover"
                      accessibilityLabel={`${pet.name}'s photo`}
                    />
                  ) : (
                    <Text style={styles.avatarEmoji}>{petEmojiFor(pet)}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.petName} testID="vet-pet-name">
                    {pet.name}
                  </Text>
                  <Text style={BS.caption}>{petSpeciesLabel(pet)}</Text>
                </View>
                {editing ? <CCPill label="Editing a saved prep" tone="blue" /> : null}
              </View>

              <Text style={[BS.cardKicker, { color: TONE.blue.fg, marginTop: SPACE.s3 }]}>
                The visit you’re preparing for
              </Text>
              <Text style={BS.cardTitleLg} testID="vet-prep-title">
                {vetVisitTitle(active.reason) === 'Vet visit'
                  ? 'A visit still to come'
                  : vetVisitTitle(active.reason)}
              </Text>

              <View style={[BS.row, { marginTop: SPACE.s2 }]}>
                <View style={[BS.field, { flex: 1 }]}>
                  <Text style={styles.miniLabel}>Visit date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={BS.input}
                    value={active.visitDate}
                    onChangeText={(value) =>
                      edit((current) => ({ ...current, visitDate: value }))
                    }
                    placeholder={todayKey}
                    placeholderTextColor={COLOR.textFaint}
                    keyboardType="numbers-and-punctuation"
                    accessibilityLabel="Visit date"
                    testID="vet-visit-date"
                  />
                </View>
              </View>

              {visitProblem ? (
                <Text style={styles.error} testID="vet-date-error">
                  {visitProblem}
                </Text>
              ) : dateNote ? (
                <Text style={[BS.caption, { marginTop: SPACE.s1 }]} testID="vet-date-note">
                  {dateNote}
                </Text>
              ) : null}

              <View style={[BS.field, { marginTop: SPACE.s3 }]}>
                <Text style={styles.miniLabel}>Reason for the visit</Text>
                <TextInput
                  style={BS.input}
                  value={active.reason}
                  onChangeText={(value) => edit((current) => ({ ...current, reason: value }))}
                  placeholder="e.g. Sore paw, four days now"
                  placeholderTextColor={COLOR.textFaint}
                  accessibilityLabel="Reason for the visit"
                  testID="vet-reason"
                />
              </View>

              {/* ---- the questions to ask ---- */}
              <Text style={styles.miniLabel}>Questions to ask</Text>
              <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
                Whatever you do not want to forget in the room. They are saved with this visit, and
                they are written into the record’s notes when you file it.
              </Text>
              {questions.length === 0 ? (
                <View style={BS.dashedBox} testID="vet-questions-empty">
                  <Text style={BS.caption}>
                    No questions yet — one nudge is often all a vet visit needs.
                  </Text>
                </View>
              ) : (
                questions.map((question, index) => (
                  <View key={`question-${index}`} style={styles.questionRow}>
                    <TextInput
                      style={[BS.input, { flex: 1 }]}
                      value={question}
                      onChangeText={(value) =>
                        edit((current) => {
                          const next = [...(current.questions ?? [])];
                          next[index] = value;
                          return { ...current, questions: next };
                        })
                      }
                      placeholder="e.g. How much should she eat now?"
                      placeholderTextColor={COLOR.textFaint}
                      accessibilityLabel={`Question ${index + 1}`}
                      testID={`vet-question-${index}`}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() =>
                        edit((current) => ({
                          ...current,
                          questions: (current.questions ?? []).filter((_, i) => i !== index),
                        }))
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Remove question ${index + 1}`}
                      testID={`vet-remove-question-${index}`}
                    >
                      <Text style={styles.removeGlyph}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
              <Text
                style={[BS.caption, { marginTop: SPACE.s1 }]}
                testID="vet-question-count"
              >
                {vetQuestionsLabel(questions)}
                {questions.length >= VET_MAX_QUESTIONS
                  ? ` — that is the most this screen holds (${VET_MAX_QUESTIONS}).`
                  : ''}
              </Text>
              <CCButton
                label="Add a question"
                emoji="✍️"
                variant="secondary"
                onPress={() =>
                  edit((current) => ({
                    ...current,
                    questions: [...(current.questions ?? []), ''],
                  }))
                }
                disabled={questions.length >= VET_MAX_QUESTIONS}
                accessibilityLabel="Add a question to ask"
                testID="vet-add-question"
                style={{ marginTop: SPACE.s2 }}
              />

              {/* ---- the recheck + what the vet said ---- */}
              <View style={[BS.field, { marginTop: SPACE.s4 }]}>
                <Text style={styles.miniLabel}>Recheck date (optional)</Text>
                <TextInput
                  style={BS.input}
                  value={active.recheckDate}
                  onChangeText={(value) =>
                    edit((current) => ({ ...current, recheckDate: value }))
                  }
                  placeholder="YYYY-MM-DD — only if the vet asks"
                  placeholderTextColor={COLOR.textFaint}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel="Recheck date"
                  testID="vet-recheck-date"
                />
                <Text style={[BS.caption, { marginTop: SPACE.s1 }]} testID="vet-recheck-note">
                  A recheck becomes a real follow-up on this device — it shows on your Upcoming list
                  and on Today. Nothing is sent, and no reminder is set from here.
                </Text>
              </View>

              <View style={BS.field}>
                <Text style={styles.miniLabel}>After the visit: what the vet said</Text>
                <TextInput
                  style={[BS.input, styles.multiline]}
                  value={active.outcome}
                  onChangeText={(value) => edit((current) => ({ ...current, outcome: value }))}
                  placeholder="Optional — goes into the record's notes, word for word from you"
                  placeholderTextColor={COLOR.textFaint}
                  multiline
                  accessibilityLabel="What the vet said"
                  testID="vet-outcome"
                />
              </View>

              {problem ? (
                <Text style={styles.error} testID="vet-problem">
                  {problem}
                </Text>
              ) : null}
              {notice ? (
                <Text style={styles.notice} testID="vet-notice">
                  {notice}
                </Text>
              ) : null}

              <CCButton
                label={busy ? 'Filing…' : 'Save the visit'}
                emoji="🩺"
                onPress={() => {
                  void onSaveVisit();
                }}
                disabled={busy}
                accessibilityLabel="Save the visit into the pet's records"
                testID="vet-save-visit"
                style={{ marginTop: SPACE.s2 }}
              />
              <CCButton
                label="Save this prep for later"
                emoji="📝"
                variant="secondary"
                onPress={() => {
                  void onSaveDraft();
                }}
                disabled={busy}
                accessibilityLabel="Save this visit prep for later"
                testID="vet-save-draft"
                style={{ marginTop: SPACE.s2 }}
              />
              <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                Saving the visit files it in {pet.name}’s records and takes it off the list below.
                Saving the prep keeps it here until the visit happens.
              </Text>
            </CCCard>

            {/* ---------------------------------------------------- last visit -- */}
            <CCCard accent={COLOR.lavender} style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.lavender.fg }]}>Last visit on file</Text>
              <Text style={BS.cardTitleLg}>
                {lastVisit.hasVisit ? lastVisit.title : 'Nothing filed yet'}
              </Text>
              <View testID="vet-last-visit">
                {lastVisit.hasVisit ? (
                  <>
                    <Text style={[BS.caption, { marginBottom: SPACE.s1 }]} testID="vet-last-ready">
                      {lastVisit.dateLabel ? `${lastVisit.dateLabel} · ` : ''}
                      {lastVisit.readyLine}
                    </Text>
                    {lastVisit.lines.map((line) => (
                      <FactLine
                        key={line.key}
                        label={line.label}
                        value={line.value}
                        blank={line.blank}
                        testID={line.testID}
                      />
                    ))}
                  </>
                ) : (
                  <Text style={BS.caption} testID="vet-last-empty">
                    {lastVisit.emptyLine}
                  </Text>
                )}
                {lastVisit.pendingLine ? (
                  <Text style={[BS.caption, { marginTop: SPACE.s2 }]} testID="vet-last-pending">
                    {lastVisit.pendingLine}
                  </Text>
                ) : null}
              </View>
              <CCButton
                label={`Open ${pet.name}’s records`}
                emoji="📁"
                variant="secondary"
                onPress={() => {
                  void openRecords();
                }}
                accessibilityLabel={`Open ${pet.name}'s vet records`}
                testID="vet-open-records"
                style={{ marginTop: SPACE.s3 }}
              />
            </CCCard>

            {/* ------------------------------------------------ medication ---- */}
            <CCCard accent={COLOR.aqua} style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.aqua.fg }]}>Current medication</Text>
              <Text style={BS.cardTitleLg} testID="vet-meds-count">
                {meds.count === 0
                  ? 'Nothing active today'
                  : `${meds.count} active today`}
              </Text>
              <View testID="vet-meds">
                <Text style={[BS.caption, { marginBottom: SPACE.s1 }]} testID="vet-meds-note">
                  {meds.note}
                </Text>
                {meds.lines.map((line, index) => (
                  <Text key={`med-${index}`} style={styles.medLine} testID={`vet-med-${index}`}>
                    {line}
                  </Text>
                ))}
              </View>
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
                Read with the same rule a care pass uses for “today”, so the two can never disagree.
                The vet will ask what they are on — this is that list.
              </Text>
            </CCCard>

            {/* ------------------------------------------- visits in the pipeline -- */}
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>Visits you’re preparing for</Text>
            <Text style={[BS.caption, { marginBottom: SPACE.s2 }]} testID="vet-upcoming-count">
              {vetUpcomingLabel(upcoming)} ·{' '}
              {upcoming.length === 0
                ? 'fill in the visit above and save the prep.'
                : 'tap one to carry on with it.'}
            </Text>
            {upcoming.length === 0 ? (
              <View style={BS.dashedBox} testID="vet-upcoming-empty">
                <Text style={BS.caption}>
                  Nothing waiting. A visit you are preparing for sits here, with its date, its reason
                  and your questions, until you file it.
                </Text>
              </View>
            ) : (
              upcoming.map((draft) => {
                const status = vetDraftStatus(draft, todayKey);
                return (
                  <TouchableOpacity
                    key={draft.id}
                    style={BS.divRow}
                    onPress={() => openDraft(draft)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open the visit prep “${vetVisitTitle(draft.reason)}”`}
                    testID={vetDraftTestId(draft.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[BS.rowLabel, { flex: 1 }]}>{vetVisitTitle(draft.reason)}</Text>
                      <CCPill
                        label={vetDraftStatusLabel(status)}
                        tone={vetDraftStatusTone(status)}
                      />
                    </View>
                    <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                      {draft.visitDate || 'No date yet'} · {vetQuestionsLabel(draft.questions)}
                      {draft.recheckDate ? ` · recheck ${draft.recheckDate}` : ''}
                    </Text>
                    <Text style={[BS.link, { marginTop: 2 }]}>Open it ›</Text>
                  </TouchableOpacity>
                );
              })
            )}

            {/* --------------------------------------------------- what was filed -- */}
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>Filed from here</Text>
            <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
              Every visit saved from this screen, and where its recheck really stands. The records
              themselves live in {pet.name}’s file, not in a second copy.
            </Text>
            {filed.length === 0 ? (
              <View style={BS.dashedBox} testID="vet-filed-empty">
                <Text style={BS.caption}>
                  Nothing filed from here yet. When the visit happens, save it and it appears in{' '}
                  {pet.name}’s records and on this list.
                </Text>
              </View>
            ) : (
              filed.map((draft) => {
                const status = vetRecheckStatus(draft, todayKey, petRecords);
                return (
                  <View key={draft.id} style={BS.divRow} testID={vetFollowUpTestId(draft.id)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[BS.rowLabel, { flex: 1 }]}>{vetVisitTitle(draft.reason)}</Text>
                      <CCPill
                        label={vetRecheckStatusLabel(status)}
                        tone={vetRecheckStatusTone(status)}
                      />
                    </View>
                    <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                      Filed for {draft.visitDate || 'a day with no date'} ·{' '}
                      {draft.savedVisitId ? 'in the records' : 'not in the records'}
                      {draft.recheckRecordId ? ' · follow-up on file' : ''}
                    </Text>
                    <Text
                      style={[BS.caption, { marginTop: 2 }]}
                      testID={`vet-followup-line-${draft.id}`}
                    >
                      {vetRecheckStatusLine(status, draft, pet.name)}
                    </Text>
                  </View>
                );
              })
            )}

            <View style={{ height: SPACE.s4 }} />
            <CCButton
              label={`Open ${pet.name}’s vet records`}
              emoji="📁"
              variant="secondary"
              onPress={() => {
                void openRecords();
              }}
              accessibilityLabel={`Open ${pet.name}'s vet records from the bottom of Vet Mode`}
              testID="vet-open-records-bottom"
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 26, lineHeight: 32 },
  petName: { fontFamily: FONT_BODY, fontSize: 18, fontWeight: '700', color: COLOR.text },
  miniLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
    marginBottom: SPACE.s1,
  },
  error: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.accent2_700,
    marginTop: SPACE.s2,
  },
  notice: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: TONE.leaf.fg,
    backgroundColor: TONE.leaf.bg,
    borderRadius: 14,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    marginTop: SPACE.s3,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s2,
    marginBottom: SPACE.s2,
  },
  removeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeGlyph: { fontFamily: FONT_BODY, fontSize: 16, fontWeight: '700', color: COLOR.textMuted },
  multiline: { minHeight: 84, paddingTop: SPACE.s2, textAlignVertical: 'top' },
  factRow: { paddingVertical: SPACE.s2, borderBottomWidth: 1, borderBottomColor: COLOR.divider },
  factLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  factValue: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLOR.text,
    marginTop: 2,
  },
  factBlank: { color: COLOR.textFaint },
  medLine: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 20,
    color: COLOR.text,
    marginTop: SPACE.s1,
  },
});
