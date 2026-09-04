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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { useVetRecords } from '../context/VetContext';
import { usePets } from '../context/PetContext';
import { AppColors, cardShadow } from '../theme';
import { isValidISODate, vetCostLabel } from '../types';
import type { VetRecord, VetRecordInput } from '../types';

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start tracking vet records.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no vet records yet. */
function EmptyVetRecords() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🏥</Text>
      <Text style={styles.emptyTitle}>No vet records yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Visit” to record the first vet visit for this pet.
      </Text>
    </View>
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
            {editing ? 'Edit Visit' : 'New Vet Visit'}
          </Text>

          <Text style={styles.label}>Visit title *</Text>
          <TextInput
            style={styles.input}
            value={form.visitTitle}
            onChangeText={(v) => set('visitTitle', v)}
            placeholder="e.g. Annual checkup"
            placeholderTextColor={AppColors.placeholder}
          />

          <Text style={styles.label}>Visit date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.visitDate}
            onChangeText={(v) => set('visitDate', v)}
            placeholder="e.g. 2026-05-14"
            placeholderTextColor={AppColors.placeholder}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Clinic (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.clinicName}
            onChangeText={(v) => set('clinicName', v)}
            placeholder="e.g. Main Street Animal Hospital"
            placeholderTextColor={AppColors.placeholder}
          />

          <Text style={styles.label}>Veterinarian (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.veterinarian}
            onChangeText={(v) => set('veterinarian', v)}
            placeholder="e.g. Dr. Lee"
            placeholderTextColor={AppColors.placeholder}
          />

          <Text style={styles.label}>Cost (optional, your currency)</Text>
          <TextInput
            style={styles.input}
            value={form.cost}
            onChangeText={(v) => set('cost', v)}
            placeholder="e.g. 85.50"
            placeholderTextColor={AppColors.placeholder}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. vaccines given, follow-up in 6 months"
            placeholderTextColor={AppColors.placeholder}
            multiline
          />

          <Text style={styles.label}>Photo (optional)</Text>
          <View style={styles.photoRow}>
            <TouchableOpacity style={styles.photoBox} onPress={pickPhoto}>
              {form.photoUri ? (
                <Image source={{ uri: form.photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                  <Text style={styles.photoEmoji}>📷</Text>
                  <Text style={styles.photoHint}>Add photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {form.photoUri ? (
              <TouchableOpacity
                style={styles.photoRemoveBtn}
                onPress={() => set('photoUri', undefined)}
              >
                <Text style={[styles.photoRemoveText, { color: AppColors.danger }]}>
                  Remove photo
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.saveBtn, saving && styles.btnDisabled]}
              onPress={() => onSave(form)}
              disabled={saving}
            >
              <Text style={styles.saveText}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Visit'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function VetRecordsScreen() {
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
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>🏥 Vet Records</Text>
            <Text style={styles.subheading}>
              Vet visits for {activePet.name}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyVetRecords />}
        renderItem={({ item }) => {
          const cost = vetCostLabel(item.cost);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.visitTitle}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEdit(item)}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => confirmDelete(item)}
                  >
                    <Text style={[styles.actionText, { color: AppColors.danger }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: AppColors.primary + '1A' }]}>
                <Text style={[styles.badgeText, { color: AppColors.primary }]}>
                  📅 {item.visitDate}
                </Text>
              </View>
              {item.clinicName || item.veterinarian ? (
                <Text style={styles.cardMeta}>
                  {item.clinicName ? `🏨 ${item.clinicName}` : null}
                  {item.clinicName && item.veterinarian ? ' · ' : null}
                  {item.veterinarian ? `🩺 ${item.veterinarian}` : null}
                </Text>
              ) : null}
              {cost ? (
                <Text style={styles.cardCost}>💰 {cost}</Text>
              ) : null}
              {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} />
              ) : null}
            </View>
          );
        }}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Visit</Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: AppColors.background },
  list: { padding: 16, paddingBottom: 90 },
  headerBlock: { marginBottom: 20, marginTop: 4 },
  heading: { fontSize: 28, fontWeight: '800', color: AppColors.text },
  subheading: { fontSize: 15, color: AppColors.textMuted, marginTop: 4, lineHeight: 21 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingVertical: 40,
    paddingHorizontal: 24,
    marginTop: 8,
    ...cardShadow,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: AppColors.text },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    backgroundColor: AppColors.primary,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 18,
    ...cardShadow,
  },
  emptyCtaText: { color: AppColors.white, fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    ...cardShadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardName: { flex: 1, fontSize: 17, fontWeight: '700', color: AppColors.text },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: AppColors.primary },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  cardCost: { fontSize: 14, color: AppColors.text, marginTop: 8, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: AppColors.textMuted, marginTop: 4 },
  cardNotes: { fontSize: 13, color: AppColors.text, marginTop: 4, fontStyle: 'italic' },
  cardPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginTop: 10,
    backgroundColor: AppColors.border,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  photoBox: { borderRadius: 10 },
  photoPreview: { width: 88, height: 88, borderRadius: 12 },
  photoPlaceholder: {
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 24 },
  photoHint: { fontSize: 11, color: AppColors.textMuted, marginTop: 2 },
  photoRemoveBtn: { paddingVertical: 8, paddingHorizontal: 6 },
  photoRemoveText: { fontSize: 14, fontWeight: '600' },
  addBtn: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: AppColors.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    ...cardShadow,
  },
  addBtnText: { color: AppColors.white, fontSize: 17, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: AppColors.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: AppColors.text, marginBottom: 14 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: AppColors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 12,
  },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', marginTop: 12 },
  modalBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelBtn: { backgroundColor: AppColors.border },
  cancelText: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  saveBtn: { backgroundColor: AppColors.primary },
  btnDisabled: { opacity: 0.6 },
  saveText: { color: AppColors.white, fontSize: 15, fontWeight: '700' },
});
