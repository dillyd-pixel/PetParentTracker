/**
 * Feeding tab — per-pet feeding schedules with premium mealtime reminders.
 *
 * Lists the active pet's meals (meal type, time, portion, repeat days, notes)
 * sorted by time, and lets the user add, edit, and delete entries. Mealtime
 * reminder notifications (a Blueprint Premium feature) fire at the meal's
 * time on its repeat days. All data flows through FeedingContext →
 * feedingRepository → AsyncStorage; 100% offline. No notifications on the
 * web preview — the reminder controls render with a note there.
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

import { useFeeding } from '../context/FeedingContext';
import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { hasNotificationPermission } from '../storage/notifications';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { PremiumReminderRow } from '../components/PremiumReminderRow';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
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

type Props = NativeStackScreenProps<PetsStackParamList, 'Feeding'>;

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={BS.pad}>
      <Text style={BS.h1}>No pet selected</Text>
      <Text style={BS.italic}>
        Pick or add a pet on the Pets tab to start tracking feeding.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no feeding entries yet. */
function EmptyFeeding() {
  return (
    <Text style={BS.italic}>
      No feeding schedule yet. Tap “Add meal” to record the first one for this pet.
    </Text>
  );
}

interface FormState {
  mealType: MealType;
  time: string;
  portionAmount: string;
  portionUnit: PortionUnit;
  notes: string;
  daysOfWeek: number[];
  reminderEnabled: boolean;
  photoUri: string | undefined;
}

const emptyForm = (): FormState => ({
  mealType: 'Breakfast',
  time: '',
  portionAmount: '',
  portionUnit: 'g',
  notes: '',
  daysOfWeek: [],
  reminderEnabled: false,
  photoUri: undefined,
});

function formFromFeeding(f: FeedingSchedule): FormState {
  return {
    mealType: f.mealType,
    time: f.time,
    portionAmount: String(f.portionAmount),
    portionUnit: f.portionUnit,
    notes: f.notes ?? '',
    daysOfWeek: [...f.daysOfWeek],
    reminderEnabled: f.reminderEnabled ?? false,
    photoUri: f.photoUri,
  };
}

