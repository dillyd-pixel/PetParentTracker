/**
 * Create a Care Pass — the pet parent's side of Sitter Mode.
 *
 * Collects the caregiver's name, the date range, which pets the pass covers,
 * what the sitter may do (view-only / update-tasks) and which care sections are
 * visible (every canonical section is on by default). On save the pass is
 * written to AsyncStorage with a fresh invite code, and the detail screen opens
 * so the code and the shareable file are right there.
 *
 * Premium-gated: creating a pass is part of Blueprint Premium, so a
 * non-entitled user sees the app's existing premium prompt in place of the
 * form (the home screen also routes them here only when entitled — this is the
 * second, defence-in-depth check).
 *
 * Validation is inline text rather than `Alert.alert`, which is a no-op in the
 * browser preview — the same message has to reach a user on both.
 *
 * 100% offline: the form writes local state, nothing else.
 */
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import { CarePassPremiumLock } from '../components/CarePassPremiumLock';
import { useAccount } from '../context/AccountContext';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { useSitter } from '../context/SitterContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import {
  CARE_PASS_PERMISSION_LEVELS,
  CARE_PASS_SECTIONS,
  carePassPermissionLabel,
  carePassSectionLabel,
  isValidISODate,
} from '../types';
import type { CarePassPermissionLevel, CarePassSection } from '../types';
import { petEmojiFor } from '../utils/petDisplay';
import { todayISOInTimeZone } from '../utils/datetime';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'CarePassForm'>;

/** A date `days` later than an ISO calendar day, as an ISO calendar day. */
function shiftDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const shifted = new Date(year, month - 1, day + days);
  const mm = String(shifted.getMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getDate()).padStart(2, '0');
  return `${shifted.getFullYear()}-${mm}-${dd}`;
}

