/**
 * Care instructions — the editor (Stage 2 of Sitter Mode).
 *
 * One pet's permanent care notes, written once by the pet parent and editable
 * any time: Food, Bathroom, Sleep, Behaviour and Quirks, each field a free-text
 * box with a hint of what belongs in it. Every field is optional — an owner
 * fills what they care about and leaves the rest blank.
 *
 * The form is generated from the field registry in
 * `../types/careInstructions`, so labels, order, group headings, hints, the
 * multi-line choice and each field's accessibility label all come from one
 * place — no screen types a field label of its own.
 *
 * Saving is a plain local write (`CareInstructionsContext.saveForPet` →
 * AsyncStorage); a pet has exactly one record, so saving again edits it. There
 * is nothing to validate and nothing to be premium: the notes are always free.
 *
 * 100% offline: local state and AsyncStorage only — no fetch, no upload.
 */
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { usePets } from '../context/PetContext';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import {
  CARE_INSTRUCTION_FIELDS,
  CARE_INSTRUCTION_GROUPS,
  careInstructionFieldsInGroup,
  careInstructionValue,
} from '../types';
import type {
  CareInstructions,
  CareInstructionFieldKey,
  CareInstructionValues,
} from '../types';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<PetsStackParamList, 'CareInstructionsEditor'>;

/** A record's written values, keyed by field — the editor's starting state. */
function valuesFrom(
  existing: CareInstructions | undefined | null,
): CareInstructionValues {
  const values: CareInstructionValues = {};
  for (const field of CARE_INSTRUCTION_FIELDS) {
    const value = careInstructionValue(existing, field.key);
    if (value) values[field.key] = value;
  }
  return values;
}

export default function CareInstructionsEditorScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const routePetId = route.params?.petId;
  const { pets, activePet } = usePets();
  const { getForPet, saveForPet } = useCareInstructions();

  const pet = (routePetId && pets.find((entry) => entry.id === routePetId)) || activePet;

  const [values, setValues] = useState<CareInstructionValues>(() =>
    valuesFrom(pet ? getForPet(pet.id) : undefined),
  );
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Whether anything typed differs from what is stored (so leaving asks first).
  const dirty = useMemo(() => {
    const stored = valuesFrom(pet ? getForPet(pet.id) : undefined);
    return CARE_INSTRUCTION_FIELDS.some(
      (field) => (values[field.key] ?? '') !== (stored[field.key] ?? ''),
    );
  }, [values, pet, getForPet]);

  const set = (key: CareInstructionFieldKey, text: string) =>
    setValues((prev) => ({ ...prev, [key]: text }));

  const onSave = async () => {
    if (!pet || saving) return;
    setSaving(true);
    try {
      await saveForPet(pet.id, values);
      // Back to the read view, which re-renders from the context we just wrote.
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const onBack = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    navigation.goBack();
  };

  if (!pet) {
    return (
      <View style={BS.screen}>
        <BackgroundCharacters />
        <ScrollView contentContainerStyle={BS.pad}>
          <Text style={BS.h1}>No pet selected</Text>
          <Text style={BS.italic}>Pick or add a pet on the Pets tab.</Text>
          <TouchableOpacity
            style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
            onPress={() => navigation.navigate('PetList')}
            accessibilityRole="button"
            accessibilityLabel="Back to Pets"
          >
            <Text style={BS.btnSecondaryText}>Back to Pets</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const existing = getForPet(pet.id);

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="care-instructions-editor-back"
        >
          <Text style={BS.link}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Care instructions</Text>
        <Text style={BS.kicker}>
          {petEmojiFor(pet)} {pet.name}
        </Text>
        <Text style={BS.body}>
          Write as much or as little as you like — every box is optional. These notes stay on
          this device, and they’re what a sitter reads in a Care Pass.
        </Text>

        {/* One block per group; every field comes from the registry. */}
        {CARE_INSTRUCTION_GROUPS.map((group) => (
          <View key={group.id} testID={`care-instructions-editor-group-${group.id}`}>
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>
              {group.emoji} {group.title}
            </Text>
            <Text style={[BS.caption, { marginBottom: SPACE.s3 }]}>{group.hint}</Text>
            {careInstructionFieldsInGroup(group.id).map((field) => (
              <View key={field.key} style={BS.field}>
                <Text style={BS.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={[
                    BS.input,
                    field.multiline && {
                      minHeight: 92,
                      paddingTop: SPACE.s2,
                      paddingBottom: SPACE.s2,
                      textAlignVertical: 'top',
                    },
                  ]}
                  value={values[field.key] ?? ''}
                  onChangeText={(text) => set(field.key, text)}
                  placeholder={field.placeholder}
                  placeholderTextColor={COLOR.textFaint}
                  multiline={field.multiline}
                  numberOfLines={field.multiline ? 4 : 1}
                  accessibilityLabel={field.label}
                  testID={`care-instructions-input-${field.key}`}
                />
              </View>
            ))}
          </View>
        ))}

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s3, opacity: saving ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save care instructions"
          testID="care-instructions-save"
        >
          <Text style={BS.btnPrimaryText}>
            {saving ? 'Saving…' : 'Save care instructions'}
          </Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          {existing
            ? 'Saving updates the notes you already wrote for this pet.'
            : 'Saves one set of notes for this pet — editable any time.'}
        </Text>

        {/* Leaving with unsaved edits asks first — inline, so it works on web. */}
        {confirmDiscard ? (
          <View style={[BS.card, { marginTop: SPACE.s4 }]} testID="care-instructions-discard">
            <Text style={BS.cardTitleLg}>Leave without saving?</Text>
            <Text style={BS.caption}>
              The changes you just typed won’t be kept.
            </Text>
            <TouchableOpacity
              style={BS.btnSecondary}
              onPress={() => setConfirmDiscard(false)}
              accessibilityRole="button"
              accessibilityLabel="Keep editing"
              testID="care-instructions-keep-editing"
            >
              <Text style={BS.btnSecondaryText}>Keep editing</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={BS.btnSecondary}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Discard changes"
              testID="care-instructions-discard-confirm"
            >
              <Text style={[BS.btnSecondaryText, { color: COLOR.accent2_700 }]}>
                Discard changes
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
