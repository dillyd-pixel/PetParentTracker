/**
 * Vaccines tab — per-pet vaccination records with premium due-date reminders.
 *
 * Lists the active pet's vaccines with client-side status badges (overdue,
 * due soon, up to date, or no due date — computed from today's date), and
 * lets the user add, edit, and delete records. The due-date reminder (a
 * Blueprint Premium feature) fires a local notification on the vaccine's
 * next-due date. All data flows through VaccinesContext → vaccineRepository
 * → AsyncStorage; 100% offline. No notifications on the web preview — the
 * reminder controls render with a note there.
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

import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { usePremium } from '../context/PremiumContext';
import { hasNotificationPermission } from '../storage/notifications';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { PremiumReminderRow } from '../components/PremiumReminderRow';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import { VACCINE_DUE_SOON_DAYS } from '../types';
import type { Vaccine, VaccineInput, VaccineStatus } from '../types';
import { shortDate } from '../utils/petDisplay';

type Props = NativeStackScreenProps<PetsStackParamList, 'Vaccines'>;

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

/** Relative "in 12 days / 12 days ago / due today" line for the row's right end. */
function dueInfo(v: Vaccine): string {
  if (!v.dueDate) return '';
  const d = daysUntil(v.dueDate);
  if (d > 0) return `in ${d} day${d === 1 ? '' : 's'}`;
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} ago`;
  return 'due today';
}

/**
 * Status tag — the design's chip: magenta for anything that needs attention
 * (overdue / due soon), neutral paper for a shot that is current.
 */
const STATUS_LABELS: Record<VaccineStatus, { label: string; alert: boolean }> = {
  overdue: { label: 'Overdue', alert: true },
  dueSoon: { label: 'Due soon', alert: true },
  upToDate: { label: 'Up to date', alert: false },
  noDueDate: { label: 'No due date', alert: false },
};

function StatusTag({ status }: { status: VaccineStatus }) {
  const cfg = STATUS_LABELS[status];
  return (
    <View style={[BS.tag, cfg.alert ? BS.tagAccent2 : BS.tagNeutral]}>
      <Text style={cfg.alert ? BS.tagTextAccent2 : BS.tagTextNeutral}>{cfg.label}</Text>
    </View>
  );
}

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={BS.pad}>
      <Text style={BS.h1}>No pet selected</Text>
      <Text style={BS.italic}>
        Pick or add a pet on the Pets tab to start tracking vaccines.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no vaccine records yet. */
function EmptyVaccines() {
  return (
    <Text style={BS.italic}>
      No shots on file for this pet yet. Tap “Add vaccine” to record the first one.
    </Text>
  );
}

interface FormState {
  name: string;
  dateGiven: string;
  dueDate: string;
  notes: string;
  reminderEnabled: boolean;
  photoUri: string | undefined;
}

const emptyForm = (): FormState => ({
  name: '',
  dateGiven: todayISO(),
  dueDate: '',
  notes: '',
  reminderEnabled: false,
  photoUri: undefined,
});

function formFromVaccine(v: Vaccine): FormState {
  return {
    name: v.name,
    dateGiven: v.dateGiven,
    dueDate: v.dueDate ?? '',
    notes: v.notes ?? '',
    reminderEnabled: v.reminderEnabled ?? false,
    photoUri: v.photoUri,
  };
}

interface FormModalProps {
  visible: boolean;
  editing: Vaccine | null;
  saving: boolean;
  notificationPermissionDenied: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function VaccineFormModal({
  visible,
  editing,
  saving,
  notificationPermissionDenied,
  onCancel,
  onSave,
}: FormModalProps) {
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
            {editing ? 'Edit vaccine' : 'New vaccine'}
          </Text>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>

          <Text style={[BS.fieldLabel, styles.label]}>Name *</Text>
          <TextInput
            style={BS.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Rabies (3-year)"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Date given * (YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={form.dateGiven}
            onChangeText={(v) => set('dateGiven', v)}
            placeholder="e.g. 2024-03-01"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[BS.fieldLabel, styles.label]}>Due date (optional, YYYY-MM-DD)</Text>
          <TextInput
            style={BS.input}
            value={form.dueDate}
            onChangeText={(v) => set('dueDate', v)}
            placeholder="e.g. 2025-03-01"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[BS.fieldLabel, styles.label]}>Notes (optional)</Text>
          <TextInput
            style={[BS.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. lot 12345, given at City Vet"
            placeholderTextColor={COLOR.textFaint}
            multiline
          />

          <Text style={[BS.fieldLabel, styles.label]}>
            Due-date reminder (Blueprint Premium)
          </Text>
          <PremiumReminderRow
            compact
            label="Remind me when this vaccine is due"
            value={form.reminderEnabled}
            onToggle={(v) => set('reminderEnabled', v)}
          />
          {form.reminderEnabled && !form.dueDate.trim() && (
            <Text style={styles.permissionNote}>
              Set a due date above so the reminder has a date to fire on.
            </Text>
          )}
          {form.reminderEnabled &&
            notificationPermissionDenied &&
            Platform.OS !== 'web' && (
              <Text style={styles.permissionNote}>
                Notifications are disabled in system settings — reminders will be
                saved but not delivered. Enable notifications for the app to arm
                them.
              </Text>
            )}

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
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add vaccine'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function VaccinesScreen({ navigation }: Props): React.JSX.Element {
  const { activePet } = usePets();
  const {
    vaccinesForPet,
    addVaccine,
    updateVaccine,
    deleteVaccine,
    toggleVaccineReminders,
  } = useVaccines();
  const { isPremium } = usePremium();

  const [formVisible, setFormVisible] = useState(false);
  const [editingVaccine, setEditingVaccine] = useState<Vaccine | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [reminderNotes, setReminderNotes] = useState<Record<string, string>>({});

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
      'This vaccination record will be permanently removed from this device and its scheduled reminder cancelled. This cannot be undone.',
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

  const onToggleReminders = async (v: Vaccine, enabled: boolean) => {
    const updated = await toggleVaccineReminders(v.id, enabled);
    setPermissionDenied(!(await hasNotificationPermission()));
    if (updated) {
      if (enabled) {
        flashReminderNote(
          v.id,
          Platform.OS === 'web'
            ? 'Reminders saved — not supported in the web preview'
            : updated.reminderEnabled
              ? 'Reminders scheduled 🔔'
              : 'Reminders not scheduled (permission denied)',
        );
      } else {
        flashReminderNote(v.id, 'Reminders cancelled');
      }
    }
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
      // Non-premium users can't arm reminders: always persist off. Premium
      // state can only change via the Premium screen, so gating at save keeps
      // stored data honest.
      reminderEnabled: isPremium() ? form.reminderEnabled : false,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingVaccine) {
        await updateVaccine(editingVaccine.id, input);
      } else {
        await addVaccine(input);
      }
      setPermissionDenied(!(await hasNotificationPermission()));
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = vaccinesForPet(petId);

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
            <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Vaccines</Text>
            <Text style={BS.kicker}>
              {records.length === 0
                ? 'No shots on file'
                : `${records.length} shot${records.length === 1 ? '' : 's'} on file`}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyVaccines />}
        renderItem={({ item }) => {
          const status = vaccineStatus(item);
          const relative = dueInfo(item);
          return (
            <View>
              <View style={styles.row}>
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={BS.thumb} />
                ) : (
                  <View style={[BS.thumb, BS.thumbBlank]} />
                )}
                <View style={styles.rowMain}>
                  <Text style={BS.rowLabel}>{item.name}</Text>
                  <Text style={BS.caption}>
                    Given {shortDate(item.dateGiven)}
                    {item.dueDate ? ` · due ${shortDate(item.dueDate)}` : ''}
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
                  <StatusTag status={status} />
                  {relative ? (
                    <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>{relative}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.reminderBlock}>
                <PremiumReminderRow
                  label="Due-date reminder"
                  value={item.reminderEnabled ?? false}
                  onToggle={(v) => onToggleReminders(item, v)}
                />
                {reminderNotes[item.id] ? (
                  <Text style={styles.reminderNote}>{reminderNotes[item.id]}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity style={BS.btnPrimary} onPress={openAdd} disabled={saving}>
          <Text style={BS.btnPrimaryText}>＋ Add vaccine</Text>
        </TouchableOpacity>
      </View>

      <VaccineFormModal
        visible={formVisible}
        editing={editingVaccine}
        saving={saving}
        notificationPermissionDenied={permissionDenied}
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

  /* Rows — the design's hairline list: thumb, label + caption, tag at the end. */
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
  reminderBlock: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  reminderNote: {
    fontSize: 12.5,
    color: COLOR.accent2_700,
    fontWeight: '600',
    marginTop: SPACE.s1,
  },

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
  permissionNote: { fontSize: 12, color: COLOR.accent2_700, lineHeight: 16, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: SPACE.s2, marginTop: SPACE.s4 },
  modalBtn: { flex: 1 },
  btnDisabled: { opacity: 0.45 },
});