export default function CarePassFormScreen({ navigation }: Props): React.JSX.Element {
  const premium = usePremium();
  const { username } = useAccount();
  const { pets } = usePets();
  const { createPass } = useSitter();

  const today = todayISOInTimeZone();
  // Left blank on purpose: the account name is the fallback at save time, so
  // the value can't go stale while the stored name is still being read.
  const [creatorName, setCreatorName] = useState('');
  const [caregiverName, setCaregiverName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(shiftDays(today, 7));
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [permissionLevel, setPermissionLevel] = useState<CarePassPermissionLevel>('view-only');
  // Every canonical section is on by default — the owner unticks what the
  // sitter must not see.
  const [visibleSections, setVisibleSections] = useState<CarePassSection[]>([
    ...CARE_PASS_SECTIONS,
  ]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const togglePet = (petId: string) => {
    setSelectedPetIds((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId],
    );
  };

  const toggleSection = (section: CarePassSection) => {
    setVisibleSections((prev) =>
      prev.includes(section) ? prev.filter((item) => item !== section) : [...prev, section],
    );
  };

  const onSave = async () => {
    if (saving) return;
    if (!caregiverName.trim()) {
      setError('Add the name of the person looking after your pets.');
      return;
    }
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
      setError('Dates need to be real calendar days, written as YYYY-MM-DD.');
      return;
    }
    if (endDate < startDate) {
      setError('The end date can’t be before the start date.');
      return;
    }
    if (selectedPetIds.length === 0) {
      setError('Pick at least one pet for this pass.');
      return;
    }
    if (visibleSections.length === 0) {
      setError('Pick at least one care section, or the pass shows nothing.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const pass = await createPass({
        creatorName: creatorName.trim() || username,
        caregiverName: caregiverName.trim(),
        selectedPetIds,
        startDate,
        endDate,
        permissionLevel,
        // Stored in the canonical order, so two equal selections compare equal.
        visibleSections: CARE_PASS_SECTIONS.filter((section) =>
          visibleSections.includes(section),
        ),
      });
      // Straight to the pass: the invite code and the share entry live there.
      navigation.replace('CarePassDetail', { passId: pass.id });
    } finally {
      setSaving(false);
    }
  };

  if (!premium.isPremium()) {
    return (
      <View style={BS.screen}>
        <BackgroundCharacters />
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={BS.link}>‹ Sitter Mode</Text>
          </TouchableOpacity>
          <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Create a Care Pass</Text>
          <CarePassPremiumLock />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={BS.link}>‹ Sitter Mode</Text>
        </TouchableOpacity>
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Create a Care Pass</Text>
        <Text style={BS.body}>
          Your sitter gets their own copy of this pass. It stays on their device — no account,
          no cloud.
        </Text>

        <View style={BS.field}>
          <Text style={BS.fieldLabel}>Your name (the pet parent)</Text>
          <TextInput
            style={BS.input}
            value={creatorName}
            onChangeText={setCreatorName}
            placeholder={`e.g. ${username}`}
            placeholderTextColor={COLOR.textFaint}
            accessibilityLabel="Your name"
          />
        </View>

        <View style={BS.field}>
          <Text style={BS.fieldLabel}>Sitter’s name</Text>
          <TextInput
            style={BS.input}
            value={caregiverName}
            onChangeText={setCaregiverName}
            placeholder="e.g. Sam, next door"
            placeholderTextColor={COLOR.textFaint}
            accessibilityLabel="Sitter's name"
          />
        </View>

        <View style={BS.row}>
          <View style={[BS.field, { flex: 1 }]}>
            <Text style={BS.fieldLabel}>Start (YYYY-MM-DD)</Text>
            <TextInput
              style={BS.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="2026-09-20"
              placeholderTextColor={COLOR.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="Start date"
            />
          </View>
          <View style={[BS.field, { flex: 1 }]}>
            <Text style={BS.fieldLabel}>End (YYYY-MM-DD)</Text>
            <TextInput
              style={BS.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="2026-09-27"
              placeholderTextColor={COLOR.textFaint}
              keyboardType="numbers-and-punctuation"
              accessibilityLabel="End date"
            />
          </View>
        </View>

        <Text style={[BS.fieldLabel, { marginBottom: SPACE.s2 }]}>Pets on this pass</Text>
        {pets.length === 0 ? (
          <Text style={BS.caption}>
            Add a pet first — a pass needs at least one pet to look after.
          </Text>
        ) : (
          <View style={BS.rowWrap}>
            {pets.map((pet) => {
              const selected = selectedPetIds.includes(pet.id);
              return (
                <TouchableOpacity
                  key={pet.id}
                  style={[BS.tag, selected && BS.tagActive]}
                  onPress={() => togglePet(pet.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Pet ${pet.name}`}
                >
                  <Text style={selected ? BS.tagTextActive : BS.tagText}>
                    {petEmojiFor(pet)} {pet.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4, marginBottom: SPACE.s2 }]}>
          What may the sitter do?
        </Text>
        <View style={BS.seg}>
          {CARE_PASS_PERMISSION_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[BS.segOpt, permissionLevel === level && BS.segOptActive]}
              onPress={() => setPermissionLevel(level)}
              accessibilityRole="button"
              accessibilityLabel={carePassPermissionLabel(level)}
            >
              <Text style={permissionLevel === level ? BS.segTextActive : BS.segText}>
                {carePassPermissionLabel(level)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4, marginBottom: SPACE.s2 }]}>
          Sections the sitter sees
        </Text>
        <View style={BS.rowWrap}>
          {CARE_PASS_SECTIONS.map((section) => {
            const selected = visibleSections.includes(section);
            return (
              <TouchableOpacity
                key={section}
                style={[BS.tag, selected && BS.tagActive]}
                onPress={() => toggleSection(section)}
                accessibilityRole="button"
                accessibilityLabel={`Section ${carePassSectionLabel(section)}`}
              >
                <Text style={selected ? BS.tagTextActive : BS.tagText}>
                  {carePassSectionLabel(section)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          All sections start on — untick anything your sitter shouldn’t see.
        </Text>

        {error ? (
          <Text style={{ color: COLOR.accent2_700, fontSize: 13, marginTop: SPACE.s3 }}>
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s4, opacity: saving ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Create pass"
        >
          <Text style={BS.btnPrimaryText}>{saving ? 'Creating…' : 'Create pass'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
