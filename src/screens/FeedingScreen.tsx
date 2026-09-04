/**
 * Feeding tab — per-pet feeding schedules, fully working.
 *
 * Lists the active pet's meals (meal type, time, portion, repeat days, notes)
 * sorted by time, and lets the user add, edit, and delete entries. All data
 * flows through FeedingContext → feedingRepository → AsyncStorage; 100%
 * offline. No notifications — the schedule is display-only.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useFeeding } from '../context/FeedingContext';
import { usePets } from '../context/PetContext';
import { AppColors } from '../theme';
import {
  DAY_NAMES_SHORT,
  MEAL_TYPE_OPTIONS,
  PORTION_UNIT_OPTIONS,
  feedingDaysLabel,
  isValidTime,
} from '../types';
import type {
  FeedingSchedule,
  FeedingScheduleInput,
  MealType,
  PortionUnit,
} from '../types';

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start tracking feeding.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no feeding entries yet. */
function EmptyFeeding() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🍖</Text>
      <Text style={styles.emptyTitle}>No feeding schedule yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Meal” to record the first meal for this pet.
      </Text>
    </View>
  );
}

interface FormState {
  mealType: MealType;
  time: string;
  portionAmount: string;
  portionUnit: PortionUnit;
  notes: string;
  daysOfWeek: number[];
}

const emptyForm = (): FormState => ({
  mealType: 'Breakfast',
  time: '',
  portionAmount: '',
  portionUnit: 'g',
  notes: '',
  daysOfWeek: [],
});

function formFromFeeding(f: FeedingSchedule): FormState {
  return {
    mealType: f.mealType,
    time: f.time,
    portionAmount: String(f.portionAmount),
    portionUnit: f.portionUnit,
    notes: f.notes ?? '',
    daysOfWeek: [...f.daysOfWeek],
  };
}

interface FormModalProps {
  visible: boolean;
  editing: FeedingSchedule | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function FeedingFormModal({ visible, editing, saving, onCancel, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the entry's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromFeeding(editing) : emptyForm());
  }, [visible, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? 'Edit Meal' : 'New Meal'}
          </Text>

          <Text style={styles.label}>Meal</Text>
          <View style={styles.chipRow}>
            {MEAL_TYPE_OPTIONS.map((meal) => (
              <TouchableOpacity
                key={meal}
                style={[styles.chip, form.mealType === meal && styles.chipOn]}
                onPress={() => set('mealType', meal)}
              >
                <Text
                  style={[styles.chipText, form.mealType === meal && styles.chipTextOn]}
                >
                  {meal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Time * (24h, HH:mm)</Text>
          <TextInput
            style={styles.input}
            value={form.time}
            onChangeText={(v) => set('time', v)}
            placeholder="e.g. 08:00"
            placeholderTextColor="#999"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Portion *</Text>
          <View style={styles.twoCol}>
            <View style={[styles.col, { flex: 1 }]}>
              <TextInput
                style={styles.input}
                value={form.portionAmount}
                onChangeText={(v) => set('portionAmount', v)}
                placeholder="e.g. 150"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.col, { flex: 1.2 }]}>
              <View style={styles.chipRow}>
                {PORTION_UNIT_OPTIONS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[
                      styles.chip,
                      styles.unitChip,
                      form.portionUnit === unit && styles.chipOn,
                    ]}
                    onPress={() => set('portionUnit', unit)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        form.portionUnit === unit && styles.chipTextOn,
                      ]}
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={styles.label}>Days (none selected = every day)</Text>
          <View style={styles.chipRow}>
            {DAY_NAMES_SHORT.map((name, day) => (
              <TouchableOpacity
                key={name}
                style={[
                  styles.chip,
                  styles.dayChip,
                  form.daysOfWeek.includes(day) && styles.chipOn,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.daysOfWeek.includes(day) && styles.chipTextOn,
                  ]}
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.daysOfWeek.length > 0 && (
            <TouchableOpacity onPress={() => set('daysOfWeek', [])}>
              <Text style={styles.clearDays}>Clear (back to every day)</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. soak kibble in warm water"
            placeholderTextColor="#999"
            multiline
          />

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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Meal'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FeedingScreen() {
  const { activePet } = usePets();
  const { feedingForPet, addFeeding, updateFeeding, deleteFeeding } = useFeeding();

  const [formVisible, setFormVisible] = useState(false);
  const [editingFeeding, setEditingFeeding] = useState<FeedingSchedule | null>(null);
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
    setEditingFeeding(null);
    setFormVisible(true);
  };

  const openEdit = (f: FeedingSchedule) => {
    setEditingFeeding(f);
    setFormVisible(true);
  };

  const confirmDelete = (f: FeedingSchedule) => {
    Alert.alert(
      `Delete ${f.mealType} at ${f.time}?`,
      'This feeding entry will be permanently removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteFeeding(f.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  const submitForm = async (form: FormState) => {
    const time = form.time.trim().replace(/\s+/g, '');
    if (!isValidTime(time)) {
      Alert.alert(
        'Invalid time',
        'Enter a valid 24h time as HH:mm, e.g. 08:00 or 18:30.',
      );
      return;
    }
    const amount = Number(form.portionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid portion', 'Enter a portion amount greater than 0.');
      return;
    }
    const days = [...new Set(form.daysOfWeek)].filter(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6,
    );
    const input: FeedingScheduleInput = {
      petId,
      mealType: form.mealType,
      time,
      portionAmount: amount,
      portionUnit: form.portionUnit,
      notes: form.notes.trim() ? form.notes.trim() : undefined,
      daysOfWeek: days.sort((a, b) => a - b),
    };
    setSaving(true);
    try {
      if (editingFeeding) {
        await updateFeeding(editingFeeding.id, input);
      } else {
        await addFeeding(input);
      }
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = feedingForPet(petId);

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>🍖 Feeding</Text>
            <Text style={styles.subheading}>
              Feeding schedule for {activePet.name}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyFeeding />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>
                {item.mealType} · {item.time}
              </Text>
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
                ⏰ {item.time}
              </Text>
            </View>
            <Text style={styles.cardPortion}>
              🍽️ {item.portionAmount} {item.portionUnit}
            </Text>
            <Text style={styles.cardMeta}>{feedingDaysLabel(item.daysOfWeek)}</Text>
            {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
          </View>
        )}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Meal</Text>
      </TouchableOpacity>

      <FeedingFormModal
        visible={formVisible}
        editing={editingFeeding}
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
  headerBlock: { marginBottom: 16 },
  heading: { fontSize: 26, fontWeight: '800', color: AppColors.text },
  subheading: { fontSize: 14, color: AppColors.textMuted, marginTop: 2 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  emptyText: {
    fontSize: 14,
    color: AppColors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardName: { flex: 1, fontSize: 17, fontWeight: '700', color: AppColors.text },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: AppColors.primary },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  cardPortion: { fontSize: 14, color: AppColors.text, marginTop: 8, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: AppColors.textMuted, marginTop: 4 },
  cardNotes: { fontSize: 13, color: AppColors.text, marginTop: 4, fontStyle: 'italic' },
  addBtn: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: AppColors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addBtnText: { color: AppColors.white, fontSize: 17, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: AppColors.text, marginBottom: 12 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: AppColors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    marginBottom: 12,
  },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  chipTextOn: { color: AppColors.white },
  unitChip: { paddingHorizontal: 10, paddingVertical: 6 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 6 },
  clearDays: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
    marginBottom: 4,
  },
  twoCol: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  col: { flex: 1 },
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
