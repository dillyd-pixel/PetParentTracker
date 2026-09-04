/**
 * Vaccines tab — per-pet vaccination records, fully working.
 *
 * Lists the active pet's vaccines with client-side status badges (overdue,
 * due soon, up to date, or no due date — computed from today's date), and
 * lets the user add, edit, and delete records. All data flows through
 * VaccinesContext → vaccineRepository → AsyncStorage; 100% offline.
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

import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { AppColors, cardShadow } from '../theme';
import { VACCINE_DUE_SOON_DAYS } from '../types';
import type { Vaccine, VaccineInput, VaccineStatus } from '../types';

/** Local date helpers — all pure client-side, no timezone libraries. */

function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Whole days between today (local midnight) and an ISO date (negative = past). */
function daysUntil(dateISO: string): number {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseISODate(dateISO).getTime() - todayStart.getTime()) / 86400000);
}

/** Client-side status: overdue / due soon / up to date / no due date. */
function vaccineStatus(v: Vaccine): VaccineStatus {
  if (!v.dueDate) return 'noDueDate';
  const d = daysUntil(v.dueDate);
  if (d < 0) return 'overdue';
  if (d <= VACCINE_DUE_SOON_DAYS) return 'dueSoon';
  return 'upToDate';
}

/** Human "due in N days / N days ago / due today" suffix for the meta line. */
function dueInfo(v: Vaccine): string {
  if (!v.dueDate) return '';
  const d = daysUntil(v.dueDate);
  if (d > 0) return ` · due in ${d} day${d === 1 ? '' : 's'}`;
  if (d < 0) return ` · ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
  return ' · due today';
}

const STATUS_CONFIG: Record<VaccineStatus, { label: string; color: string; emoji: string }> = {
  overdue: { label: 'Overdue', color: AppColors.danger, emoji: '⚠️' },
  dueSoon: { label: 'Due soon', color: AppColors.accent, emoji: '⏳' },
  upToDate: { label: 'Up to date', color: AppColors.primary, emoji: '✅' },
  noDueDate: { label: 'No due date', color: AppColors.textMuted, emoji: '🌿' },
};

function StatusBadge({ status }: { status: VaccineStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.color + '1A' }]}>
      <Text style={[styles.badgeText, { color: cfg.color }]}>
        {cfg.emoji} {cfg.label}
      </Text>
    </View>
  );
}

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start tracking vaccines.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no vaccine records yet. */
function EmptyVaccines() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>💉</Text>
      <Text style={styles.emptyTitle}>No vaccines yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Vaccine” to record the first shot for this pet.
      </Text>
    </View>
  );
}

interface FormState {
  name: string;
  dateGiven: string;
  dueDate: string;
  notes: string;
  photoUri: string | undefined;
}

const emptyForm = (): FormState => ({
  name: '',
  dateGiven: todayISO(),
  dueDate: '',
  notes: '',
  photoUri: undefined,
});

function formFromVaccine(v: Vaccine): FormState {
  return {
    name: v.name,
    dateGiven: v.dateGiven,
    dueDate: v.dueDate ?? '',
    notes: v.notes ?? '',
    photoUri: v.photoUri,
  };
}

interface FormModalProps {
  visible: boolean;
  editing: Vaccine | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function VaccineFormModal({ visible, editing, saving, onCancel, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the record's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromVaccine(editing) : emptyForm());
  }, [visible, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Photo picking — same approach as JournalScreen: local library permission,
  // launch the picker, keep the picked local file URI. On-device only.
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to add a picture to this vaccine.',
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
            {editing ? 'Edit Vaccine' : 'New Vaccine'}
          </Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Rabies (3-year)"
            placeholderTextColor={AppColors.placeholder}
          />

          <Text style={styles.label}>Date given * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.dateGiven}
            onChangeText={(v) => set('dateGiven', v)}
            placeholder="e.g. 2024-03-01"
            placeholderTextColor={AppColors.placeholder}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Due date (optional, YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.dueDate}
            onChangeText={(v) => set('dueDate', v)}
            placeholder="e.g. 2025-03-01"
            placeholderTextColor={AppColors.placeholder}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. lot 12345, given at City Vet"
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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Vaccine'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function VaccinesScreen() {
  const { activePet } = usePets();
  const { vaccinesForPet, addVaccine, updateVaccine, deleteVaccine } = useVaccines();

  const [formVisible, setFormVisible] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
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
    setEditingVaccine(null);
    setFormVisible(true);
  };

  const openEdit = (v: Vaccine) => {
    setEditingVaccine(v);
    setFormVisible(true);
  };

  const confirmDelete = (v: Vaccine) => {
    Alert.alert(
      `Delete ${v.name}?`,
      'This vaccination record will be permanently removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteVaccine(v.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  const submitForm = async (form: FormState) => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give this vaccine a name, e.g. "Rabies".');
      return;
    }
    if (!isValidISODate(form.dateGiven)) {
      Alert.alert('Invalid date', 'Date given must be YYYY-MM-DD, e.g. 2024-03-01.');
      return;
    }
    if (form.dueDate && !isValidISODate(form.dueDate)) {
      Alert.alert('Invalid date', 'Due date must be YYYY-MM-DD, e.g. 2025-03-01.');
      return;
    }
    const input: VaccineInput = {
      petId,
      name: form.name.trim(),
      dateGiven: form.dateGiven,
      dueDate: form.dueDate.trim() ? form.dueDate.trim() : undefined,
      notes: form.notes.trim() ? form.notes.trim() : undefined,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingVaccine) {
        await updateVaccine(editingVaccine.id, input);
      } else {
        await addVaccine(input);
      }
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = vaccinesForPet(petId);

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>💉 Vaccines</Text>
            <Text style={styles.subheading}>
              Vaccination records for {activePet.name}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyVaccines />}
        renderItem={({ item }) => {
          const status = vaccineStatus(item);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardName}>{item.name}</Text>
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
              <StatusBadge status={status} />
              <Text style={styles.cardMeta}>
                Given: {item.dateGiven}
                {item.dueDate ? ` · Due: ${item.dueDate}${dueInfo(item)}` : ''}
              </Text>
              {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} />
              ) : null}
            </View>
          );
        }}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Vaccine</Text>
      </TouchableOpacity>

      <VaccineFormModal
        visible={formVisible}
        editing={editingVaccine}
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
  cardMeta: { fontSize: 13, color: AppColors.textMuted, marginTop: 6 },
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
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
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