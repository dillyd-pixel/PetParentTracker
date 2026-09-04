/**
 * Home tab — Pet Profiles, fully working.
 *
 * Lists every pet, shows the active one, lets the user switch the active pet,
 * create a pet, edit one, or delete one. All operations go through the
 * PetContext (which persists to AsyncStorage).
 */
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import { cancelMedicationsForPet } from '../storage/notifications';
import { AppColors } from '../theme';
import type { RootStackParamList } from '../navigation/RootNavigator';
import type { Pet } from '../types';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Main'>;
};

/** Displays a photo or a colored species-emoji placeholder. */
function PetAvatar({ pet }: { pet: Pet }) {
  if (pet.photoUri) {
    return <Image source={{ uri: pet.photoUri }} style={styles.avatar} />;
  }
  const emoji = pet.species === 'Dog' ? '🐶' : pet.species === 'Cat' ? '🐱' : '🐾';
  return (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
    </View>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { pets, activePet, addPet, updatePet, deletePet, selectPet } = usePets();
  const { deleteVaccinesForPet } = useVaccines();
  const { medications, deleteMedicationsForPet } = useMedications();
  const { deleteFeedingForPet } = useFeeding();
  const { deleteVetRecordsForPet } = useVetRecords();
  const { deleteExpensesForPet } = useExpenses();
  const { deleteJournalForPet } = useJournal();
  const [processing, setProcessing] = useState(false);

  const confirmDelete = (pet: Pet) => {
    Alert.alert(
      `Delete ${pet.name}?`,
      'This permanently removes the pet, its vaccine, medication, feeding, vet, expense, and journal records, and its other on-device data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              // Cascade: the pet's vaccine + medication + feeding + vet +
              // expense + journal records go with it, and its scheduled
              // medication reminders are cancelled.
              await deleteVaccinesForPet(pet.id);
              await deleteMedicationsForPet(pet.id);
              await deleteFeedingForPet(pet.id);
              await deleteVetRecordsForPet(pet.id);
              await deleteExpensesForPet(pet.id);
              await deleteJournalForPet(pet.id);
              await cancelMedicationsForPet(pet.id, medications);
              await deletePet(pet.id);
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const switchActive = (pet: Pet) => {
    if (activePet?.id === pet.id) return;
    selectPet(pet.id);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={pets}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.heading}>Your pets</Text>
            <Text style={styles.subheading}>
              {activePet
                ? `Active pet: ${activePet.name}`
                : 'Add a pet to get started'}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyTitle}>No pets yet</Text>
            <Text style={styles.emptyText}>
              Tap “Add Pet” to create your first profile.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isActive = activePet?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => switchActive(item)}
              disabled={processing}
            >
              <PetAvatar pet={item} />
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardMeta}>
                  {item.species}
                  {item.breed ? ` · ${item.breed}` : ''}
                  {item.weight ? ` · ${formatWeight(item)}` : ''}
                </Text>
                {isActive && <Text style={styles.activeBadge}>● Active</Text>}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => navigation.navigate('PetForm', { petId: item.id })}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => confirmDelete(item)}
                >
                  <Text style={[styles.actionText, { color: AppColors.danger }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => navigation.navigate('PetForm')}
        disabled={processing}
      >
        <Text style={styles.addBtnText}>＋ Add Pet</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatWeight(pet: Pet): string {
  const value = typeof pet.weight === 'number' ? pet.weight.toLocaleString() : '—';
  return `${value} ${pet.weightUnit ?? 'kg'}`;
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
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: AppColors.text },
  emptyText: { fontSize: 14, color: AppColors.textMuted, marginTop: 4, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardActive: { borderColor: AppColors.primary },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  avatarPlaceholder: {
    backgroundColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardName: { fontSize: 17, fontWeight: '700', color: AppColors.text },
  cardMeta: { fontSize: 13, color: AppColors.textMuted, marginTop: 2 },
  activeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
    marginTop: 4,
  },
  cardActions: { flexDirection: 'row' },
  actionBtn: { padding: 6, marginLeft: 4 },
  actionText: { fontSize: 14, fontWeight: '600', color: AppColors.primary },
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
});