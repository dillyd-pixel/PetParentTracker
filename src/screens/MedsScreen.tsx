/**
 * Meds tab — per-pet medication records with local reminder notifications,
 * fully working.
 *
 * Lists the active pet's medications with their schedule (daily dose times or
 * every-N-days), dosage, and reminder arm/status. Lets the user add, edit,
 * toggle reminders, and delete records. Every reminder is a LOCAL
 * notification scheduled on-device by expo-notifications — no server, no
 * push. All data flows through MedicationsContext → medicationRepository →
 * AsyncStorage; 100% offline.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { hasNotificationPermission } from '../storage/notifications';
import { medicationScheduleLabel } from '../types';
import { AppColors } from '../theme';
import type { Medication, MedicationInput } from '../types';

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start tracking medications.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no medication records yet. */
function EmptyMeds() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>💊</Text>
      <Text style={styles.emptyTitle}>No medications yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Medication” to record the first one for this pet.
      </Text>
    </View>
  );
}

/**
 * Time list editor — the medication form has N "HH:mm" slots (contacts the
 * schedule model), backed by a single text field with comma-separated times.
 * Local text state keeps typing fluid (no re-parse on every keystroke); the
 * parsed result commits on blur. Text re-syncs from the form value only when
 * the field is (re)hydrated — i.e. when `resetKey` changes, which happens on
 * every open of the modal.
 */
