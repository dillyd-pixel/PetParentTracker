/**
 * Vet Records tab — per-pet veterinary visit records, fully working.
 *
 * Lists the active pet's vet visits (title, date, clinic, vet, notes, cost)
 * sorted by visit date (newest first), and lets the user add, edit, and
 * delete records. All data flows through VetContext → vetRepository →
 * AsyncStorage; 100% offline. No notifications.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { useVetRecords } from '../context/VetContext';
import { usePets } from '../context/PetContext';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import { isValidISODate, vetCostLabel } from '../types';
import type { VetRecord, VetRecordInput } from '../types';
import { shortDate } from '../utils/petDisplay';
import { recordKind } from '../utils/records';

type Props = NativeStackScreenProps<PetsStackParamList, 'VetRecords'>;

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={BS.pad}>
      <Text style={BS.h1}>No pet selected</Text>
      <Text style={BS.italic}>
        Pick or add a pet on the Pets tab to start tracking vet records.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no vet records yet. */
function EmptyVetRecords() {
  return (
    <Text style={BS.italic}>
      Nothing filed for this pet yet. Tap “Add a visit” to start the file.
    </Text>
  );
}

interface FormState {
  visitTitle: string;
  visitDate: string;
  clinicName: string;
  veterinarian: string;
  notes: string;
  cost: string;
  photoUri: string | undefined;
}

const emptyForm = (): FormState => ({
  visitTitle: '',
  visitDate: '',
  clinicName: '',
  veterinarian: '',
  notes: '',
  cost: '',
  photoUri: undefined,
});

function formFromRecord(r: VetRecord): FormState {
  return {
    visitTitle: r.visitTitle,
    visitDate: r.visitDate,
    clinicName: r.clinicName ?? '',
    veterinarian: r.veterinarian ?? '',
    notes: r.notes ?? '',
    cost: r.cost === undefined ? '' : String(r.cost),
    photoUri: r.photoUri,
  };
}

interface FormModalProps {
  visible: boolean;
  editing: VetRecord | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function VetFormModal({ visible, editing, saving, onCancel, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the record's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromRecord(editing) : emptyForm());
  }, [visible, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Photo picking — same approach as VaccinesScreen/JournalScreen: local
  // library permission, launch the picker, keep the picked local file URI.
  // On-device only, works on Android and web (file input).
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to add a picture to this visit.',
      );
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? 'Edit visit' : 'New visit'}
          </Text>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>

          <Text style={[BS.fieldLabel, styles.label]}>Visit title *</Text>
          <TextInput
            style={BS.input}
            value={form.visitTitle}
            onChangeText={(v) => set('visitTitle', v)}
            placeholder="e.g. Annual checkup"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Visit date * (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={form.visitDate}
            onChangeText={(v) => set('visitDate', v)}
            placeholder="e.g. 2026-05-14"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[BS.fieldLabel, styles.label]}>Clinic (optional)</Text>
          <TextInput
            style={BS.input}
            value={form.clinicName}
            onChangeText={(v) => set('clinicName', v)}
            placeholder="e.g. Main Street Animal Hospital"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Veterinarian (optional)</Text>
          <TextInput
            style={BS.input}
            value={form.veterinarian}
            onChangeText={(v) => set('veterinarian', v)}
            placeholder="e.g. Dr. Lee"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Cost (optional, your currency)</Text>
          <TextInput
            style={BS.input}
            value={form.cost}
            onChangeText={(v) => set('cost', v)}
            placeholder="e.g. 85.50"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="decimal-pad"
          />

