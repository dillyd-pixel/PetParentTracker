/**
 * A pet's page — the design's pet profile, on paper.
 *
 * Photo plate, name, meta kicker, the Vaccines / Feeding buttons, then the
 * pet's medications and the last journal quotes — plus a row for every other
 * module (meds, vet records, expenses, journal) and the edit/delete actions, so
 * nothing that lived on the old Home tab is lost.
 *
 * The `petId` route param makes the tapped pet active first, so every module
 * screen reached from here shows the right pet. Deleting cascades exactly as
 * before (all seven stores + the scheduled reminders for that pet).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import {
  cancelFeedingForPet,
  cancelMedicationsForPet,
  cancelVaccinesForPet,
} from '../storage/notifications';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import { medicationScheduleLabel } from '../types';
import { petEmoji, petMetaLine, shortDate } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<PetsStackParamList, 'PetProfile'>;

export default function PetProfileScreen({ navigation, route }: Props): React.JSX.Element {
  const routePetId = route.params?.petId;
  const rootNavigation = useTabRootNavigation();
  const { pets, activePet, selectPet, deletePet } = usePets();
  const { vaccines, deleteVaccinesForPet } = useVaccines();
  const { medications, deleteMedicationsForPet } = useMedications();
  const { feedingSchedules, deleteFeedingForPet } = useFeeding();
  const { vetRecords, deleteVetRecordsForPet } = useVetRecords();
  const { deleteExpensesForPet } = useExpenses();
  const { journalEntries, deleteJournalForPet } = useJournal();
  const [processing, setProcessing] = useState(false);

  // The tapped pet becomes the active one, so its module screens line up.
  useEffect(() => {
    if (routePetId && activePet?.id !== routePetId) {
      selectPet(routePetId).catch(() => undefined);
    }
  }, [routePetId, activePet?.id, selectPet]);

  const pet = (routePetId && pets.find((entry) => entry.id === routePetId)) || activePet;

  const petMeds = useMemo(
    () => (pet ? medications.filter((med) => med.petId === pet.id && med.active) : []),
    [medications, pet],
  );
  const petMeals = useMemo(
    () => (pet ? feedingSchedules.filter((meal) => meal.petId === pet.id) : []),
    [feedingSchedules, pet],
  );
  const petVetRecords = useMemo(
    () => (pet ? vetRecords.filter((record) => record.petId === pet.id) : []),
    [vetRecords, pet],
  );
  const petVaccines = useMemo(
    () => (pet ? vaccines.filter((vaccine) => vaccine.petId === pet.id) : []),
    [vaccines, pet],
  );
  const journalQuotes = useMemo(
    () =>
      pet
        ? journalEntries
            .filter((entry) => entry.petId === pet.id)
            .sort((a, b) => b.entryDate.localeCompare(a.entryDate))
            .slice(0, 2)
        : [],
    [journalEntries, pet],
  );

  if (!pet) {
    return (
      <View style={BS.screen}>
        <BackgroundCharacters />
        <ScrollView contentContainerStyle={BS.pad}>
          <Text style={BS.h1}>No pet selected</Text>
          <Text style={BS.italic}>Pick or add a pet on the Pets tab.</Text>
          <TouchableOpacity
            style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
            onPress={() => navigation.navigate('PetList')}
          >
            <Text style={BS.btnSecondaryText}>Back to Pets</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const confirmDelete = () => {
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
              // Cascade: every store for this pet, then its scheduled reminders.
              await deleteVaccinesForPet(pet.id);
              await deleteMedicationsForPet(pet.id);
              await deleteFeedingForPet(pet.id);
              await deleteVetRecordsForPet(pet.id);
              await deleteExpensesForPet(pet.id);
              await deleteJournalForPet(pet.id);
              await cancelMedicationsForPet(pet.id, medications);
              await cancelFeedingForPet(pet.id, feedingSchedules);
              await cancelVaccinesForPet(pet.id, vaccines);
              await deletePet(pet.id);
              navigation.navigate('PetList');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.navigate('PetList')}>
          <Text style={BS.link}>‹ Pets</Text>
        </TouchableOpacity>

        {/* Photo plate — the design's big box, filled when a photo exists. */}
        <View style={[BS.petPhotoBox, { marginTop: SPACE.s3 }]}>
          {pet.photoUri ? (
            <Image source={{ uri: pet.photoUri }} style={{ flex: 1 }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 64 }}>{petEmoji(pet.species)}</Text>
            </View>
          )}
        </View>

        <Text style={BS.h1}>{pet.name}</Text>
        <Text style={BS.kicker}>{petMetaLine(pet)}</Text>

        <View style={[BS.row, { marginTop: SPACE.s3 }]}>
          <TouchableOpacity
            style={[BS.btnSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('Vaccines')}
          >
            <Text style={BS.btnSecondaryText}>Vaccines</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[BS.btnSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('Feeding')}
          >
            <Text style={BS.btnSecondaryText}>Feeding</Text>
          </TouchableOpacity>
        </View>
        <View style={[BS.row, { marginTop: SPACE.s2 }]}>
          <TouchableOpacity
            style={[BS.btnSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('Meds')}
          >
            <Text style={BS.btnSecondaryText}>Medications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[BS.btnSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('VetRecords')}
          >
            <Text style={BS.btnSecondaryText}>Vet records</Text>
          </TouchableOpacity>
        </View>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Medications</Text>
        {petMeds.length === 0 ? (
          <Text style={BS.italic}>No medications logged.</Text>
        ) : (
          petMeds.map((med) => (
            <View key={med.id} style={BS.divRowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={BS.rowLabel}>{med.name}</Text>
                <Text style={BS.caption}>
                  {med.dosage} · {medicationScheduleLabel(med)}
                </Text>
              </View>
              <Text style={BS.caption}>{med.times[0] ?? ''}</Text>
            </View>
          ))
        )}
        <TouchableOpacity
          style={[BS.divRowBetween, { marginTop: SPACE.s2 }]}
          onPress={() => navigation.navigate('Meds')}
        >
          <Text style={BS.link}>Manage medications ›</Text>
        </TouchableOpacity>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Journal</Text>
        {journalQuotes.length === 0 ? (
          <Text style={BS.italic}>Nothing filed yet.</Text>
        ) : (
          journalQuotes.map((entry) => (
            <View key={entry.id} style={{ marginBottom: SPACE.s2 }}>
              <Text style={BS.italic}>“{entry.body}”</Text>
              <Text style={BS.caption}>
                {shortDate(entry.entryDate)}
                {entry.title ? ` · ${entry.title}` : ''}
              </Text>
            </View>
          ))
        )}
        <TouchableOpacity style={BS.divRowBetween} onPress={() => navigation.navigate('Journal')}>
          <Text style={BS.link}>All journal entries ›</Text>
        </TouchableOpacity>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>On file</Text>
        <View style={BS.divRowBetween}>
          <Text style={BS.rowLabel}>Vaccines</Text>
          <Text style={BS.caption}>
            {petVaccines.length === 0 ? 'none yet' : `${petVaccines.length} on file`}
          </Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.rowLabel}>Meals a day</Text>
          <Text style={BS.caption}>{petMeals.length}</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.rowLabel}>Vet records</Text>
          <Text style={BS.caption}>{petVetRecords.length}</Text>
        </View>
        <TouchableOpacity style={BS.divRowBetween} onPress={() => navigation.navigate('Expenses')}>
          <Text style={BS.link}>Expenses ›</Text>
        </TouchableOpacity>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>This profile</Text>
        <TouchableOpacity
          style={BS.divRowBetween}
          disabled={processing}
          onPress={() => rootNavigation.navigate('Shop', { screen: 'Premium' })}
        >
          <Text style={BS.rowLabel}>Share or export {pet.name}’s file</Text>
          <Text style={BS.link}>Shop ›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={BS.divRowBetween}
          disabled={processing}
          onPress={() => rootNavigation.navigate('PetForm', { petId: pet.id })}
        >
          <Text style={BS.rowLabel}>Edit profile</Text>
          <Text style={BS.link}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={BS.divRowBetween} disabled={processing} onPress={confirmDelete}>
          <Text style={[BS.rowLabel, { color: COLOR.accent2_700 }]}>Delete {pet.name}</Text>
          <Text style={[BS.link, { color: COLOR.accent2_700 }]}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
