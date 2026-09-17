/**
 * Add a record — camera or library capture, straight onto the device.
 *
 * The design's capture flow: take a photo / choose a file, see the preview (or
 * a dashed "nothing attached yet" box), name it, tag the category and the pet,
 * then save. Saving writes a `VetRecord` through VetContext → AsyncStorage, so
 * the record appears immediately on this tab, on the pet's Vet records screen
 * and in premium search.
 *
 * The category tag rides in the record's `notes` (see utils/records) — no
 * schema change this phase.
 *
 * 100% offline: expo-image-picker reads the camera roll locally, the photo URI
 * is kept as-is, and nothing is uploaded anywhere.
 */
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { useVetRecords } from '../context/VetContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import type { RecordsStackParamList } from '../navigation/RecordsNavigator';
import { RECORD_CATEGORIES, categoryNotes } from '../utils/records';
import { todayISO } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<RecordsStackParamList, 'AddRecord'>;

export default function AddRecordScreen({ navigation }: Props): React.JSX.Element {
  const { pets, activePet } = usePets();
  const { addVetRecord } = useVetRecords();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(RECORD_CATEGORIES[0]);
  const [petId, setPetId] = useState<string | undefined>(activePet?.id ?? pets[0]?.id);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  /**
   * Attach a photo. `fromCamera` asks the camera for a permission and opens it;
   * the other button opens the library ("Choose file"). There is no camera roll
   * on web, so both buttons open the browser's picker there.
   */
  const pickImage = async (fromCamera: boolean) => {
    const useCamera = fromCamera && Platform.OS !== 'web';
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        useCamera
          ? 'Allow camera access to photograph a record.'
          : 'Allow photo library access to attach a record.',
      );
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets?.length) return;
    setPhotoUri(result.assets[0].uri);
  };

  const canSave = (title.trim().length > 0 || !!photoUri) && !!petId && !saving;

  const save = async () => {
    if (!canSave || !petId) return;
    setSaving(true);
    try {
      await addVetRecord({
        petId,
        visitTitle: title.trim() || 'Record',
        visitDate: todayISO(),
        notes: categoryNotes(category),
        photoUri,
      });
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={BS.link}>‹ Records</Text>
        </TouchableOpacity>
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Add a record</Text>

        <View style={BS.row}>
          <TouchableOpacity style={[BS.btnPrimary, { flex: 1 }]} onPress={() => pickImage(true)}>
            <Text style={BS.btnPrimaryText}>Take a photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[BS.btnSecondary, { flex: 1 }]} onPress={() => pickImage(false)}>
            <Text style={BS.btnSecondaryText}>Choose file</Text>
          </TouchableOpacity>
        </View>

        {photoUri ? (
          <Image source={{ uri: photoUri }} style={[BS.recordPreview, { marginTop: SPACE.s3 }]} />
        ) : (
          <View style={[BS.dashedBox, { marginTop: SPACE.s3 }]}>
            <Text style={BS.italic}>Nothing attached yet.</Text>
          </View>
        )}

        <View style={BS.field}>
          <Text style={BS.fieldLabel}>Title</Text>
          <TextInput
            style={BS.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Annual exam invoice"
            placeholderTextColor={COLOR.textFaint}
          />
        </View>

        <Text style={[BS.fieldLabel, { marginBottom: SPACE.s2 }]}>Category</Text>
        <View style={BS.rowWrap}>
          {RECORD_CATEGORIES.map((option) => (
            <TouchableOpacity
              key={option}
              style={[BS.tag, category === option && BS.tagActive]}
              onPress={() => setCategory(option)}
            >
              <Text style={category === option ? BS.tagTextActive : BS.tagText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {pets.length > 0 && (
          <>
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s4, marginBottom: SPACE.s2 }]}>
              Pet
            </Text>
            <View style={BS.rowWrap}>
              {pets.map((pet) => (
                <TouchableOpacity
                  key={pet.id}
                  style={[BS.tag, petId === pet.id && BS.tagActive]}
                  onPress={() => setPetId(pet.id)}
                >
                  <Text style={petId === pet.id ? BS.tagTextActive : BS.tagText}>{pet.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s4, opacity: canSave ? 1 : 0.45 }]}
          disabled={!canSave}
          onPress={save}
        >
          <Text style={BS.btnPrimaryText}>{saving ? 'Saving…' : 'Save to records'}</Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          Stored on your phone. Nothing leaves this device.
        </Text>
      </ScrollView>
    </View>
  );
}
