/**
 * Expenses tab — per-pet spending, fully working.
 *
 * Lists the active pet's expenses (title, amount, category, date, notes)
 * sorted by date (newest first), and lets the user add, edit, and delete
 * entries. A client-side header shows the current month's total for the
 * active pet and the overall total — pure local math (sum of locally stored
 * amounts, no server, no network). All data flows through ExpensesContext →
 * expenseRepository → AsyncStorage; 100% offline.
 */
import React, { useEffect, useMemo, useState } from 'react';
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

import { useExpenses } from '../context/ExpensesContext';
import { usePets } from '../context/PetContext';
import { AppColors } from '../theme';
import {
  EXPENSE_CATEGORY_OPTIONS,
  expenseAmountLabel,
  expenseCategoryLabel,
  isValidISODate,
} from '../types';
import type { Expense, ExpenseCategory, ExpenseInput } from '../types';

/** Prompt shown when no pet is selected anywhere in the app. */
function NoPetState() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>🐾</Text>
      <Text style={styles.emptyTitle}>No pet selected</Text>
      <Text style={styles.emptyText}>
        Pick or add a pet on the Home tab to start tracking expenses.
      </Text>
    </View>
  );
}

/** Prompt shown when the active pet has no expenses yet. */
function EmptyExpenses() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>💰</Text>
      <Text style={styles.emptyTitle}>No expenses yet</Text>
      <Text style={styles.emptyText}>
        Tap “Add Expense” to record the first expense for this pet.
      </Text>
    </View>
  );
}

interface FormState {
  title: string;
  description: string;
  amount: string;
  date: string;
  category: ExpenseCategory;
  notes: string;
}

const emptyForm = (): FormState => ({
  title: '',
  description: '',
  amount: '',
  date: '',
  category: 'Other',
  notes: '',
});

function formFromExpense(e: Expense): FormState {
  return {
    title: e.title,
    description: e.description ?? '',
    amount: String(e.amount),
    date: e.date,
    category: e.category,
    notes: e.notes ?? '',
  };
}

/** This month as YYYY-MM-DD for the "current month" total (client-local date). */
function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** ISO month prefix "YYYY-MM" from an ISO date. */
function monthOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Sum amounts (plain local math — no currency, no server). */
function sumAmounts(items: Expense[]): number {
  return items.reduce((sum, e) => (Number.isFinite(e.amount) ? sum + e.amount : sum), 0);
}

interface FormModalProps {
  visible: boolean;
  editing: Expense | null;
  saving: boolean;
  onCancel: () => void;
  onSave: (form: FormState) => void;
}