          <Text style={[BS.fieldLabel, styles.label]}>Notes (optional)</Text>
          <TextInput
            style={[BS.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. vaccines given, follow-up in 6 months"
            placeholderTextColor={COLOR.textFaint}
            multiline
          />

          <Text style={[BS.fieldLabel, styles.label]}>Photo (optional)</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBox} onPress={pickPhoto}>
              {form.photoUri ? (
                <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Text style={styles.photoHint}>Add photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {form.photoUri ? (
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => set('photoUri', undefined)}
              >
                <Text style={[styles.photoRemoveText, { color: COLOR.accent2_700 }]}>
                  Remove photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[BS.btnSecondary, styles.modalBtn]} onPress={onCancel}>
              <Text style={BS.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[BS.btnPrimary, styles.modalBtn, saving && styles.btnDisabled]}
              onPress={() => onSave(form)}
              disabled={saving}
            >
              <Text style={BS.btnPrimaryText}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add visit'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function VetRecordsScreen({ navigation }: Props): React.JSX.Element {
  const { activePet } = usePets();
  const { vetRecordsForPet, addVetRecord, updateVetRecord, deleteVetRecord } =
    useVetRecords();

  const [formVisible, setFormVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VetRecord | null>(null);
  const [saving, setSaving] = useState(false);

  // No active pet: prompt the user to pick/add one on Home.
  if (!activePet) {
    return (
      <View style={styles.container}>
        <BackgroundCharacters />
        <NoPetState />
      </View>
    );
  }
  // Capture the id once (non-null after the guard) so closures below stay typed.
  const petId = activePet.id;

  const openAdd = () => {
    setEditingRecord(null);
    setFormVisible(true);
  };

  const openEdit = (r: VetRecord) => {
    setEditingRecord(r);
    setFormVisible(true);
  };

  const confirmDelete = (r: VetRecord) => {
    Alert.alert(
      `Delete “${r.visitTitle}” on ${r.visitDate}?`,
      'This vet record will be permanently removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteVetRecord(r.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  const submitForm = async (form: FormState) => {
    const visitTitle = form.visitTitle.trim();
    const visitDate = form.visitDate.trim().replace(/\s+/g, '');
    if (!visitTitle) {
      Alert.alert('Missing title', 'Enter a title for the visit, e.g. “Annual checkup”.');
      return;
    }
    if (!isValidISODate(visitDate)) {
      Alert.alert(
        'Invalid date',
        'Enter a valid date as YYYY-MM-DD, e.g. 2026-05-14.',
      );
      return;
    }
    let cost: number | undefined;
    const costRaw = form.cost.trim();
    if (costRaw) {
      const parsed = Number(costRaw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert(
          'Invalid cost',
          'Enter a cost of 0 or more, e.g. 85.50 — or leave it empty.',
        );
        return;
      }
      cost = parsed;
    }
    const input: VetRecordInput = {
      petId,
      visitTitle,
      visitDate,
      clinicName: form.clinicName.trim() ? form.clinicName.trim() : undefined,
      veterinarian: form.veterinarian.trim()
        ? form.veterinarian.trim()
        : undefined,
      notes: form.notes.trim() ? form.notes.trim() : undefined,
      cost,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingRecord) {
        await updateVetRecord(editingRecord.id, input);
      } else {
        await addVetRecord(input);
      }
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = vetRecordsForPet(petId);

  return (
    <View style={styles.container}>
      <BackgroundCharacters />
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={BS.link}>‹ {activePet.name}</Text>
            </TouchableOpacity>
            <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Vet records</Text>
            <Text style={BS.kicker}>
              {records.length === 0
                ? 'Nothing filed yet'
                : `${records.length} visit${records.length === 1 ? '' : 's'} on file`}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyVetRecords />}
        renderItem={({ item }) => {
          const cost = vetCostLabel(item.cost);
          return (
            <View style={styles.row}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={BS.thumb} />
              ) : (
                <View style={[BS.thumb, BS.thumbBlank]} />
              )}
              <View style={styles.rowMain}>
                <Text style={BS.rowLabel}>{item.visitTitle}</Text>
                <Text style={BS.caption}>
                  {shortDate(item.visitDate)}
                  {item.clinicName ? ` · ${item.clinicName}` : ''}
                  {item.veterinarian ? ` · ${item.veterinarian}` : ''}
                </Text>
                {item.notes ? (
                  <Text style={[BS.caption, styles.notes]}>{item.notes}</Text>
                ) : null}
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => openEdit(item)}>
                    <Text style={BS.link}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => confirmDelete(item)}>
                    <Text style={[BS.link, { color: COLOR.accent2_700 }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.rowEnd}>
                <Text style={BS.rowLabel}>{cost ?? '—'}</Text>
                <Text style={BS.caption}>{recordKind(item.notes)}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity style={BS.btnPrimary} onPress={openAdd} disabled={saving}>
          <Text style={BS.btnPrimaryText}>＋ Add a visit</Text>
        </TouchableOpacity>
      </View>

      <VetFormModal
        visible={formVisible}
        editing={editingRecord}
        saving={saving}
        onCancel={() => setFormVisible(false)}
        onSave={submitForm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLOR.bg },
  list: { padding: SPACE.s4, paddingBottom: 120 },
  headerBlock: { marginBottom: SPACE.s3 },

  /* Rows — the design's hairline list: thumb, label + caption, cost at the end. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  rowMain: { flex: 1, marginLeft: SPACE.s2 },
  rowEnd: { alignItems: 'flex-end', marginLeft: SPACE.s2 },
  rowActions: { flexDirection: 'row', gap: SPACE.s3, marginTop: SPACE.s1 },
  notes: { fontStyle: 'italic' },

  /* Sticky primary action — the design's button, squared off on a hairline bar. */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACE.s3,
    paddingBottom: SPACE.s4,
    backgroundColor: COLOR.bg,
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
  },

  /* Add / edit sheet — paper, an ink rule across the top, no rounded corners. */
  modalOverlay: { flex: 1, backgroundColor: COLOR.scrim, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLOR.bg,
    borderTopWidth: 1.5,
    borderTopColor: COLOR.text,
    maxHeight: '92%',
  },
  modalScroll: { padding: SPACE.s4, paddingBottom: SPACE.s6 },
  modalTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 22,
    fontWeight: '700',
    color: COLOR.text,
    paddingHorizontal: SPACE.s4,
    paddingTop: SPACE.s4,
    marginBottom: SPACE.s2,
  },
  label: { marginTop: SPACE.s3 },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    marginBottom: SPACE.s2,
  },
  photoBox: { borderRadius: 2 },
  photoPreview: {
    width: 88,
    height: 88,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: COLOR.divider,
    backgroundColor: COLOR.surface,
  },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoHint: { fontSize: 12.5, fontStyle: 'italic', color: COLOR.textMuted },
  photoRemoveBtn: { paddingVertical: SPACE.s2, paddingHorizontal: SPACE.s1 },
  photoRemoveText: { fontSize: 13, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s4 },
  modalBtn: { flex: 1 },
  btnDisabled: { opacity: 0.45 },
});
