/**
 * "I'm Leaving Town" — the guided Care Pass creator (Sitter Mode, unit 2).
 *
 * Eight steps, one screen, every entry kept in local state so Back and Next
 * never lose a word:
 *
 *   1. Welcome      — what a care pass is, and the honest rules of it.
 *   2. Pets         — who the pass covers (with the "All N pets" shortcut).
 *   3. Caregiver    — who is looking after them (prefilled from the check-in
 *                     name when there is one, labelled as a prefill).
 *   4. Dates        — the days it runs, with quick day chips.
 *   5. Feeding      — per pet, prefilled from that pet's REAL feeding schedule
 *                     and written food notes, editable, blanks allowed.
 *   6. Medication   — per pet, the same from the medication records.
 *   7. Emergency    — per pet, who to call, prefilled from the emergency-card
 *                     details (the same facts the printed card uses) and the
 *                     vet named on the pet's latest visit record.
 *   8. Household &
 *      review       — one household note, and the whole pass read back before
 *                     "Create & share" writes it and opens the pass detail,
 *                     where the invite code and the share file already live.
 *
 * The rules the copy keeps: nothing is invented (a pet with no schedule gets a
 * blank box and a line saying so), nothing is required that the owner cannot
 * supply, and the only urgency anywhere is the owner's own travel. Creating a
 * pass is Blueprint Premium — the same lock the compact create form uses, so a
 * non-entitled user sees the app's premium prompt in place of step 1.
 *
 * 100% offline: AsyncStorage-backed contexts read the same stores the rest of
 * the app does; the pass is written through `SitterContext.createPass`. No
 * network, no account, no demo data.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { CarePassPremiumLock } from '../components/CarePassPremiumLock';
import { CCCard, CCButton, CCEmptyState, CCPill } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useFeeding } from '../context/FeedingContext';
import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { useSitter } from '../context/SitterContext';
import { useVetRecords } from '../context/VetContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { caregiverNameOrOwner, loadCaregiverName } from '../storage/caregiverName';
import { emergencyDetailsRepository, extrasForPet } from '../storage/emergencyDetails';
import type { EmergencyExtrasByPet } from '../pdf/emergency/document';
import {
  CARE_PASS_CONTACT_ROLES,
  CARE_PASS_PERMISSION_LEVELS,
  CARE_PASS_SECTIONS,
  carePassContactRoleLabel,
  carePassPermissionLabel,
  carePassSectionLabel,
  isValidISODate,
} from '../types';
import type { CarePassContactRole, CarePassSection } from '../types';
import {
  CARE_PASS_WIZARD_STEPS,
  contactDraftLine,
  wizardGoTo,
  prefilledPetNotes,
  wizardAllPetsLabel,
  wizardBack,
  wizardCaregiverNudge,
  wizardCreateProblem,
  wizardCurrentStep,
  wizardDatesStatusLine,
  wizardDayKey,
  wizardDateError,
  wizardHasNext,
  wizardInit,
  wizardNext,
  wizardPetNotes,
  wizardPrefillPet,
  wizardReview,
  wizardSelectedPets,
  wizardSetPetContact,
  wizardSetPetNote,
  wizardStepIndicator,
  wizardToggleAllPets,
  wizardTogglePet,
  wizardPassInput,
} from '../utils/carePassWizard';
import type { CarePassWizardState, CarePassWizardStepId } from '../utils/carePassWizard';
import { todayISOInTimeZone } from '../utils/datetime';
import { petAccent } from '../utils/petAccent';
import { petEmojiFor, petSpeciesLabel } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE, TONE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'CarePassWizard'>;

/** The quick day chips under the dates step: label + days from the start day. */
const DATE_CHIPS: ReadonlyArray<{ label: string; days: number }> = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '3 weeks', days: 21 },
];

