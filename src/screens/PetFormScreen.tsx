/**
 * PetForm — create and edit a pet.
 *
 * Presented as a modal on top of the tabs. On save:
 *  - create: persists a new Pet via the context (which writes to AsyncStorage).
 *  - edit: updates the existing Pet in place.
 * Photo capture uses expo-image-picker to grab a local file URI; the chosen
 * image URI is stored directly in the Pet record (all on-device, no upload).
 */
import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { AppColors } from '../theme';
import { SPECIES_OPTIONS, WEIGHT_UNIT_OPTIONS } from '../types';
import type { PetInput, Species, WeightUnit } from '../types';
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
      weight:
        typeof form.weight === 'number' && form.weight > 0 ? form.weight : undefined,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Photo picker */}
      <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto}>
        {form.photoUri ? (
          <Image source={{ uri: form.photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>📷</Text>
            <Text style={styles.photoHint}>Add photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Name */}
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={styles.input}
        value={form.name}
        onChangeText={(v) => set('name', v)}
        placeholder="e.g. Biscuit"
        placeholderTextColor={AppColors.placeholder}
      />

      {/* Species */}
      <Text style={styles.label}>Species</Text>
      <View style={styles.chipRow}>
        {SPECIES_OPTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, form.species === s && styles.chipActive]}
            onPress={() => set('species', s as Species)}
          >
            <Text
              style={[
                styles.chipText,
                form.species === s && styles.chipTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Breed */}
      <Text style={styles.label}>Breed (optional)</Text>
      <TextInput
        style={styles.input}
        value={form.breed}
        onChangeText={(v) => set('breed', v)}
        placeholder="e.g. Golden Retriever"
        placeholderTextColor={AppColors.placeholder}
      />

      {/* Birthdate */}
      <Text style={styles.label}>Birthdate (optional, YYYY-MM-DD)</Text>
      <TextInput
        style={styles.input}
        value={form.birthdate}
        onChangeText={(v) => set('birthdate', v)}
        placeholder="e.g. 2021-04-12"
        placeholderTextColor={AppColors.placeholder}
        keyboardType="numbers-and-punctuation"
      />

      {/* Weight */}
      <Text style={styles.label}>Weight (optional)</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.weightInput]}
          value={form.weight != null ? String(form.weight) : ''}
          onChangeText={(v) => set('weight', v ? parseFloat(v) : undefined)}
          placeholder="0.0"
          placeholderTextColor={AppColors.placeholder}
          keyboardType="decimal-pad"
        />
        <View style={styles.chipRow}>
          {WEIGHT_UNIT_OPTIONS.map((u) => (
            <TouchableOpacity
              key={u}
              style={[
                styles.chip,
                form.weightUnit === u && styles.chipActive,
              ]}
              onPress={() => set('weightUnit', u as WeightUnit)}
            >
              <Text
                style={[
                  styles.chipText,
                  form.weightUnit === u && styles.chipTextActive,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Pet'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  content: { padding: 20, paddingBottom: 48 },
  photoWrap: { alignSelf: 'center', marginBottom: 20 },
  photo: { width: 120, height: 120, borderRadius: 60, backgroundColor: AppColors.border },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 30 },
  photoHint: { fontSize: 12, color: AppColors.textMuted, marginTop: 2 },
  label: { fontSize: 14, fontWeight: '600', color: AppColors.text, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: AppColors.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  weightInput: { flex: 1, marginRight: 12 },
  chipRow: { flexDirection: 'row' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    marginRight: 8,
    backgroundColor: AppColors.card,
  },
  chipActive: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  chipText: { color: AppColors.text, fontWeight: '600' },
  chipTextActive: { color: AppColors.white },
  saveBtn: {
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: AppColors.white, fontSize: 17, fontWeight: '700' },
});