function TimeListField({
  value,
  resetKey,
  onChange,
}: {
  value: string[]; // "HH:mm" entries
  resetKey: string;
  onChange: (times: string[]) => void;
}) {
  const [text, setText] = useState(value.join(', '));

  // Rehydrate local text only when the field is (re)opened (resetKey change) —
  // never mid-typing.
  useEffect(() => {
    setText(value.join(', '));
    // eslint intentionally exhaustive: only resetKey (or a changed value at
    // open time) should trigger a resync.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const commit = () => {
    const times = text
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onChange(times);
  };

  return (
    <TextInput
      style={[styles.input, styles.timesInput]}
      value={text}
      onChangeText={(next) => setText(next)}
      onEndEditing={commit}
      placeholder="08:00, 20:00"
      placeholderTextColor="#999"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

interface FormState {
  name: string;
  dosage: string;
  notes: string;
  scheduleMode: 'daily' | 'interval';
  times: string[];
  intervalDays: string;
  startDate: string;
  endDate: string;
  active: boolean;
  remindersEnabled: boolean;
}

const emptyForm = (): FormState => ({
  name: '',
  dosage: '',
  notes: '',
  scheduleMode: 'daily',
  times: [],
  intervalDays: '3',
  startDate: '',
  endDate: '',
  active: true,
  remindersEnabled: true,
});

function formFromMedication(m: Medication): FormState {
  const interval = m.intervalDays > 0;
  return {
    name: m.name,
    dosage: m.dosage,
    notes: m.notes ?? '',
    scheduleMode: interval ? 'interval' : 'daily',
    times: m.times,
    intervalDays: interval ? String(m.intervalDays) : '3',
    startDate: m.startDate ?? '',
    endDate: m.endDate ?? '',
    active: m.active,
    remindersEnabled: m.remindersEnabled,
  };
}

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function isValidTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface FormModalProps {
  visible: boolean;
  editing: Medication | null;
  saving: boolean;
  notificationPermissionDenied: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function MedicationFormModal({
  visible,
  editing,
  saving,
  notificationPermissionDenied,
  onCancel,
  onSave,
}: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  // Increments on every open so TimeListField rehydrates its local text.
  const [openCount, setOpenCount] = useState(0);

  // Hydrate on open: fresh form for "add", the record's values for "edit".
  useEffect(() => {
    if (visible) {
      setForm(editing ? formFromMedication(editing) : emptyForm());
      setOpenCount((c) => c + 1);
    }
  }, [visible, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing ? 'Edit Medication' : 'New Medication'}
          </Text>

          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Carprofen (Rimadyl)"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Dosage *</Text>
          <TextInput
            style={styles.input}
            value={form.dosage}
            onChangeText={(v) => set('dosage', v)}
            placeholder="e.g. 1 tablet"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Schedule</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeBtn, form.scheduleMode === 'daily' && styles.modeBtnOn]}
              onPress={() => set('scheduleMode', 'daily')}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  form.scheduleMode === 'daily' && styles.modeBtnTextOn,
                ]}
              >
                Daily times
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, form.scheduleMode === 'interval' && styles.modeBtnOn]}
              onPress={() => set('scheduleMode', 'interval')}
            >
              <Text
                style={[
                  styles.modeBtnText,
                  form.scheduleMode === 'interval' && styles.modeBtnTextOn,
                ]}
              >
                Every N days
              </Text>
            </TouchableOpacity>
          </View>

          {form.scheduleMode === 'daily' ? (
            <>
              <Text style={styles.label}>Dose times * (24h, comma separated)</Text>
              <TimeListField
                value={form.times}
                resetKey={`${editing?.id ?? 'new'}-${openCount}`}
                onChange={(times) => set('times', times)}
              />
              <Text style={styles.hint}>e.g. 08:00, 20:00 for twice a day.</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Every * days</Text>
              <TextInput
                style={styles.input}
                value={form.intervalDays}
                onChangeText={(v) => set('intervalDays', v)}
                placeholder="3"
                placeholderTextColor="#999"
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>
                Reminder fires each morning of every Nth day.
              </Text>
            </>
          )}

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.label}>Start date (optional)</Text>
              <TextInput
                style={styles.input}
                value={form.startDate}
                onChangeText={(v) => set('startDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>End date (optional)</Text>
              <TextInput
                style={styles.input}
                value={form.endDate}
                onChangeText={(v) => set('endDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#999"
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. give with food"
            placeholderTextColor="#999"
            multiline
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch
              value={form.active}
              onValueChange={(v) => set('active', v)}
              trackColor={{ false: '#ccc', true: AppColors.primary }}
              thumbColor={AppColors.white}
            />
          </View>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Reminders</Text>
            <Switch
              value={form.remindersEnabled}
              onValueChange={(v) => set('remindersEnabled', v)}
              trackColor={{ false: '#ccc', true: AppColors.primary }}
              thumbColor={AppColors.white}
            />
          </View>
          {form.remindersEnabled &&
            notificationPermissionDenied &&
            Platform.OS !== 'web' && (
              <Text style={styles.permissionNote}>
                Notifications are disabled in system settings — reminders will be
                saved but not delivered. Enable notifications for the app to arm
                them.
              </Text>
            )}
          {Platform.OS === 'web' && (
            <Text style={styles.permissionNote}>
              Notifications aren’t available in the web preview — reminders are
              saved with the medication but nothing is scheduled here. They work
              on the Android app.
            </Text>
          )}

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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Medication'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MedsScreen() {
  const { activePet } = usePets();
  const {
    medicationsForPet,
    addMedication,
    updateMedication,
    deleteMedication,
    toggleMedicationReminders,
  } = useMedications();

  const [formVisible, setFormVisible] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [reminderNotes, setReminderNotes] = useState<Record<string, string>>({});

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
    setEditingMedication(null);
    setFormVisible(true);
  };

  const openEdit = (m: Medication) => {
    setEditingMedication(m);
    setFormVisible(true);
  };

  const confirmDelete = (m: Medication) => {
    Alert.alert(
      `Delete ${m.name}?`,
      'This permanently removes the medication from this device and cancels its scheduled reminders. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteMedication(m.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  /** Show reminder status on the card after scheduling/cancelling. */
  const flashReminderNote = (id: string, text: string) => {
    setReminderNotes((prev) => ({ ...prev, [id]: text }));
    setTimeout(() => {
      setReminderNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 4000);
  };

  const onToggleReminders = async (m: Medication, enabled: boolean) => {
    const updated = await toggleMedicationReminders(m.id, enabled);
    setPermissionDenied(!(await hasNotificationPermission()));
    if (updated) {
      if (enabled) {
        flashReminderNote(
          m.id,
          Platform.OS === 'web'
            ? 'Reminders saved — not supported in the web preview'
            : updated.remindersEnabled
              ? 'Reminders scheduled 🔔'
              : 'Reminders not scheduled (permission denied)',
        );
      } else {
        flashReminderNote(m.id, 'Reminders cancelled');
      }
    }
  };

  const submitForm = async (form: FormState) => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Give this medication a name, e.g. "Carprofen".');
      return;
    }
    if (!form.dosage.trim()) {
      Alert.alert('Dosage required', 'Enter a dosage, e.g. "1 tablet".');
      return;
    }
    const times = form
      .times.map((t) => t.trim())
      .filter((t) => t.length > 0)
      .map((t) => t.replace(/\s+/g, ''));
    for (const t of times) {
      if (!isValidTime(t)) {
        Alert.alert(
          'Invalid time',
          `"${t}" is not a valid 24h time. Use HH:mm, e.g. 08:00 or 20:30.`,
        );
        return;
      }
    }
    if (form.scheduleMode === 'interval') {
      const n = Number(form.intervalDays);
      if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
        Alert.alert('Invalid interval', 'Enter a whole number of days (1 or more).');
        return;
      }
      // Interval mode: force times empty so the schedule model stays clean.
      if (times.length > 0) {
        Alert.alert(
          'Schedule conflict',
          'Pick either daily times or every-N-days, not both. Clear the times field to use every-N-days.',
        );
        return;
      }
    }
    if (form.startDate && !isValidISODate(form.startDate)) {
      Alert.alert('Invalid date', 'Start date must be YYYY-MM-DD, e.g. 2025-01-15.');
      return;
    }
    if (form.endDate && !isValidISODate(form.endDate)) {
      Alert.alert('Invalid date', 'End date must be YYYY-MM-DD, e.g. 2025-03-15.');
      return;
    }
    if (
      form.startDate &&
      form.endDate &&
      form.startDate > form.endDate
    ) {
      Alert.alert('Invalid dates', 'Start date must be on or before end date.');
      return;
    }

    const input: MedicationInput = {
      petId,
      name: form.name.trim(),
      dosage: form.dosage.trim(),
      notes: form.notes.trim() ? form.notes.trim() : undefined,
      times,
      intervalDays:
        form.scheduleMode === 'interval' ? Number(form.intervalDays) : 0,
      startDate: form.startDate.trim() ? form.startDate.trim() : undefined,
      endDate: form.endDate.trim() ? form.endDate.trim() : undefined,
      active: form.active,
      remindersEnabled: form.remindersEnabled,
    };
    setSaving(true);
    try {
      if (editingMedication) {
        await updateMedication(editingMedication.id, input);
      } else {
        await addMedication(input);
      }
      setPermissionDenied(!(await hasNotificationPermission()));
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = medicationsForPet(petId);

  return (
    <View style={styles.container}>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>💊 Medications</Text>
            <Text style={styles.subheading}>
              Medication schedule for {activePet.name}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyMeds />}
        renderItem={({ item }) => {
          const reminderNote = reminderNotes[item.id];
          return (
            <View style={[styles.card, !item.active && styles.cardInactive]}>
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
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: (item.active ? AppColors.primary : '#999') + '1A' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: item.active ? AppColors.primary : '#666' },
                    ]}
                  >
                    {item.active ? '● Active' : '○ Inactive'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: (item.remindersEnabled ? '#E67E22' : '#999') + '1A' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: item.remindersEnabled ? '#E67E22' : '#666' },
                    ]}
                  >
                    {item.remindersEnabled ? '🔔 Reminders on' : '🔕 Reminders off'}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDosage}>💊 {item.dosage}</Text>
              <Text style={styles.cardMeta}>{medicationScheduleLabel(item)}</Text>
              {item.startDate ? (
                <Text style={styles.cardMeta}>
                  Start: {item.startDate}
                  {item.endDate ? ` · End: ${item.endDate}` : ''}
                </Text>
              ) : item.endDate ? (
                <Text style={styles.cardMeta}>End: {item.endDate}</Text>
              ) : null}
              {item.notes ? (
                <Text style={styles.cardNotes}>{item.notes}</Text>
              ) : null}
              {reminderNote ? (
                <Text style={styles.reminderNote}>{reminderNote}</Text>
              ) : null}
              <View style={styles.reminderRow}>
                <Text style={styles.reminderLabel}>Reminders</Text>
                <Switch
                  value={item.remindersEnabled}
                  onValueChange={(v) => onToggleReminders(item, v)}
                  trackColor={{ false: '#ccc', true: '#E67E22' }}
                  thumbColor={AppColors.white}
                />
              </View>
            </View>
          );
        }}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Medication</Text>
      </TouchableOpacity>

      <MedicationFormModal
        visible={formVisible}
        editing={editingMedication}
        saving={saving}
        notificationPermissionDenied={permissionDenied}
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
  cardInactive: { opacity: 0.65 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  cardName: { flex: 1, fontSize: 17, fontWeight: '700', color: AppColors.text },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: AppColors.primary },
  badgeRow: { flexDirection: 'row', marginTop: 8, gap: 6 },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  cardDosage: { fontSize: 14, color: AppColors.text, marginTop: 8, fontWeight: '600' },
  cardMeta: { fontSize: 13, color: AppColors.textMuted, marginTop: 4 },
  cardNotes: {
    fontSize: 13,
    color: AppColors.text,
    marginTop: 4,
    fontStyle: 'italic',
  },
  reminderNote: { fontSize: 13, color: AppColors.danger, marginTop: 6, fontWeight: '600' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  reminderLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text },
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
  timesInput: { marginBottom: 4 },
  hint: { fontSize: 12, color: AppColors.textMuted, marginBottom: 8 },
  modeRow: { flexDirection: 'row', marginBottom: 8, gap: 8 },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeBtnOn: { backgroundColor: AppColors.primary, borderColor: AppColors.primary },
  modeBtnText: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  modeBtnTextOn: { color: AppColors.white },
  twoCol: { flexDirection: 'row', gap: 10 },
  col: { flex: 1 },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: AppColors.text },
  permissionNote: {
    fontSize: 12,
    color: AppColors.danger,
    marginTop: 6,
    lineHeight: 16,
  },
  modalActions: { flexDirection: 'row', marginTop: 16 },
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