export default function CarePassWizardScreen({ navigation }: Props): React.JSX.Element {
  const premium = usePremium();
  const { username, timeZone, loaded: accountLoaded } = useAccount();
  const { pets } = usePets();
  const { feedingSchedules, feedingForPet } = useFeeding();
  const { medications, medicationsForPet } = useMedications();
  const { vetRecordsForPet } = useVetRecords();
  const { getForPet: getCareInstructions } = useCareInstructions();
  const { createPass } = useSitter();
  const rootNavigation = useTabRootNavigation();

  const todayKey = useMemo(() => todayISOInTimeZone(new Date(), timeZone), [timeZone]);

  const [extras, setExtras] = useState<EmergencyExtrasByPet>({});
  const [extrasLoaded, setExtrasLoaded] = useState(false);
  const [state, setState] = useState<CarePassWizardState | null>(null);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  /** The stored check-in name, read once — it may only prefill, never dictate. */
  const storedName = useRef<string | null>(null);
  const started = useRef(false);

  // The emergency details are the one prefill source that is not in a context:
  // they are read from their own store, exactly like the emergency card does.
  useEffect(() => {
    let cancelled = false;
    emergencyDetailsRepository
      .load()
      .then((loaded) => {
        if (cancelled) return;
        setExtras(loaded);
        setExtrasLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setExtrasLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The wizard's opening state. Built once, as soon as the owner's own name and
  // the emergency details have loaded, so no box is filled from half-read data.
  useEffect(() => {
    if (!accountLoaded || !extrasLoaded || started.current) return;
    started.current = true;
    let cancelled = false;
    loadCaregiverName()
      .then((stored) => {
        const own = caregiverNameOrOwner(stored, username);
        if (!cancelled) {
          storedName.current = own;
          setState(wizardInit({ todayKey, ownerName: username, storedCaregiverName: own, pets }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState(wizardInit({ todayKey, ownerName: username, pets }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [accountLoaded, extrasLoaded, pets, todayKey, username]);

  /**
   * Fill in the notes of every selected pet that has none yet, from that pet's
   * own stores. A pet the owner has already written for is left exactly alone,
   * so going back and forward never overwrites their words.
   */
  const withPrefills = useCallback(
    (next: CarePassWizardState): CarePassWizardState => {
      let out = next;
      for (const petId of out.selectedPetIds) {
        if (out.petNotes[petId]) continue;
        out = wizardPrefillPet(
          out,
          prefilledPetNotes({
            petId,
            ownerName: out.creatorName || username,
            todayKey,
            feeding: feedingForPet(petId),
            medications: medicationsForPet(petId),
            careInstructions: getCareInstructions(petId),
            extras: extrasForPet(extras, petId),
            vetRecords: vetRecordsForPet(petId),
          }),
          petId,
        );
      }
      return out;
    },
    [
      extras,
      feedingForPet,
      getCareInstructions,
      medicationsForPet,
      todayKey,
      username,
      vetRecordsForPet,
    ],
  );

  const update = useCallback(
    (change: (current: CarePassWizardState) => CarePassWizardState) => {
      setProblem('');
      setState((current) => (current ? withPrefills(change(current)) : current));
    },
    [withPrefills],
  );

  /** Jump to another step without clearing state (the review's "change this"). */
  const goToStep = useCallback((id: CarePassWizardStepId) => {
    setState((current) => (current ? wizardGoTo(current, id) : current));
  }, []);

  const onSave = useCallback(async () => {
    if (!state || saving) return;
    const found = wizardCreateProblem(state);
    if (found) {
      // Inline, and on the step that fixes it — never an alert.
      setProblem(found.message);
      goToStep(found.step);
      return;
    }
    setProblem('');
    setSaving(true);
    try {
      const pass = await createPass(wizardPassInput(state, pets));
      // Straight to the pass: the invite code and the share entry live there.
      navigation.replace('CarePassDetail', { passId: pass.id });
    } finally {
      setSaving(false);
    }
  }, [createPass, goToStep, navigation, pets, saving, state]);

  if (!premium.isPremium()) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={BS.link}>‹ Sitter Mode</Text>
          </TouchableOpacity>
          <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>I’m Leaving Town</Text>
          <CarePassPremiumLock
            title="The Leaving Town wizard — Blueprint Premium"
            body="Eight guided steps build one care pass for the person looking after your pets — the pets, the days, their meals and medications, and who to call. Every fact is prefilled from your own records. Part of Blueprint Premium — start your 14-day free trial."
          />
        </ScrollView>
      </View>
    );
  }

  if (!state) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={BS.link}>‹ Sitter Mode</Text>
          </TouchableOpacity>
          <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>I’m Leaving Town</Text>
          <Text style={BS.body}>Reading your records…</Text>
        </ScrollView>
      </View>
    );
  }

  const step = wizardCurrentStep(state);
  const selected = wizardSelectedPets(state, pets);
  const last = !wizardHasNext(state);

  /* ------------------------------------------------------------ step 1 -- */
  const welcomeStep = (
    <>
      <Text style={BS.body}>
        A care pass is one page for whoever is looking after your pets while you’re away: which
        pets, which days, what they may do, and everything they need to know — meals,
        medication, and who to call.
      </Text>
      <CCCard glowTint={COLOR.blue} accent={COLOR.blue} style={{ marginTop: SPACE.s3 }}>
        <Text style={[BS.cardKicker, { color: TONE.blue.fg }]}>What happens</Text>
        <Text style={BS.cardTitleLg}>Eight quick steps</Text>
        {CARE_PASS_WIZARD_STEPS.map((item) => (
          <Text key={item.id} style={styles.stepListRow}>
            {item.emoji} {item.title}
          </Text>
        ))}
      </CCCard>
      <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
        The pets, the dates and your sitter’s details are the only things you have to fill in —
        everything else is prefilled from your own records and can be edited or left blank.
      </Text>
      <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
        When you finish you get a pass code and a pass file to hand over. Both stay on this
        device until you send them, and your sitter needs no account, no app of their own and no
        cloud.
      </Text>
    </>
  );

  /* ------------------------------------------------------------ step 2 -- */
  const petsStep = (
    <>
      <Text style={BS.body}>
        Pick the pets this pass covers. Each pet’s meals, medication and notes are prefilled from
        their own records on the next steps — you edit whatever isn’t right.
      </Text>
      {pets.length === 0 ? (
        <CCEmptyState
          emoji="🐾"
          title="Add a pet first"
          message="A care pass covers pets — add yours and come straight back here."
          actionLabel="Go to Pets"
          onAction={() => rootNavigation.navigate('Pets', { screen: 'PetList' })}
          testID="wizard-no-pets"
        />
      ) : (
        <>
          <TouchableOpacity
            style={[BS.tag, BS.tagNeutral, { alignSelf: 'flex-start', marginTop: SPACE.s3 }]}
            onPress={() => update((current) => wizardToggleAllPets(current, pets))}
            accessibilityRole="button"
            accessibilityLabel={wizardAllPetsLabel(state, pets)}
            testID="wizard-select-all-pets"
          >
            <Text style={BS.tagTextNeutral}>{wizardAllPetsLabel(state, pets)}</Text>
          </TouchableOpacity>
          {pets.map((pet) => {
            const picked = state.selectedPetIds.includes(pet.id);
            const accent = petAccent(pet.id);
            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petRow, picked && { borderColor: accent.fill }]}
                onPress={() => update((current) => wizardTogglePet(current, pet.id))}
                accessibilityRole="button"
                accessibilityLabel={`${picked ? 'Remove' : 'Add'} ${pet.name}`}
                testID={`wizard-pet-${pet.id}`}
              >
                <View style={[styles.avatarRing, picked && { borderColor: accent.fill }]}>
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
                  <Text style={BS.rowLabel}>{pet.name}</Text>
                  <Text style={BS.caption}>{petSpeciesLabel(pet)}</Text>
                </View>
                {picked ? <CCPill label="On the pass" tone="leaf" /> : null}
              </TouchableOpacity>
            );
          })}
          <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
            {state.selectedPetIds.length === 0
              ? 'No pets picked yet.'
              : `${state.selectedPetIds.length} of ${pets.length} picked.`}
          </Text>
        </>
      )}
    </>
  );

  /* ------------------------------------------------------------ step 3 -- */
  const caregiverStep = (
    <>
      <Text style={BS.body}>
        The pass is made out to one person — the neighbour, the sitter, the friend doing the
        rounds. Their name goes on the pass and on every check-in they record.
      </Text>
      <View style={[BS.field, { marginTop: SPACE.s3 }]}>
        <Text style={BS.fieldLabel}>Caregiver’s name</Text>
        <TextInput
          style={BS.input}
          value={state.caregiverName}
          onChangeText={(value) =>
            update((current) => ({ ...current, caregiverName: value, caregiverPrefilled: false }))
          }
          placeholder="e.g. Sam, next door"
          placeholderTextColor={COLOR.textFaint}
          accessibilityLabel="Caregiver name"
          testID="wizard-caregiver-input"
        />
      </View>
      {state.caregiverPrefilled && state.caregiverName.trim() ? (
        <Text style={[BS.caption, { marginTop: -SPACE.s2 }]}>
          Prefilled from {storedName.current === username ? 'your own name' : 'the name you check in with'}
          {' '}— edit it if someone else is sitting this time.
        </Text>
      ) : null}
      {wizardCaregiverNudge(state) ? (
        <Text style={styles.nudge} testID="wizard-caregiver-nudge">
          {wizardCaregiverNudge(state)}
        </Text>
      ) : null}
      <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
        You don’t have to decide now: the name is only needed when you create the pass, so you
        can walk through the rest of the steps first.
      </Text>
    </>
  );

  /* ------------------------------------------------------------ step 4 -- */
  const dateProblem = wizardDateError(state.startDate, state.endDate);
  const statusLine = wizardDatesStatusLine(state.startDate, state.endDate, todayKey);
  const datesStep = (
    <>
      <Text style={BS.body}>
        The days the pass runs. Both ends are included, and the pass reads as Active while today
        falls inside them — that is worked out on this device from the calendar.
      </Text>
      <View style={[BS.row, { marginTop: SPACE.s3 }]}>
        <View style={[BS.field, { flex: 1 }]}>
          <Text style={BS.fieldLabel}>From (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={state.startDate}
            onChangeText={(value) => update((current) => ({ ...current, startDate: value }))}
            placeholder={todayKey}
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="Start date"
            testID="wizard-start-date"
          />
        </View>
        <View style={[BS.field, { flex: 1 }]}>
          <Text style={BS.fieldLabel}>To (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={state.endDate}
            onChangeText={(value) => update((current) => ({ ...current, endDate: value }))}
            placeholder={wizardDayKey(todayKey, 7)}
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="End date"
            testID="wizard-end-date"
          />
        </View>
      </View>
      <TouchableOpacity
        style={[BS.tag, BS.tagNeutral, { alignSelf: 'flex-start' }]}
        onPress={() => update((current) => ({ ...current, startDate: todayKey }))}
        accessibilityRole="button"
        accessibilityLabel="Start today"
        testID="wizard-start-today"
      >
        <Text style={BS.tagTextNeutral}>Start today ({todayKey})</Text>
      </TouchableOpacity>
      <View style={[BS.rowWrap, { marginTop: SPACE.s2 }]}>
        {DATE_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.label}
            style={[BS.tag, BS.tagNeutral]}
            onPress={() =>
              update((current) => ({
                ...current,
                endDate: wizardDayKey(
                  isValidISODate(current.startDate) ? current.startDate : todayKey,
                  chip.days,
                ),
              }))
            }
            accessibilityRole="button"
            accessibilityLabel={`Run for ${chip.label}`}
            testID={`wizard-end-chip-${chip.days}`}
          >
            <Text style={BS.tagTextNeutral}>{chip.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {dateProblem ? (
        <Text style={styles.error} testID="wizard-dates-error">
          {dateProblem}
        </Text>
      ) : (
        statusLine ? (
          <Text style={[BS.caption, { marginTop: SPACE.s3 }]} testID="wizard-dates-status">
            {statusLine}
          </Text>
        ) : null
      )}
      <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
        Dates are plain calendar days, so nothing shifts if your sitter is in another time zone.
      </Text>
    </>
  );

  /* -------------------------------------------------------- steps 5 & 6 -- */
  const perPetStep = (kind: 'feeding' | 'medications') => (
    <>
      <Text style={BS.body}>
        {kind === 'feeding'
          ? 'What each pet eats, exactly as you want it followed. Everything below comes from the pet’s own feeding schedule and their food notes — edit it into the words your sitter needs, or leave it blank.'
          : 'The medication each pet is on today, from their own records. Same rule: edit it however helps, and leave a pet’s box blank if there is nothing to say.'}
      </Text>
      {selected.length === 0 ? (
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          No pets are on the pass yet — go back to the pets step and pick who it covers.
        </Text>
      ) : (
        selected.map((pet) => {
          const notes = wizardPetNotes(state, pet.id);
          const value = kind === 'feeding' ? notes.feeding : notes.medications;
          const accent = petAccent(pet.id);
          const prefilled = value.trim().length > 0;
          return (
            <CCCard key={pet.id} accent={accent.fill} style={{ marginTop: SPACE.s3 }}>
              <Text style={styles.petName}>
                {petEmojiFor(pet)} {pet.name}
              </Text>
              <TextInput
                style={[BS.input, styles.multiline]}
                value={value}
                onChangeText={(text) =>
                  update((current) =>
                    wizardSetPetNote(
                      current,
                      pet.id,
                      kind === 'feeding' ? { feeding: text } : { medications: text },
                    ),
                  )
                }
                multiline
                placeholder={
                  kind === 'feeding'
                    ? 'e.g. Breakfast 06:30 — 120 g of the usual kibble, soak it first'
                    : 'e.g. Carprofen 1 tablet at 08:00, give with food'
                }
                placeholderTextColor={COLOR.textFaint}
                accessibilityLabel={
                  kind === 'feeding'
                    ? `Feeding for ${pet.name}`
                    : `Medication for ${pet.name}`
                }
                testID={`wizard-${kind}-${pet.id}`}
              />
              <Text style={styles.quietSmall}>
                {prefilled
                  ? `Prefilled from ${pet.name}’s ${
                      kind === 'feeding' ? 'feeding schedule and food notes' : 'medication records'
                    } — edit anything that isn’t right.`
                  : `Nothing on file for ${pet.name} yet, so this is blank on purpose — write it in, or leave it out of the pass.`}
              </Text>
            </CCCard>
          );
        })
      )}
    </>
  );

  /* ------------------------------------------------------------ step 7 -- */
  const contactField = (
    petId: string,
    role: CarePassContactRole,
    field: 'name' | 'phone',
    label: string,
    placeholder: string,
  ): React.JSX.Element => (
    <View style={[BS.field, { flex: 1, marginBottom: SPACE.s2 }]}>
      <Text style={styles.miniLabel}>{label}</Text>
      <TextInput
        style={BS.input}
        value={wizardPetNotes(state, petId).contacts[role]?.[field] ?? ''}
        onChangeText={(text) =>
          update((current) => wizardSetPetContact(current, petId, role, field, text))
        }
        placeholder={placeholder}
        placeholderTextColor={COLOR.textFaint}
        keyboardType={field === 'phone' ? 'phone-pad' : 'default'}
        accessibilityLabel={`${label} for this pass`}
        testID={`wizard-contact-${petId}-${role}-${field}`}
      />
    </View>
  );

  const emergencyStep = (
    <>
      <Text style={BS.body}>
        Who to call about each pet. These are the same details as your printed emergency card, so
        anything you have already typed there is here already — and every box is optional.
      </Text>
      {selected.length === 0 ? (
        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          No pets are on the pass yet — go back to the pets step and pick who it covers.
        </Text>
      ) : (
        selected.map((pet) => {
          const notes = wizardPetNotes(state, pet.id);
          const accent = petAccent(pet.id);
          const known = CARE_PASS_CONTACT_ROLES.filter((role) =>
            contactDraftLine(notes.contacts[role]),
          );
          return (
            <CCCard key={pet.id} accent={accent.fill} style={{ marginTop: SPACE.s3 }}>
              <Text style={styles.petName}>
                {petEmojiFor(pet)} {pet.name}
              </Text>
              <Text style={styles.quietSmall}>
                {known.length === 0
                  ? `Nothing on file for ${pet.name} yet — fill in what you have and skip the rest.`
                  : `${known.length} of 4 contact lines already on file for ${pet.name}.`}
              </Text>
              {CARE_PASS_CONTACT_ROLES.map((role) => (
                <View key={role} style={{ marginTop: SPACE.s2 }}>
                  <Text style={styles.contactHeading}>{carePassContactRoleLabel(role)}</Text>
                  <View style={BS.row}>
                    {contactField(pet.id, role, 'name', 'Name', 'e.g. Dr Okafor')}
                    {contactField(pet.id, role, 'phone', 'Phone', 'e.g. 555 0100')}
                  </View>
                </View>
              ))}
              <View style={[BS.field, { marginTop: SPACE.s3, marginBottom: SPACE.s2 }]}>
                <Text style={styles.miniLabel}>Microchip number (optional)</Text>
                <TextInput
                  style={BS.input}
                  value={notes.microchip}
                  onChangeText={(text) =>
                    update((current) => wizardSetPetNote(current, pet.id, { microchip: text }))
                  }
                  placeholder="as printed on the chip paperwork"
                  placeholderTextColor={COLOR.textFaint}
                  accessibilityLabel={`Microchip for ${pet.name}`}
                  testID={`wizard-microchip-${pet.id}`}
                />
              </View>
              <View style={BS.field}>
                <Text style={styles.miniLabel}>Allergies & conditions (optional)</Text>
                <TextInput
                  style={[BS.input, styles.multiline]}
                  value={notes.allergies}
                  onChangeText={(text) =>
                    update((current) => wizardSetPetNote(current, pet.id, { allergies: text }))
                  }
                  multiline
                  placeholder="in your own words, e.g. allergic to chicken; epileptic, on daily meds"
                  placeholderTextColor={COLOR.textFaint}
                  accessibilityLabel={`Allergies for ${pet.name}`}
                  testID={`wizard-allergies-${pet.id}`}
                />
              </View>
            </CCCard>
          );
        })
      )}
      <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
        Nothing here is sent anywhere. It travels only inside the pass file you share with your
        sitter.
      </Text>
    </>
  );

  /* ------------------------------------------------------------ step 8 -- */
  const reviewBlocks = wizardReview(state, pets, {
    todayKey,
    permissionLabel: carePassPermissionLabel,
  });
  const reviewStep = (
    <>
      <View style={BS.field}>
        <Text style={BS.fieldLabel}>Your name (the pet parent)</Text>
        <TextInput
          style={BS.input}
          value={state.creatorName}
          onChangeText={(value) => update((current) => ({ ...current, creatorName: value }))}
          placeholder={`e.g. ${username}`}
          placeholderTextColor={COLOR.textFaint}
          accessibilityLabel="Your name"
          testID="wizard-creator-input"
        />
      </View>

      <View style={BS.field}>
        <Text style={BS.fieldLabel}>Household note (optional)</Text>
        <TextInput
          style={[BS.input, styles.multiline]}
          value={state.householdNote}
          onChangeText={(value) => update((current) => ({ ...current, householdNote: value }))}
          multiline
          placeholder="e.g. bins go out Tuesday night, spare key in the blue pot, alarm code 1234, plants on the windowsill"
          placeholderTextColor={COLOR.textFaint}
          accessibilityLabel="Household note"
          testID="wizard-household-note"
        />
      </View>

      <Text style={[BS.fieldLabel, { marginBottom: SPACE.s2 }]}>What may your sitter do?</Text>
      <View style={BS.seg}>
        {CARE_PASS_PERMISSION_LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[BS.segOpt, state.permissionLevel === level && BS.segOptActive]}
            onPress={() => update((current) => ({ ...current, permissionLevel: level }))}
            accessibilityRole="button"
            accessibilityLabel={carePassPermissionLabel(level)}
            testID={`wizard-permission-${level}`}
          >
            <Text style={state.permissionLevel === level ? BS.segTextActive : BS.segText}>
              {carePassPermissionLabel(level)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
        “Can update tasks” lets them record what they did — fed, walked, meds given — so it shows
        up on your care log with their name and the time.
      </Text>

      <Text style={[BS.fieldLabel, { marginTop: SPACE.s4, marginBottom: SPACE.s2 }]}>
        Sections in the pass
      </Text>
      <View style={BS.rowWrap}>
        {CARE_PASS_SECTIONS.map((section: CarePassSection) => {
          const on = state.visibleSections.includes(section);
          return (
            <TouchableOpacity
              key={section}
              style={[BS.tag, on && BS.tagActive]}
              onPress={() =>
                update((current) => ({
                  ...current,
                  visibleSections: on
                    ? current.visibleSections.filter((item) => item !== section)
                    : [...current.visibleSections, section],
                }))
              }
              accessibilityRole="button"
              accessibilityLabel={`Section ${carePassSectionLabel(section)}`}
              testID={`wizard-section-${section}`}
            >
              <Text style={on ? BS.tagTextActive : BS.tagText}>
                {carePassSectionLabel(section)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
        All nine start on — untick anything your sitter shouldn’t see.
      </Text>

      <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Review</Text>
      {reviewBlocks.map((block) => (
        <CCCard key={block.title} style={{ marginTop: SPACE.s3 }} testID={`wizard-review-${block.title}`}>
          <Text style={styles.blockTitle}>
            {block.emoji} {block.title}
          </Text>
          {block.rows.length === 0 && block.empty ? (
            <Text style={styles.quiet}>{block.empty}</Text>
          ) : (
            block.rows.map((row) => (
              <View key={`${block.title}-${row.label}`} style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>{row.label}</Text>
                <Text style={styles.reviewValue}>{row.value}</Text>
              </View>
            ))
          )}
        </CCCard>
      ))}
      <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
        Creating the pass writes it on this device and gives you a pass code to hand over — plus a
        pass file you can send straight to your sitter.
      </Text>
    </>
  );

  const body =
    step.id === 'welcome'
      ? welcomeStep
      : step.id === 'pets'
        ? petsStep
        : step.id === 'caregiver'
          ? caregiverStep
          : step.id === 'dates'
            ? datesStep
            : step.id === 'feeding'
              ? perPetStep('feeding')
              : step.id === 'medications'
                ? perPetStep('medications')
                : step.id === 'emergency'
                  ? emergencyStep
                  : reviewStep;

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <TouchableOpacity
            onPress={() => (state.stepIndex === 0 ? navigation.goBack() : update(wizardBack))}
            accessibilityRole="button"
            accessibilityLabel={state.stepIndex === 0 ? 'Back to Sitter Mode' : 'Previous step'}
            testID="wizard-back"
          >
            <Text style={BS.link}>
              {state.stepIndex === 0 ? '‹ Sitter Mode' : '‹ Back'}
            </Text>
          </TouchableOpacity>
          <Text style={BS.kicker} testID="wizard-step-indicator">
            {wizardStepIndicator(state)}
          </Text>
        </View>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>{step.eyebrow}</Text>
        <Text style={BS.h1}>{step.title}</Text>
        {body}

        {problem ? (
          <Text style={styles.error} testID="wizard-problem">
            {problem}
          </Text>
        ) : null}

        <View style={{ height: SPACE.s4 }} />
        {last ? (
          <CCButton
            label={saving ? 'Creating…' : 'Create & share'}
            emoji="🎟️"
            onPress={onSave}
            disabled={saving}
            accessibilityLabel="Create pass"
            testID="wizard-create"
          />
        ) : (
          <CCButton
            label="Next"
            emoji="→"
            onPress={() => update(wizardNext)}
            accessibilityLabel={`Next: ${CARE_PASS_WIZARD_STEPS[state.stepIndex + 1]?.title ?? ''}`}
            testID="wizard-next"
          />
        )}
        {state.stepIndex > 0 ? (
          <TouchableOpacity
            style={{ marginTop: SPACE.s3, alignSelf: 'center' }}
            onPress={() => update(wizardBack)}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
          >
            <Text style={BS.link}>Back</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[BS.caption, { marginTop: SPACE.s4, textAlign: 'center' }]}>
          Nothing is uploaded, and nothing is sent until you choose to share it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stepListRow: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: COLOR.text,
    marginTop: SPACE.s1,
  },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    padding: SPACE.s3,
    marginTop: SPACE.s2,
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
  },
  avatarRing: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 24, lineHeight: 30 },
  petName: {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: '700',
    color: COLOR.text,
  },
  multiline: { minHeight: 92, textAlignVertical: 'top', paddingTop: SPACE.s2 },
  quiet: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.textMuted,
    marginTop: SPACE.s1,
  },
  quietSmall: {
    fontFamily: FONT_BODY,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLOR.textFaint,
    marginTop: SPACE.s2,
  },
  miniLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
    marginBottom: SPACE.s1,
  },
  contactHeading: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: SPACE.s1,
  },
  nudge: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: TONE.sunshine.fg,
    backgroundColor: TONE.sunshine.bg,
    borderRadius: RADIUS.button,
    paddingVertical: SPACE.s2,
    paddingHorizontal: SPACE.s3,
    marginTop: SPACE.s1,
  },
  error: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: COLOR.accent2_700,
    marginTop: SPACE.s3,
  },
  blockTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: '700',
    color: COLOR.text,
    marginBottom: SPACE.s1,
  },
  reviewRow: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  reviewLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  reviewValue: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLOR.text,
    marginTop: 2,
  },
});
