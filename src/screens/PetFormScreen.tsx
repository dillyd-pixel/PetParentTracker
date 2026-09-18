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
 *
 * The photo plate is a two-step choice: tapping it reveals "Take a photo"
 * (the camera) and "Choose from library" (the phone's photos). Both ask for
 * their own permission, keep the square crop, and store the picked file's local
 * URI on the pet — so the picture also shows on the Today tab and can be
 * replaced any time by editing the pet.
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  Platform,
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
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';

/** Which photo source the owner picked on the plate. */
type PhotoSource = 'camera' | 'library';

type Props = NativeStackScreenProps<RootStackParamList, 'PetForm'>;

const emptyForm = (): PetInput => ({
  name: '',
  species: 'Dog',
  customSpecies: '',
  breed: '',
  birthdate: '',
  weight: undefined,
  weightUnit: 'kg',
  photoUri: undefined,
});

/**
 * Tidy a typed species name ("  bunny " → "Bunny") on save: trimmed, with the
 * first letter capitalised so the label reads like the built-in species. Blank
 * becomes undefined, which is what an 'Other' pet with nothing typed stores.
 */
function tidyCustomSpecies(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export default function PetFormScreen({ navigation, route }: Props) {
  const { pets, addPet, updatePet } = usePets();
  const editingId = route.params?.petId;
  const editingPet = editingId ? pets.find((p) => p.id === editingId) : null;

  const [form, setForm] = useState<PetInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [photoChooserOpen, setPhotoChooserOpen] = useState(false);

  // Hydrate the form when editing an existing pet.
  useEffect(() => {
    if (editingPet) {
      setForm({
        name: editingPet.name,
        species: editingPet.species,
        customSpecies: editingPet.customSpecies ?? '',
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

  /**
   * Attach a photo from the chosen source. The camera asks for camera
   * permission and opens the camera; the library asks for photo-library
   * permission and opens the phone's photos. There is no camera on web, so the
   * "Take a photo" button falls back to the browser's own picker there (the
   * same rule AddRecordScreen uses). Either way the picked file's local URI is
   * all we keep — nothing is uploaded.
   */
  const pickPhoto = async (source: PhotoSource) => {
    setPhotoChooserOpen(false);
    const useCamera = source === 'camera' && Platform.OS !== 'web';
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        useCamera
          ? 'Allow camera access to photograph your pet. You can turn it back on in your phone’s settings.'
          : 'Allow photo library access to add a pet picture. You can turn it back on in your phone’s settings.',
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
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
      // Only an 'Other' pet carries a custom species; anything typed while
      // another species is selected is dropped rather than stored as dead data.
      customSpecies: form.species === 'Other' ? tidyCustomSpecies(form.customSpecies) : undefined,
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

        {/* Photo plate — tapping it offers the camera or the phone's library. */}
        <TouchableOpacity
          style={BS.petPhotoBox}
          onPress={() => setPhotoChooserOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={form.photoUri ? 'Change the pet photo' : 'Add a pet photo'}
        >
          {form.photoUri ? (
            <Image source={{ uri: form.photoUri }} style={{ flex: 1 }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 44 }}>
                {petEmojiFor(form)}
              </Text>
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>Tap to add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* The source step — camera or the phone's own photo library. */}
        {photoChooserOpen && (
          <View style={[BS.card, { marginTop: 0, marginBottom: SPACE.s3 }]}>
            <Text style={BS.cardKicker}>Pet photo</Text>
            <Text style={BS.caption}>
              Choose where the picture comes from. It is saved on this device only.
            </Text>
            <TouchableOpacity
              style={BS.btnPrimary}
              onPress={() => pickPhoto('camera')}
              accessibilityRole="button"
              accessibilityLabel="Take a photo"
            >
              <Text style={BS.btnPrimaryText}>Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={BS.btnSecondary}
              onPress={() => pickPhoto('library')}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
            >
              <Text style={BS.btnSecondaryText}>Choose from library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPhotoChooserOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel photo choice"
            >
              <Text style={[BS.link, { textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

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

        {/*
         * "Other" asks which species it actually is (fish, bunny, frog, horse…).
         * What's typed here becomes the pet's official species label on the
         * profile, the pet list, search and the PDF. The row only exists while
         * Other is selected; the typed text stays in state if the owner taps
         * another species and taps back.
         */}
        {form.species === 'Other' && (
          <View style={[BS.field, { marginTop: SPACE.s4 }]}>
            <Text style={BS.fieldLabel}>Species type</Text>
            <TextInput
              style={BS.input}
              value={form.customSpecies ?? ''}
              onChangeText={(v) => set('customSpecies', v)}
              placeholder="e.g. Fish, bunny, frog…"
              placeholderTextColor={COLOR.textFaint}
              accessibilityLabel="Species type"
            />
            <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
              Shown as the species on this pet’s profile.
            </Text>
          </View>
        )}

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
