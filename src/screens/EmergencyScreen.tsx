/**
 * 🚨 Pet emergency — Emergency Mode (Sitter Mode, unit 3 of 3). Free, offline.
 *
 * The screen a person opens in the first thirty seconds of a scare. For the
 * selected pet, on one scroll: who they are (photo, species, breed, age, the
 * latest weight on file), what they are allergic to and what conditions are
 * noted, the microchip number, the medication they are actually on today, how
 * they behave with strangers, and then every number that exists on this device
 * — the emergency vet, the primary vet, the pet parent and the second pet
 * parent — each with a Call button that hands the number to the phone's
 * dialler.
 *
 * The rules it keeps, in the copy and in the code:
 *  - nothing is invented: a field with nothing stored says "Not on file" and
 *    its Call button simply is not there (`phoneCallHref` decides);
 *  - nothing is typed twice: every line is read from a store that already
 *    exists — the pet's profile, the Emergency Card details (the same facts the
 *    printed card carries), the medication records, the vet records, the pet's
 *    care notes and the owner's own name from Settings;
 *  - no fear, no blame: the headline is warm, the missing lines are framed as
 *    "still to add" with one link to where they are filled in, and there is no
 *    red-alert language anywhere. Coral is the accent because this screen is
 *    about calling for help, not because something is wrong;
 *  - 100% offline: AsyncStorage reads only. The single outward act is
 *    `Linking.openURL('tel:…')` behind a Call button. No messaging, no share,
 *    no premium gate, no account.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import EmergencyCallButton from '../components/EmergencyCallButton';
import { CCCard, CCEmptyState } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { useVetRecords } from '../context/VetContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { emergencyDetailsRepository, extrasForPet } from '../storage/emergencyDetails';
import type { EmergencyExtrasByPet } from '../pdf/emergency/document';
import {
  EMERGENCY_BACK_TESTID,
  EMERGENCY_BLANK,
  buildEmergencyProfile,
  emergencyNeedsPicker,
  emergencyPetOptions,
  resolveEmergencyPet,
} from '../utils/emergencyMode';
import { petAccent } from '../utils/petAccent';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE, TONE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'Emergency'>;

/** One labelled line: the label, the value, and a quiet "Not on file" when blank. */
function FactLine({
  label,
  value,
  blank,
  testID,
  note,
}: {
  label: string;
  value: string;
  blank?: boolean;
  testID?: string;
  note?: string;
}): React.JSX.Element {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text
        style={[styles.lineValue, blank ? styles.lineBlank : null]}
        testID={testID}
      >
        {value}
      </Text>
      {note ? <Text style={styles.lineNote}>{note}</Text> : null}
    </View>
  );
}

