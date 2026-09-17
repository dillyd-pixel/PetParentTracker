/**
 * PetForm — add or edit a pet, in the Broadsheet form language.
 *
 * Presented as a modal on top of the tabs. On save:
 *  - create: persists a new Pet via the context (which writes to AsyncStorage).
 *  - edit: updates the existing Pet in place.
 *
 * Layout follows the design's "Add a pet" page: the photo plate, the Name
 * field, a segmented Dog / Cat / Other control, then the remaining fields
 * (breed, birthdate, weight + unit) in the same paper-and-rule language, and a
 * single full-width primary button. Photo capture uses expo-image-picker to
 * grab a local file URI; all on-device, no upload.
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { SPECIES_OPTIONS, WEIGHT_UNIT_OPTIONS } from '../types';
import type { PetInput, Species, WeightUnit } from '../types';
import { petEmoji } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'PetForm'>;

const emptyForm = (): PetInput => ({
  name: '',
  species: 'Dog',
  breed: '',
  birthdate: '',
  weight: undefined,
  weightUnit: 'kg',
  photoUri: undefined,
});

export default function PetFormScreen({ navigation, route }: Props) {
  const { pets, addPet, updatePet } = usePets();
  const editingId = route.params?.petId;
  const editingPet = editingId ? pets.find((p) => p.id === editingId) : null;

  const [form, setForm] = useState<PetInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Hydrate the form when editing an existing pet.
  useEffect(() => {
    if (editingPet) {
      setForm({
        name: editingPet.name,
        species: editingPet.species,
        breed: editingPet.breed ?? '',
        birthdate: editingPet.birthdate ?? '',
        weight: editingPet.weight,
        weightUnit: editingPet.weightUnit ?? 'kg',
        photoUri: editingPet.photoUri,
      });
    }
  }, [editingPet]);

  const set = <K extends keyof PetInput>(key: K, value: PetInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a pet picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length) {
      set('photoUri', result.assets[0].uri);
    }
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Please give your pet a name.');
      return;
    }
    const input: PetInput = {
      ...form,
      name: form.name.trim(),
      weight: typeof form.weight === 'number' && form.weight > 0 ? form.weight : undefined,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingId && editingPet) {
        await updatePet(editingId, input);
      } else {
        await addPet(input);
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={BS.screen}>
      {/* Animal characters painted behind the form; the form itself is transparent. */}
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={BS.link}>‹ {editingId ? 'Pet page' : 'Pets'}</Text>
        </TouchableOpacity>
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>
          {editingId ? `Edit ${editingPet?.name ?? 'pet'}` : 'Add a pet'}
        </Text>

        {/* Photo plate — the design's box, showing the picked photo or a hint. */}
        <TouchableOpacity
          style={BS.petPhotoBox}
          onPress={pickPhoto}
          accessibilityLabel="Add a pet photo"
        >
          {form.photoUri ? (
            <Image source={{ uri: form.photoUri }} style={{ flex: 1 }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 44 }}>
                {petEmoji((form.species ?? 'Other') as Species)}
              </Text>
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>Tap to add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={BS.field}>
          <Text style={BS.fieldLabel}>Name</Text>
          <TextInput
            style={BS.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Luna"
            placeholderTextColor={COLOR.textFaint}
          />
        </View>

        <Text style={[BS.fieldLabel, { marginBottom: SPACE.s2 }]}>Species</Text>
        <View style={BS.seg}>
          {SPECIES_OPTIONS.map((species) => (
            <TouchableOpacity
              key={species}
              style={[BS.segOpt, form.species === species && BS.segOptActive]}
              onPress={() => set('species', species as Species)}
            >
              <Text style={form.species === species ? BS.segTextActive : BS.segText}>
                {species}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[BS.field, { marginTop: SPACE.s4 }]}>
          <Text style={BS.fieldLabel}>Breed (optional)</Text>
          <TextInput
            style={BS.input}
            value={form.breed}
            onChangeText={(v) => set('breed', v)}
            placeholder="e.g. Golden retriever"
            placeholderTextColor={COLOR.textFaint}
          />
        </View>

        <View style={BS.field}>
          <Text style={BS.fieldLabel}>Birthdate (optional, YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={form.birthdate}
            onChangeText={(v) => set('birthdate', v)}
            placeholder="e.g. 2021-04-12"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <Text style={[BS.fieldLabel, { marginBottom: SPACE.s2 }]}>Weight (optional)</Text>
        <View style={BS.row}>
          <TextInput
            style={[BS.input, { flex: 1 }]}
            value={form.weight != null ? String(form.weight) : ''}
            onChangeText={(v) => set('weight', v ? parseFloat(v) : undefined)}
            placeholder="0.0"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="decimal-pad"
          />
          <View style={[BS.seg, { flex: 1 }]}>
            {WEIGHT_UNIT_OPTIONS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[BS.segOpt, form.weightUnit === unit && BS.segOptActive]}
                onPress={() => set('weightUnit', unit as WeightUnit)}
              >
                <Text style={form.weightUnit === unit ? BS.segTextActive : BS.segText}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s4, opacity: saving ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={BS.btnPrimaryText}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create profile'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