/** Modal add/edit form — styled to match the app (cards, primary buttons). */
function ExpenseFormModal({ visible, editing, saving, onCancel, onSave }: FormModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);

  // Hydrate on open: fresh form for "add", the record's values for "edit".
  useEffect(() => {
    if (visible) setForm(editing ? formFromExpense(editing) : emptyForm());
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
            {editing ? 'Edit Expense' : 'New Expense'}
          </Text>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={(v) => set('title', v)}
            placeholder="e.g. Dog food (12 kg bag)"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={styles.input}
            value={form.description}
            onChangeText={(v) => set('description', v)}
            placeholder="e.g. grain-free kibble"
            placeholderTextColor="#999"
          />

          <Text style={styles.label}>Amount * (your currency)</Text>
          <TextInput
            style={styles.input}
            value={form.amount}
            onChangeText={(v) => set('amount', v)}
            placeholder="e.g. 42.50"
            placeholderTextColor="#999"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Date * (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={form.date}
            onChangeText={(v) => set('date', v)}
            placeholder="e.g. 2026-05-14"
            placeholderTextColor="#999"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.categoryRow}>
            {EXPENSE_CATEGORY_OPTIONS.map((cat) => {
              const selected = form.category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    selected && styles.categoryChipSelected,
                  ]}
                  onPress={() => set('category', cat)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      selected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {expenseCategoryLabel(cat)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={form.notes}
            onChangeText={(v) => set('notes', v)}
            placeholder="e.g. store, receipt no."
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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ExpensesScreen() {
  const { activePet } = usePets();
  const { expensesForPet, addExpense, updateExpense, deleteExpense } =
    useExpenses();

  const [formVisible, setFormVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-pet listing + totals are computed before the no-pet guard so every
  // hook runs unconditionally (Rules of Hooks). With no pet the list is empty.
  const expenses = expensesForPet(activePet?.id ?? '');
  // Client-side totals for the active pet — pure local math, no server.
  const totals = useMemo(() => {
    const allTotal = sumAmounts(expenses);
    const month = monthOf(todayISO());
    const monthTotal = sumAmounts(
      expenses.filter((e) => monthOf(e.date) === month),
    );
    return { monthTotal, allTotal };
  }, [expenses]);

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
    setEditingExpense(null);
    setFormVisible(true);
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setFormVisible(true);
  };

  const confirmDelete = (e: Expense) => {
    Alert.alert(
      `Delete “${e.title}” on ${e.date}?`,
      'This expense will be permanently removed from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            await deleteExpense(e.id);
            setSaving(false);
          },
        },
      ],
    );
  };

  const submitForm = async (form: FormState) => {
    const title = form.title.trim();
    const date = form.date.trim().replace(/\s+/g, '');
    if (!title) {
      Alert.alert('Missing title', 'Enter a title for the expense, e.g. “Dog food”.');
      return;
    }
    const amount = Number(form.amount.trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Enter an amount greater than 0, e.g. 42.50, in your currency.',
      );
      return;
    }
    if (!isValidISODate(date)) {
      Alert.alert(
        'Invalid date',
        'Enter a valid date as YYYY-MM-DD, e.g. 2026-05-14.',
      );
      return;
    }
    const input: ExpenseInput = {
      petId,
      title,
      description: form.description.trim() ? form.description.trim() : undefined,
      amount,
      date,
      category: form.category,
      notes: form.notes.trim() ? form.notes.trim() : undefined,
    };
    setSaving(true);
    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, input);
      } else {
        await addExpense(input);
      }
      setFormVisible(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>💰 Expenses</Text>
            <Text style={styles.subheading}>
              Spending for {activePet.name}
            </Text>
            <View style={styles.totalsRow}>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>This month</Text>
                <Text style={styles.totalValue}>{expenseAmountLabel(totals.monthTotal)}</Text>
              </View>
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>All time</Text>
                <Text style={styles.totalValue}>{expenseAmountLabel(totals.allTotal)}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyExpenses />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{item.title}</Text>
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
              <Text style={styles.cardAmount}>
                {expenseAmountLabel(item.amount)}
              </Text>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: AppColors.primary + '1A' },
                ]}
              >
                <Text style={[styles.badgeText, { color: AppColors.primary }]}>
                  {expenseCategoryLabel(item.category)}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDate}>📅 {item.date}</Text>
            {item.description ? (
              <Text style={styles.cardMeta}>{item.description}</Text>
            ) : null}
            {item.notes ? (
              <Text style={styles.cardNotes}>{item.notes}</Text>
            ) : null}
          </View>
        )}
      />
      <TouchableOpacity style={styles.addBtn} onPress={openAdd} disabled={saving}>
        <Text style={styles.addBtnText}>＋ Add Expense</Text>
      </TouchableOpacity>

      <ExpenseFormModal
        visible={formVisible}
        editing={editingExpense}
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
  totalsRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  totalCard: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  totalLabel: { fontSize: 12, color: AppColors.textMuted, fontWeight: '600' },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.primary,
    marginTop: 2,
  },
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
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.text,
    marginRight: 10,
  },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  cardDate: { fontSize: 13, color: AppColors.textMuted, marginTop: 6 },
  cardMeta: { fontSize: 13, color: AppColors.text, marginTop: 4 },
  cardNotes: {
    fontSize: 13,
    color: AppColors.text,
    marginTop: 4,
    fontStyle: 'italic',
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
  notesInput: { minHeight: 64, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 },
  categoryChip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: AppColors.textMuted },
  categoryChipTextSelected: { color: AppColors.white },
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