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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useJournal } from '../context/JournalContext';
import { usePets } from '../context/PetContext';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
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
              placeholderTextColor={COLOR.textFaint}
            />

            <Text style={styles.label}>Entry *</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={form.body}
              onChangeText={(v) => set('body', v)}
              placeholder="What was their mood like today? Any funny or odd behavior?"
              placeholderTextColor={COLOR.textFaint}
              multiline
            />

            <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={form.entryDate}
              onChangeText={(v) => set('entryDate', v)}
              placeholder="e.g. 2026-05-14"
              placeholderTextColor={COLOR.textFaint}
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
  const navigation = useNavigation<NativeStackNavigationProp<PetsStackParamList>>();
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
        <BackgroundCharacters />
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
      <BackgroundCharacters />
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={BS.link}>‹ {activePet.name}</Text>
            </TouchableOpacity>
            <Text style={[styles.heading, { marginTop: SPACE.s3 }]}>Journal</Text>
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
                  <Text style={[styles.actionText, { color: COLOR.accent2_700 }]}>
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
                    { backgroundColor: COLOR.accent + '1A' },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: COLOR.accent }]}>
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
  container: { flex: 1, backgroundColor: COLOR.bg },
  list: { padding: SPACE.s4, paddingBottom: 120 },
  headerBlock: { marginBottom: SPACE.s3 },
  heading: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 30,
    color: COLOR.text,
    letterSpacing: -0.3,
    marginBottom: SPACE.s2,
  },
  subheading: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },

  /* Empty states — italic paper, no card. */
  empty: { paddingVertical: SPACE.s2 },
  emptyTitle: { fontFamily: FONT_HEAD, fontSize: 19, fontWeight: '700', color: COLOR.text },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLOR.textMuted,
    paddingVertical: SPACE.s1,
    lineHeight: 20,
  },
  emptyCta: {
    backgroundColor: COLOR.accent,
    borderRadius: 2,
    paddingHorizontal: SPACE.s4,
    paddingVertical: 12,
    marginTop: SPACE.s3,
    alignItems: 'center',
  },
  emptyCtaText: { color: COLOR.bg, fontSize: 15, fontWeight: '700', fontFamily: FONT_HEAD },

  /* Spend summary — the design's ink-ruled plate. */
  totalCard: {
    borderWidth: 1.5,
    borderColor: COLOR.text,
    padding: SPACE.s4,
    marginBottom: SPACE.s3,
  },
  totalLabel: {
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  totalValue: {
    fontFamily: FONT_HEAD,
    fontSize: 30,
    fontWeight: '700',
    color: COLOR.text,
    letterSpacing: -0.3,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: SPACE.s2,
    borderTopWidth: 1,
    borderTopColor: COLOR.divider,
    paddingTop: SPACE.s2,
    marginTop: SPACE.s2,
  },

  /* Rows — the design's hairline list. */
  card: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLOR.divider },
  cardTop: { flexDirection: 'row', alignItems: 'baseline' },
  cardName: { flex: 1, fontSize: 16, fontWeight: '600', color: COLOR.text },
  cardAmount: { fontSize: 16, fontWeight: '600', color: COLOR.text },
  cardDate: { fontSize: 12.5, color: COLOR.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 12.5, color: COLOR.textMuted, marginTop: 2 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s2, marginTop: SPACE.s1 },
  cardNotes: { fontSize: 12.5, color: COLOR.textMuted, fontStyle: 'italic', marginTop: 2 },
  cardPhoto: { width: '100%', height: 160, borderRadius: 2, marginTop: SPACE.s2 },
  cardActions: { flexDirection: 'row', gap: SPACE.s3, marginTop: SPACE.s1 },
  actionBtn: { paddingVertical: 2 },
  actionText: { fontSize: 13, color: COLOR.accent700, fontWeight: '600' },
  badge: {
    borderRadius: 20,
    backgroundColor: COLOR.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, color: COLOR.text },

  /* Category / filter chips — the design's tags. */
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginBottom: SPACE.s2 },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLOR.surface,
  },
  categoryChipSelected: { backgroundColor: COLOR.accent },
  categoryChipText: { fontSize: 13, color: COLOR.text },
  categoryChipTextSelected: { fontSize: 13, color: COLOR.bg, fontWeight: '600' },

  /* Sticky primary action — the design's button, squared off. */
  addBtn: {
    position: 'absolute',
    left: SPACE.s3,
    right: SPACE.s3,
    bottom: SPACE.s3,
    backgroundColor: COLOR.accent,
    borderRadius: 2,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addBtnText: { color: COLOR.bg, fontWeight: '700', fontSize: 15, fontFamily: FONT_HEAD },

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
    marginBottom: SPACE.s2,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
    marginBottom: SPACE.s1,
    marginTop: SPACE.s3,
  },
  input: {
    minHeight: 40,
    paddingHorizontal: SPACE.s2,
    paddingVertical: SPACE.s1,
    fontSize: 15,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 2,
    marginBottom: SPACE.s2,
  },
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
  modalBtn: { flex: 1, borderRadius: 2, paddingVertical: 12, alignItems: 'center' },
  cancelBtn: { borderWidth: 1, borderColor: COLOR.divider },
  cancelText: { color: COLOR.text, fontWeight: '700', fontSize: 15, fontFamily: FONT_HEAD },
  saveBtn: { backgroundColor: COLOR.accent },
  saveText: { color: COLOR.bg, fontWeight: '700', fontSize: 15, fontFamily: FONT_HEAD },
  btnDisabled: { opacity: 0.45 },
  /* Journal-specific keys (mood chips, quote body, scrolled sheet). */
  cardBody: { fontSize: 14, fontStyle: 'italic', color: COLOR.textMuted, paddingVertical: SPACE.s1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.s2, marginBottom: SPACE.s2 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: COLOR.surface,
  },
  chipSelected: { backgroundColor: COLOR.accent },
  chipText: { fontSize: 13, color: COLOR.text },
  chipTextSelected: { fontSize: 13, color: COLOR.bg, fontWeight: '600' },
  bodyInput: {
    minHeight: 96,
    paddingHorizontal: SPACE.s2,
    paddingVertical: SPACE.s1,
    fontSize: 15,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 2,
    marginBottom: SPACE.s2,
    textAlignVertical: 'top',
  },
  modalCardScroll: { padding: SPACE.s4, paddingBottom: SPACE.s6 },
});
