/**
 * Meds tab — per-pet medication records with premium local reminders.
 *
 * Lists the active pet's medications with their schedule (daily dose times or
 * every-N-days), dosage, and reminder arm/status. Lets the user add, edit,
 * toggle reminders, and delete records. Reminder scheduling is a Blueprint
 * Premium feature: non-premium users see a lock row routing to the Premium
 * screen, and existing scheduled notifications are never removed on the
 * upgrade path — only the scheduling UI/action is gated. Every reminder is a
 * LOCAL notification scheduled on-device by expo-notifications — no server,
 * no push. All data flows through MedicationsContext → medicationRepository →
 * AsyncStorage; 100% offline.
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';

import { useMedications } from '../context/MedicationsContext';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { hasNotificationPermission } from '../storage/notifications';
import { medicationScheduleLabel } from '../types';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { PremiumReminderRow } from '../components/PremiumReminderRow';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import type { Medication, MedicationInput } from '../types';

type Props = NativeStackScreenProps<PetsStackParamList, 'Meds'>;

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={BS.pad}>
      <Text style={BS.h1}>No pet selected</Text>
      <Text style={BS.italic}>
        Pick or add a pet on the Pets tab to start tracking medications.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no medication records yet. */
function EmptyMeds() {
  return (
    <Text style={BS.italic}>
      No medications logged for this pet yet. Tap “Add medication” to start the dose list.
    </Text>
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
      style={[BS.input, styles.timesInput]}
      value={text}
      onChangeText={(next) => setText(next)}
      onEndEditing={commit}
      placeholder="08:00, 20:00"
      placeholderTextColor={COLOR.textFaint}
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
  photoUri: string | undefined;
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
  photoUri: undefined,
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
    photoUri: m.photoUri,
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

  // Photo picking — same approach as VaccinesScreen/JournalScreen: local
  // library permission, launch the picker, keep the picked local file URI.
  // On-device only, works on Android and web (file input).
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to add a picture to this medication.',
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
            {editing ? 'Edit medication' : 'New medication'}
          </Text>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>

          <Text style={[BS.fieldLabel, styles.label]}>Name *</Text>
          <TextInput
            style={BS.input}
            value={form.name}
            onChangeText={(v) => set('name', v)}
            placeholder="e.g. Carprofen (Rimadyl)"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Dosage *</Text>
          <TextInput
            style={BS.input}
            value={form.dosage}
            onChangeText={(v) => set('dosage', v)}
            placeholder="e.g. 1 tablet"
            placeholderTextColor={COLOR.textFaint}
          />

          <Text style={[BS.fieldLabel, styles.label]}>Schedule</Text>
          <View style={BS.seg}>
            <TouchableOpacity
              style={[BS.segOpt, form.scheduleMode === 'daily' && BS.segOptActive]}
              onPress={() => set('scheduleMode', 'daily')}
            >
              <Text
                style={form.scheduleMode === 'daily' ? BS.segTextActive : BS.segText}
              >
                Daily times
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[BS.segOpt, form.scheduleMode === 'interval' && BS.segOptActive]}
              onPress={() => set('scheduleMode', 'interval')}
            >
              <Text
                style={form.scheduleMode === 'interval' ? BS.segTextActive : BS.segText}
              >
                Every N days
              </Text>
            </TouchableOpacity>
          </View>

          {form.scheduleMode === 'daily' ? (
            <>
              <Text style={[BS.fieldLabel, styles.label]}>Dose times * (24h, comma separated)</Text>
              <TimeListField
                value={form.times}
                resetKey={`${editing?.id ?? 'new'}-${openCount}`}
                onChange={(times) => set('times', times)}
              />
              <Text style={styles.hint}>e.g. 08:00, 20:00 for twice a day.</Text>
            </>
          ) : (
            <>
              <Text style={[BS.fieldLabel, styles.label]}>Every * days</Text>
              <TextInput
                style={BS.input}
                value={form.intervalDays}
                onChangeText={(v) => set('intervalDays', v)}
                placeholder="3"
                placeholderTextColor={COLOR.textFaint}
                keyboardType="number-pad"
              />
              <Text style={styles.hint}>
                Reminder fires each morning of every Nth day.
              </Text>
            </>
          )}

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={[BS.fieldLabel, styles.label]}>Start date (optional)</Text>
              <TextInput
                style={BS.input}
                value={form.startDate}
                onChangeText={(v) => set('startDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLOR.textFaint}
                keyboardType="numbers-and-punctuation"
              />
            </View>
            <View style={styles.col}>
              <Text style={[BS.fieldLabel, styles.label]}>End date (optional)</Text>
              <TextInput
                style={BS.input}
                value={form.endDate}
                onChangeText={(v) => set('endDate', v)}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={COLOR.textFaint}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>

          <Text style={[BS.fieldLabel, styles.label]}>Notes (optional)</Text>
          <TextInput
            style={[BS.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. give with food"
            placeholderTextColor={COLOR.textFaint}
            multiline
          />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch
              value={form.active}
              onValueChange={(v) => set('active', v)}
              trackColor={{ false: COLOR.divider, true: COLOR.accent }}
              thumbColor={COLOR.bg}
            />
          </View>
          <Text style={[BS.fieldLabel, styles.label]}>Medication reminders (Blueprint Premium)</Text>
          <PremiumReminderRow
            compact
            label="Reminders"
            value={form.remindersEnabled}
            onToggle={(v) => set('remindersEnabled', v)}
          />
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
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add medication'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function MedsScreen({ navigation }: Props): React.JSX.Element {
  const { activePet } = usePets();
  const {
    medicationsForPet,
    addMedication,
    updateMedication,
    deleteMedication,
    toggleMedicationReminders,
  } = useMedications();
  const { isPremium } = usePremium();

  const [formVisible, setFormVisible] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
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
    // Premium gate on the scheduling ACTION (not on stored data): turning
    // reminders OFF is always allowed (cleanup), turning them ON requires
    // premium. Existing scheduled notifications are never removed here.
    if (enabled && !isPremium()) return;
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
      // Premium gate: non-premium users can't arm new reminders, but turning
      // reminders OFF (or leaving them off) always saves. Existing scheduled
      // notifications are never removed by this gate.
      remindersEnabled: isPremium()
        ? form.remindersEnabled
        : editingMedication
          ? editingMedication.remindersEnabled && form.remindersEnabled
          : false,
      photoUri: form.photoUri,
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
            <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Medications</Text>
            <Text style={BS.kicker}>
              {records.length === 0
                ? 'No medications'
                : `${records.length} on file · ${records.filter((m) => m.active).length} active`}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyMeds />}
        renderItem={({ item }) => {
          const reminderNote = reminderNotes[item.id];
          const doseTime =
            item.times.length > 0
              ? item.times.join(' · ')
              : item.intervalDays > 0
                ? `every ${item.intervalDays}d`
                : '';
          return (
            <View>
              <View style={styles.row}>
                {item.photoUri ? (
                  <Image source={{ uri: item.photoUri }} style={BS.thumb} />
                ) : (
                  <View style={[BS.thumb, BS.thumbBlank]} />
                )}
                <View style={styles.rowMain}>
                  <Text style={[BS.rowLabel, !item.active && BS.strike]}>
                    {item.name}
                  </Text>
                  <Text style={BS.caption}>
                    {item.dosage} · {medicationScheduleLabel(item)}
                  </Text>
                  {item.startDate || item.endDate ? (
                    <Text style={BS.caption}>
                      {item.startDate ? `from ${item.startDate}` : ''}
                      {item.startDate && item.endDate ? ' · ' : ''}
                      {item.endDate ? `to ${item.endDate}` : ''}
                    </Text>
                  ) : null}
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
                  <Text style={BS.caption}>
                    {item.active ? doseTime : 'inactive'}
                  </Text>
                </View>
              </View>
              <View style={styles.reminderBlock}>
                <PremiumReminderRow
                  label="Reminders"
                  value={item.remindersEnabled}
                  onToggle={(v) => onToggleReminders(item, v)}
                />
                {reminderNote ? (
                  <Text style={styles.reminderNote}>{reminderNote}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity style={BS.btnPrimary} onPress={openAdd} disabled={saving}>
          <Text style={BS.btnPrimaryText}>＋ Add medication</Text>
        </TouchableOpacity>
      </View>

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
  container: { flex: 1, backgroundColor: COLOR.bg },
  list: { padding: SPACE.s4, paddingBottom: 120 },
  headerBlock: { marginBottom: SPACE.s3 },

  /* Rows — the design's hairline list: thumb, label + caption, times at the end. */
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
  hint: { fontSize: 12, color: COLOR.textMuted, marginTop: -SPACE.s1 },
  timesInput: {},
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: SPACE.s3 },
  col: { flex: 1 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACE.s2,
    marginTop: SPACE.s3,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLOR.divider,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLOR.text },
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