export default function EmergencyScreen({ navigation, route }: Props): React.JSX.Element {
  const { pets } = usePets();
  const { username } = useAccount();
  const { medications } = useMedications();
  const { vetRecords } = useVetRecords();
  const { getForPet: getCareInstructions } = useCareInstructions();
  const rootNavigation = useTabRootNavigation();

  const [extras, setExtras] = useState<EmergencyExtrasByPet>({});
  const [chosenId, setChosenId] = useState<string | null>(route.params?.petId ?? null);

  // The card details are the one prefill source that is not in a context: they
  // are read from their own store, exactly like the printed card and the
  // Leaving Town wizard do.
  useEffect(() => {
    let cancelled = false;
    emergencyDetailsRepository
      .load()
      .then((loaded) => {
        if (!cancelled) setExtras(loaded);
      })
      .catch(() => {
        /* unreadable storage simply means "nothing on file" */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pet = useMemo(() => resolveEmergencyPet(pets, chosenId), [pets, chosenId]);

  const profile = useMemo(() => {
    if (!pet) return null;
    return buildEmergencyProfile({
      pet,
      ownerName: username,
      extras: extrasForPet(extras, pet.id),
      medications,
      vetRecords,
      careInstructions: getCareInstructions(pet.id),
    });
  }, [extras, getCareInstructions, medications, pet, username, vetRecords]);

  const options = useMemo(
    () => emergencyPetOptions(pets, pet ? pet.id : null),
    [pet, pets],
  );

  const accent = pet ? petAccent(pet.id) : null;

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to Sitter Mode"
          testID={EMERGENCY_BACK_TESTID}
        >
          <Text style={BS.link}>‹ Sitter Mode</Text>
        </TouchableOpacity>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>
          Sitter Mode · free · offline
        </Text>
        <Text style={BS.h1}>🚨 Pet emergency</Text>

        <Text style={BS.body}>
          {profile
            ? profile.headline
            : 'One sheet per pet: the numbers to call, then everything a vet or a sitter needs to know. All of it read straight off this device.'}
        </Text>

        {/* ---------------------------------------------------------- no pets -- */}
        {!profile ? (
          <CCEmptyState
            emoji="🐾"
            title="Add a pet first"
            message="Emergency Mode keeps one sheet per pet — their numbers, their medication, their chip. Add yours and come straight back here."
            actionLabel="Go to Pets"
            onAction={() => rootNavigation.navigate('Pets', { screen: 'PetList' })}
            testID="emergency-no-pets"
          />
        ) : (
          <>
            {/* -------------------------------------------------------- picker -- */}
            {emergencyNeedsPicker(pets) ? (
              <>
                <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Which pet?</Text>
                <View style={BS.rowWrap}>
                  {options.map((option) => (
                    <TouchableOpacity
                      key={option.petId}
                      style={[
                        BS.tag,
                        option.selected ? BS.tagAccent2 : BS.tagNeutral,
                        option.selected ? { borderColor: COLOR.coral } : null,
                      ]}
                      onPress={() => setChosenId(option.petId)}
                      accessibilityRole="button"
                      accessibilityLabel={`Emergency info for ${option.name}`}
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

            {/* ------------------------------------------------------ identity -- */}
            <CCCard
              glowTint={accent ? accent.fill : COLOR.coral}
              accent={COLOR.coral}
              style={{ marginTop: SPACE.s3 }}
            >
              <View style={styles.head}>
                <View
                  style={[
                    styles.avatarRing,
                    { borderColor: accent ? accent.fill : COLOR.coral },
                  ]}
                >
                  {profile.photoUri ? (
                    <Image
                      source={{ uri: profile.photoUri }}
                      style={styles.avatarPhoto}
                      resizeMode="cover"
                      accessibilityLabel={`${profile.petName}'s photo`}
                    />
                  ) : (
                    <Text style={styles.avatarEmoji}>{profile.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.petName} testID="emergency-pet-name">
                    {profile.petName}
                  </Text>
                  <Text style={BS.caption}>{profile.speciesLine}</Text>
                </View>
              </View>

              <FactLine
                label="Age"
                value={profile.ageLabel || EMERGENCY_BLANK}
                blank={profile.ageLabel.length === 0}
                testID="emergency-age"
              />
              <FactLine
                label="Weight"
                value={profile.weightLabel || EMERGENCY_BLANK}
                blank={profile.weightLabel.length === 0}
                note={profile.weightNote || undefined}
                testID="emergency-weight"
              />
              <Text style={styles.quiet}>{profile.readyLine}</Text>
            </CCCard>

            {/* ------------------------------------------------------ call now -- */}
            <CCCard glowTint={COLOR.coral} accent={COLOR.coral} style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.coral.fg }]}>
                {profile.calls.length > 0 ? 'One tap to dial' : 'Numbers still to add'}
              </Text>
              <Text style={BS.cardTitleLg}>Call now</Text>
              {profile.calls.length === 0 ? (
                <View style={[BS.dashedBox, { marginTop: SPACE.s2 }]}>
                  <Text style={BS.caption}>
                    No phone numbers are on file for {profile.petName} yet, so there is nothing
                    honest to dial. Add them once and a Call button appears next to each one.
                  </Text>
                </View>
              ) : (
                <>
                  {profile.calls.map((call) => (
                    <EmergencyCallButton
                      key={call.role}
                      label={call.label}
                      href={call.href}
                      phone={call.phone}
                      caption={call.who || undefined}
                      testID={call.testID}
                      accessibilityLabel={`${call.label} at ${call.phone}`}
                    />
                  ))}
                  <Text style={styles.quiet}>
                    Tapping a number hands it to this phone’s own dialler. Nothing is uploaded,
                    logged or shared.
                  </Text>
                </>
              )}
            </CCCard>

            {/* --------------------------------------------------------- facts -- */}
            <CCCard style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.coral.fg }]}>What to tell the vet</Text>
              <Text style={BS.cardTitleLg}>Allergies, chip & behaviour</Text>
              {profile.facts.map((row) => (
                <FactLine
                  key={row.key}
                  label={row.label}
                  value={row.value}
                  blank={row.blank}
                  testID={`emergency-fact-${row.key}`}
                />
              ))}
              <FactLine
                label="Behaviour note"
                value={profile.behaviour || EMERGENCY_BLANK}
                blank={profile.behaviour.length === 0}
                testID="emergency-fact-behaviour"
              />
              <FactLine
                label="With strangers"
                value={profile.withStrangers || EMERGENCY_BLANK}
                blank={profile.withStrangers.length === 0}
                testID="emergency-fact-strangers"
              />
              <Text style={styles.quiet}>
                Allergies, the chip and the behaviour line are your own words, typed once on the
                Emergency Card details — the same lines your printed card carries.
              </Text>
            </CCCard>

            {/* ---------------------------------------------------- medication -- */}
            <CCCard style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.tangerine.fg }]}>On medication today</Text>
              <Text style={BS.cardTitleLg}>Current medication</Text>
              {profile.medications.length === 0 ? (
                <Text style={[BS.caption, { marginTop: SPACE.s2 }]} testID="emergency-meds-empty">
                  {profile.medsNote}
                </Text>
              ) : (
                <>
                  {profile.medications.map((line) => (
                    <Text key={line} style={styles.medLine} testID="emergency-med-line">
                      💊 {line}
                    </Text>
                  ))}
                  <Text style={styles.quiet}>{profile.medsNote}</Text>
                </>
              )}
            </CCCard>

            {/* ----------------------------------------------------- contacts -- */}
            <CCCard style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.blue.fg }]}>Who to contact</Text>
              <Text style={BS.cardTitleLg}>People & practices</Text>
              {profile.contacts.map((contact) => (
                <View key={contact.role} style={styles.contactBlock}>
                  <Text style={styles.contactHeading}>{contact.label}</Text>
                  <Text
                    style={[styles.contactName, contact.blank ? styles.lineBlank : null]}
                    testID={`emergency-name-${contact.role}`}
                  >
                    {contact.name}
                  </Text>
                  {contact.detail ? <Text style={BS.caption}>{contact.detail}</Text> : null}
                  <Text
                    style={[
                      styles.contactPhone,
                      contact.phone === EMERGENCY_BLANK ? styles.lineBlank : null,
                    ]}
                    testID={`emergency-phone-${contact.role}`}
                  >
                    {contact.phone}
                  </Text>
                  {contact.call ? (
                    <EmergencyCallButton
                      label={contact.call.label}
                      href={contact.call.href}
                      phone={contact.call.phone}
                      testID={contact.call.testID}
                      accessibilityLabel={`${contact.call.label} at ${contact.call.phone}`}
                    />
                  ) : null}
                </View>
              ))}
            </CCCard>

            {/* ------------------------------------------------ still to add -- */}
            <CCCard style={{ marginTop: SPACE.s3 }}>
              <Text style={[BS.cardKicker, { color: TONE.sunshine.fg }]}>
                {profile.missing.length === 0 ? 'The sheet is complete' : 'Still to add'}
              </Text>
              <Text style={BS.cardTitleLg}>
                {profile.missing.length === 0
                  ? 'Nothing left blank'
                  : `${profile.missing.length} ${
                      profile.missing.length === 1 ? 'line' : 'lines'
                    } with nothing on file`}
              </Text>
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
                {profile.missing.length === 0
                  ? `Every line for ${profile.petName} has something on it. Anyone holding this phone would know exactly who to call.`
                  : `${profile.missing.join(' · ')}. Nothing is guessed here — a blank line stays blank until you fill it in, once, on the Emergency Card details.`}
              </Text>
              <TouchableOpacity
                style={[BS.tag, BS.tagNeutral, { alignSelf: 'flex-start', marginTop: SPACE.s3 }]}
                onPress={() => rootNavigation.navigate('More', { screen: 'EmergencyCard' })}
                accessibilityRole="button"
                accessibilityLabel="Open the emergency card details"
                testID="emergency-open-card-details"
              >
                <Text style={BS.tagTextNeutral}>Fill these in ›</Text>
              </TouchableOpacity>
            </CCCard>

            <Text style={[BS.caption, { marginTop: SPACE.s4, textAlign: 'center' }]}>
              Emergency Mode reads this device and nothing else. It is free, it works with no
              signal, and the Call buttons do one thing: dial the number you stored.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    marginBottom: SPACE.s2,
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    backgroundColor: COLOR.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 30, lineHeight: 38 },
  petName: {
    fontFamily: FONT_HEAD,
    fontSize: 21,
    fontWeight: '700',
    color: COLOR.text,
  },
  line: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  lineLabel: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  lineValue: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLOR.text,
    marginTop: 2,
  },
  lineBlank: { color: COLOR.textFaint, fontStyle: 'italic' },
  lineNote: {
    fontFamily: FONT_BODY,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLOR.textFaint,
    marginTop: 1,
  },
  quiet: {
    fontFamily: FONT_BODY,
    fontSize: 11.5,
    lineHeight: 17,
    color: COLOR.textFaint,
    marginTop: SPACE.s2,
  },
  medLine: {
    fontFamily: FONT_BODY,
    fontSize: 14.5,
    lineHeight: 21,
    color: COLOR.text,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  contactBlock: {
    marginTop: SPACE.s3,
    paddingTop: SPACE.s2,
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
  },
  contactHeading: {
    fontFamily: FONT_BODY,
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  contactName: {
    fontFamily: FONT_HEAD,
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
    marginTop: 1,
  },
  contactPhone: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: COLOR.text,
    marginTop: 1,
  },
});