interface FormModalProps {
  visible: boolean;
  editing: FeedingSchedule | null;
  saving: boolean;
  notificationPermissionDenied: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function FeedingFormModal({
  visible,
  editing,
  saving,
  notificationPermissionDenied,
  onCancel,
  onSave,
}: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the entry's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromFeeding(editing) : emptyForm());
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
        'Allow photo library access to add a picture to this meal.',
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
            {editing ? 'Edit meal' : 'New meal'}
          </Text>

          <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>

          <Text style={[BS.fieldLabel, styles.label]}>Meal</Text>
          <View style={BS.rowWrap}>
            {MEAL_TYPE_OPTIONS.map((meal) => (
              <TouchableOpacity
                key={meal}
                style={[BS.tag, form.mealType === meal && BS.tagActive]}
                onPress={() => set('mealType', meal)}
              >
                <Text style={form.mealType === meal ? BS.tagTextActive : BS.tagText}>
                  {meal}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[BS.fieldLabel, styles.label]}>Time * (24h, HH:mm)</Text>
          <TextInput
            style={BS.input}
            value={form.time}
            onChangeText={(v) => set('time', v)}
            placeholder="e.g. 08:00"
            placeholderTextColor={COLOR.textFaint}
            keyboardType="numbers-and-punctuation"
          />

          <Text style={[BS.fieldLabel, styles.label]}>Portion *</Text>
          <View style={styles.twoCol}>
            <View style={[styles.col, { flex: 1 }]}>
              <TextInput
                style={BS.input}
                value={form.portionAmount}
                onChangeText={(v) => set('portionAmount', v)}
                placeholder="e.g. 150"
                placeholderTextColor={COLOR.textFaint}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.col, { flex: 1.2 }]}>
              <View style={BS.rowWrap}>
                {PORTION_UNIT_OPTIONS.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    style={[BS.tag, form.portionUnit === unit && BS.tagActive]}
                    onPress={() => set('portionUnit', unit)}
                  >
                    <Text
                      style={
                        form.portionUnit === unit ? BS.tagTextActive : BS.tagText
                      }
                    >
                      {unit}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <Text style={[BS.fieldLabel, styles.label]}>Days (none selected = every day)</Text>
          <View style={BS.rowWrap}>
            {DAY_NAMES_SHORT.map((name, day) => (
              <TouchableOpacity
                key={name}
                style={[
                  BS.tag,
                  form.daysOfWeek.includes(day) && BS.tagActive,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={
                    form.daysOfWeek.includes(day) ? BS.tagTextActive : BS.tagText
                  }
                >
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.daysOfWeek.length > 0 && (
            <TouchableOpacity onPress={() => set('daysOfWeek', [])}>
              <Text style={[BS.link, { marginTop: SPACE.s2 }]}>
                Clear (back to every day)
              </Text>
            </TouchableOpacity>
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

          <Text style={[BS.fieldLabel, styles.label]}>Notes (optional)</Text>
          <TextInput
            style={[BS.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. soak kibble in warm water"
            placeholderTextColor={COLOR.textFaint}
            multiline
          />

          <Text style={[BS.fieldLabel, styles.label]}>Mealtime reminder (Blueprint Premium)</Text>
          <PremiumReminderRow
            compact
            label="Remind me"
            value={form.reminderEnabled}
            onToggle={(v) => set('reminderEnabled', v)}
          />
          {form.reminderEnabled &&
            notificationPermissionDenied &&
            Platform.OS !== 'web' && (
              <Text style={styles.permissionNote}>
                Notifications are disabled in system settings — reminders will be
                saved but not delivered. Enable notifications for the app to arm
                them.
              </Text>
            )}

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
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add meal'}
              </Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function FeedingScreen({ navigation }: Props): React.JSX.Element {
  const { activePet } = usePets();
  const {
    feedingForPet,
    addFeeding,
    updateFeeding,
    deleteFeeding,
    toggleFeedingReminders,
  } = useFeeding();
  const { isPremium } = usePremium();

  const [formVisible, setFormVisible] = useState(false);
  const [editingFeeding, setEditingFeeding] = useState<FeedingSchedule | null>(null);
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
      'This feeding entry will be permanently removed from this device and its scheduled reminders cancelled. This cannot be undone.',
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

  const onToggleReminders = async (f: FeedingSchedule, enabled: boolean) => {
    const updated = await toggleFeedingReminders(f.id, enabled);
    setPermissionDenied(!(await hasNotificationPermission()));
    if (updated) {
      if (enabled) {
        flashReminderNote(
          f.id,
          Platform.OS === 'web'
            ? 'Reminders saved — not supported in the web preview'
            : updated.reminderEnabled
              ? 'Reminders scheduled 🔔'
              : 'Reminders not scheduled (permission denied)',
        );
      } else {
        flashReminderNote(f.id, 'Reminders cancelled');
      }
    }
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
      // Non-premium users can't arm reminders: always persist off, even if a
      // stale toggle value leaks through. Premium state can only change via
      // the Premium screen, so gating at save keeps stored data honest.
      reminderEnabled: isPremium() ? form.reminderEnabled : false,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingFeeding) {
        await updateFeeding(editingFeeding.id, input);
      } else {
        await addFeeding(input);
      }
      setPermissionDenied(!(await hasNotificationPermission()));
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  const records = feedingForPet(petId);

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
            <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Feeding</Text>
            <Text style={BS.kicker}>
              {records.length === 0
                ? 'No meals on file'
                : `${records.length} meal${records.length === 1 ? '' : 's'} a day`}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyFeeding />}
        renderItem={({ item }) => (
          <View>
            <View style={styles.row}>
              {item.photoUri ? (
                <Image source={{ uri: item.photoUri }} style={BS.thumb} />
              ) : (
                <View style={[BS.thumb, BS.thumbBlank]} />
              )}
              <View style={styles.rowMain}>
                <Text style={BS.rowLabel}>{item.mealType}</Text>
                <Text style={BS.caption}>
                  {item.portionAmount} {item.portionUnit} ·{' '}
                  {feedingDaysLabel(item.daysOfWeek)}
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
                <Text style={BS.rowLabel}>{item.time}</Text>
                {item.reminderEnabled ? (
                  <View style={[BS.tag, BS.tagAccent2, { marginTop: SPACE.s1 }]}>
                    <Text style={BS.tagTextAccent2}>Reminder set</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.reminderBlock}>
              <PremiumReminderRow
                label="Reminders"
                value={item.reminderEnabled ?? false}
                onToggle={(v) => onToggleReminders(item, v)}
              />
              {reminderNotes[item.id] ? (
                <Text style={styles.reminderNote}>{reminderNotes[item.id]}</Text>
              ) : null}
            </View>
          </View>
        )}
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity style={BS.btnPrimary} onPress={openAdd} disabled={saving}>
          <Text style={BS.btnPrimaryText}>＋ Add meal</Text>
        </TouchableOpacity>
      </View>

      <FeedingFormModal
        visible={formVisible}
        editing={editingFeeding}
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

  /* Rows — the design's hairline list: thumb, label + caption, time at the end. */
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
  twoCol: { flexDirection: 'row', gap: SPACE.s3 },
  col: { flex: 1 },
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
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
