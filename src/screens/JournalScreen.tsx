/**
 * Journal tab — per-pet personality journal, fully working.
 *
 * Lists the active pet's journal entries (date, mood badge, title, body,
 * optional photo) newest-first, and lets the user add, edit, and delete
 * entries. An entry is: an optional short title, the entry text itself
 * (required), the date it's about, an optional mood from a small fixed set,
 * and an optional photo. Photos are picked with expo-image-picker exactly
 * like PetFormScreen does — the chosen local file URI is stored directly in
 * the entry record, on-device only (no upload, no network). All data flows
 * through JournalContext → journalRepository → AsyncStorage; 100% offline.
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
import * as ImagePicker from 'expo-image-picker';

import { useJournal } from '../context/JournalContext';
import { usePets } from '../context/PetContext';
import { AppColors } from '../theme';
import {
  JOURNAL_MOOD_OPTIONS,
  isValidISODate,
  journalMoodEmoji,
  journalMoodLabel,
} from '../types';
import type { JournalEntry, JournalEntryInput, JournalMood } from '../types';

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start journaling.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no journal entries yet. */
function EmptyJournal() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>📔</Text>
      <Text style={styles.emptyTitle}>No entries yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Entry” to write the first journal entry for this pet.
      </Text>
    </View>
  );
}

interface FormState {
  title: string;
  body: string;
  entryDate: string;
  mood: JournalMood | null; // null = no mood set
  photoUri: string | undefined;
}

const emptyForm = (): FormState => ({
  title: '',
  body: '',
  entryDate: '',
  mood: null,
  photoUri: undefined,
});

function formFromEntry(e: JournalEntry): FormState {
  return {
    title: e.title ?? '',
    body: e.body,
    entryDate: e.entryDate,
    mood: e.mood ?? null,
    photoUri: e.photoUri,
  };
}

interface FormModalProps {
  visible: boolean;
  editing: JournalEntry | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function JournalFormModal({ visible, editing, saving, onCancel, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the record's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromEntry(editing) : emptyForm());
  }, [visible, editing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Photo picking — same approach as PetFormScreen: local library permission,
  // launch the picker, keep the picked local file URI. On-device only.
  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permission needed',
        'Allow photo library access to add a picture to this entry.',
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
        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalCardScroll}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editing ? 'Edit Entry' : 'New Journal Entry'}
            </Text>

            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => set('title', v)}
              placeholder="e.g. First day at the park"
              placeholderTextColor="#999"
            />

            <Text style={styles.label}>Entry *</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={form.body}
              onChangeText={(v) => set('body', v)}
              placeholder="What was their mood like today? Any funny or odd behavior?"
              placeholderTextColor="#999"
              multiline
            />

            <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.entryDate}
              onChangeText={(v) => set('entryDate', v)}
              placeholder="e.g. 2026-05-14"
              placeholderTextColor="#999"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.label}>Mood (optional)</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, form.mood === null && styles.chipSelected]}
                onPress={() => set('mood', null)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.mood === null && styles.chipTextSelected,
                  ]}
                >
                  None
                </Text>
              </TouchableOpacity>
              {JOURNAL_MOOD_OPTIONS.map((mood) => {
                const selected = form.mood === mood;
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => set('mood', mood)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {journalMoodEmoji(mood)} {journalMoodLabel(mood)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

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
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Entry'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function JournalScreen() {
  const { activePet } = usePets();
  const { journalForPet, addJournalEntry, updateJournalEntry, deleteJournalEntry } =
    useJournal();

  const [formVisible, setFormVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-pet listing is computed before the no-pet guard so every hook runs
  // unconditionally (Rules of Hooks). With no pet the list is empty.
  const entries = journalForPet(activePet?.id ?? '');

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
    setEditingEntry(null);
    setFormVisible(true);
  };

  const openEdit = (e: JournalEntry) => {
    setEditingEntry(e);
    setFormVisible(true);
  };

  const confirmDelete = (e: JournalEntry) => {
    Alert.alert(
      `Delete “${e.title || 'this entry'}” on ${e.entryDate}?`,
      'This journal entry will be permanently removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteJournalEntry(e.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  const submitForm = async (form: FormState) => {
    const title = form.title.trim();
    const body = form.body.trim();
    const entryDate = form.entryDate.trim().replace(/\s+/g, '');
    if (!body) {
      Alert.alert(
        'Missing entry',
        'Write something in the entry field — what was your pet like today?',
      );
      return;
    }
    if (!isValidISODate(entryDate)) {
      Alert.alert(
        'Invalid date',
        'Enter a valid date as YYYY-MM-DD, e.g. 2026-05-14.',
      );
      return;
    }
    const input: JournalEntryInput = {
      petId,
      title: title ? title : undefined,
      body,
      entryDate,
      mood: form.mood ?? undefined,
      photoUri: form.photoUri,
    };
    setSaving(true);
    try {
      if (editingEntry) {
        await updateJournalEntry(editingEntry.id, input);
      } else {
        await addJournalEntry(input);
      }
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>📔 Journal</Text>
            <Text style={styles.subheading}>
              Personality journal for {activePet.name} · {entries.length}{' '}
              {entries.length === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyJournal />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.title || 'Journal entry'}</Text>
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
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardDate}>📅 {item.entryDate}</Text>
              {item.mood ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: AppColors.primary + '1A' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: AppColors.primary }]}>
                    {journalMoodEmoji(item.mood)} {journalMoodLabel(item.mood)}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardBody}>{item.body}</Text>
            {item.photoUri ? (
              <Image source={{ uri: item.photoUri }} style={styles.cardPhoto} />
            ) : null}
          </View>
        )}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Entry</Text>
      </TouchableOpacity>

      <JournalFormModal
        visible={formVisible}
        editing={editingEntry}
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
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  cardDate: { fontSize: 13, color: AppColors.textMuted },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  cardBody: { fontSize: 14, color: AppColors.text, marginTop: 8, lineHeight: 20 },
  cardPhoto: {
    width: '100%',
    height: 180,
    borderRadius: 10,
    marginTop: 10,
    backgroundColor: AppColors.border,
  },
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
  modalScroll: { flex: 1, justifyContent: 'flex-end' },
  modalCardScroll: { justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: AppColors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.text,
    marginBottom: 12,
  },
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
  bodyInput: { minHeight: 96, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: AppColors.textMuted },
  chipTextSelected: { color: AppColors.white },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  photoBox: { borderRadius: 10 },
  photoPreview: { width: 88, height: 88, borderRadius: 10 },
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
