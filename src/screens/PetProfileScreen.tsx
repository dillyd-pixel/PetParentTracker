/**
 * A pet's page — the design's pet profile, on paper, and the **MY PETS** hub.
 *
 * Photo plate, name, meta kicker, then the labelled MY PETS block: profile &
 * vitals, vitals, health (vaccines), vet records, medication, food & feeding,
 * spending, journal & memories and care instructions — one row per module, each
 * with a stable `pet-module-*` id, each going to the screen that already owns
 * that data. Below it the Sitter Mode rows (care log, emergency info, vet visit
 * prep, printable binder), then the pet's medications and last journal quotes —
 * still rendered inline from the four stores they have always read — the "On
 * file" counts, and the edit/delete actions.
 *
 * Every row here is navigation only: this screen reorganises and names the
 * doors, it never adds a second editor for a store. The two rows that cross
 * tabs (emergency info, vet prep, and now the printable binder) go through
 * `openSitterScreenFromPetPage`, so `‹ Back` returns to this page.
 *
 * The `petId` route param makes the tapped pet active first, so every module
 * screen reached from here shows the right pet. Deleting cascades exactly as
 * before (all seven stores + the scheduled reminders for that pet).
 *
 * The photo plate is tappable: it opens the same two-step source choice the
 * pet form uses — "Take a photo" (the camera) or "Choose from library" (the
 * phone's photos). There is no camera on web, so that option only appears on a
 * device. The picked file's local URI is written straight to the pet with
 * `updatePet`, so the new picture shows here and everywhere else at once.
 * Nothing leaves the device: no upload, no network.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { useVaccines } from '../context/VaccinesContext';
import { useMedications } from '../context/MedicationsContext';
import { useFeeding } from '../context/FeedingContext';
import { useVetRecords } from '../context/VetContext';
import { useExpenses } from '../context/ExpensesContext';
import { useJournal } from '../context/JournalContext';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useCheckIns } from '../context/CheckInsContext';
import {
  cancelFeedingForPet,
  cancelMedicationsForPet,
  cancelVaccinesForPet,
} from '../storage/notifications';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { openSitterScreenFromPetPage } from '../navigation/petDeepLink';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import { medicationScheduleLabel, careInstructionsSummary } from '../types';
import { careLogCount } from '../utils/caregiverCheckIn';
import { petEmojiFor, petMetaLine, shortDate } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

/** Which photo source the owner picked on the plate. */
type PhotoSource = 'camera' | 'library';

/**
 * One row of the MY PETS block: emoji + label, one line saying what is behind
 * it, and the chevron. `trailing` is the row's own at-a-glance value (the care
 * instructions summary), so the block still carries a fact and not only a door.
 */
function ModuleRow({
  emoji,
  label,
  caption,
  onPress,
  testID,
  trailing,
}: {
  emoji: string;
  label: string;
  caption: string;
  onPress: () => void;
  testID: string;
  trailing?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      style={BS.divRowBetween}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={{ flex: 1 }}>
        <Text style={BS.rowLabel}>
          {emoji} {label}
        </Text>
        <Text style={BS.caption}>{caption}</Text>
      </View>
      <Text style={BS.link}>{trailing ? `${trailing} ›` : '›'}</Text>
    </TouchableOpacity>
  );
}

type Props = NativeStackScreenProps<PetsStackParamList, 'PetProfile'>;

export default function PetProfileScreen({ navigation, route }: Props): React.JSX.Element {
  const routePetId = route.params?.petId;
  const rootNavigation = useTabRootNavigation();
  const { pets, activePet, selectPet, deletePet, updatePet } = usePets();
  const { vaccines, deleteVaccinesForPet } = useVaccines();
  const { medications, deleteMedicationsForPet } = useMedications();
  const { feedingSchedules, deleteFeedingForPet } = useFeeding();
  const { vetRecords, deleteVetRecordsForPet } = useVetRecords();
  const { deleteExpensesForPet } = useExpenses();
  const { journalEntries, deleteJournalForPet } = useJournal();
  const { getForPet: getCareInstructions, deleteForPet: deleteCareInstructionsForPet } =
    useCareInstructions();
  const { checkIns } = useCheckIns();
  const [processing, setProcessing] = useState(false);
  const [photoChooserOpen, setPhotoChooserOpen] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  // A quiet, inline line for a denied permission or a picker that would not
  // open — Alert.alert does nothing on web, so the message lives on the page.
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);

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
  // This pet's Sitter Mode care notes (a plain lookup, so it can sit here —
  // before the no-pet early return, where hooks may not be added).
  const petInstructions = pet ? getCareInstructions(pet.id) : undefined;
  /** How many check-ins (acts and mood notes) this pet has on this device. */
  const petCheckInCount = pet ? careLogCount(checkIns, pet.id) : 0;

  if (!pet) {
    return (
      <View style={BS.screen}>
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
      'This permanently removes the pet, its vaccine, medication, feeding, vet, expense, and journal records, its care instructions, and its other on-device data. This cannot be undone.',
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
              await deleteCareInstructionsForPet(pet.id);
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

  /**
   * Attach a photo straight to this pet from the chosen source. The camera asks
   * for camera permission and opens the camera; the library asks for
   * photo-library permission and opens the phone's photos. Web has no camera, so
   * only the library is offered there (the same rule the pet form uses). Either
   * way we keep the picked file's local URI and nothing else — no upload.
   */
  const pickPhoto = async (source: PhotoSource) => {
    const useCamera = source === 'camera' && Platform.OS !== 'web';
    setPhotoNotice(null);
    setPickingPhoto(true);
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoNotice(
          useCamera
            ? 'Allow camera access to photograph your pet. You can turn it back on in your phone’s settings.'
            : 'Allow photo library access to add a pet picture. You can turn it back on in your phone’s settings.',
        );
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] });
      if (!result.canceled && result.assets?.length) {
        await updatePet(pet.id, { photoUri: result.assets[0].uri });
        setPhotoChooserOpen(false);
      }
    } catch {
      setPhotoNotice('That photo could not be opened. Please try again.');
    } finally {
      setPickingPhoto(false);
    }
  };

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.navigate('PetList')}>
          <Text style={BS.link}>‹ Pets</Text>
        </TouchableOpacity>

        {/* Photo plate — the design's big box, tappable to add or replace the photo. */}
        <TouchableOpacity
          style={[BS.petPhotoBox, { marginTop: SPACE.s3 }]}
          onPress={() => {
            setPhotoNotice(null);
            setPhotoChooserOpen((open) => !open);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            pet.photoUri ? 'Change the pet photo' : `Add a photo of ${pet.name}`
          }
          testID="pet-photo-plate"
        >
          {pet.photoUri ? (
            <Image source={{ uri: pet.photoUri }} style={{ flex: 1 }} resizeMode="cover" />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 64 }}>{petEmojiFor(pet)}</Text>
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>Tap to add a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* The source step — the camera or the phone's own photo library. */}
        {photoChooserOpen && (
          <View style={[BS.card, { marginTop: 0, marginBottom: SPACE.s3 }]}>
            <Text style={BS.cardKicker}>Pet photo</Text>
            <Text style={BS.caption}>
              Choose where the picture comes from. It is saved on this device only.
            </Text>
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                style={[BS.btnPrimary, pickingPhoto && { opacity: 0.6 }]}
                disabled={pickingPhoto}
                onPress={() => pickPhoto('camera')}
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
                testID="photo-source-camera"
              >
                <Text style={BS.btnPrimaryText}>Take a photo</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[BS.btnSecondary, pickingPhoto && { opacity: 0.6 }]}
              disabled={pickingPhoto}
              onPress={() => pickPhoto('library')}
              accessibilityRole="button"
              accessibilityLabel="Choose from library"
              testID="photo-source-library"
            >
              <Text style={BS.btnSecondaryText}>Choose from library</Text>
            </TouchableOpacity>
            {photoNotice ? (
              <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>{photoNotice}</Text>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setPhotoChooserOpen(false);
                setPhotoNotice(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel photo choice"
            >
              <Text style={[BS.link, { textAlign: 'center' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={BS.h1}>{pet.name}</Text>
        <Text style={BS.kicker}>{petMetaLine(pet)}</Text>

        {/*
         * ---- MY PETS ----
         * The pet page is the single door for everything that belongs to this
         * one pet (OS content map §2.2/§3b): profile, vitals, health, vet
         * records, medication, feeding, spending, journal, care instructions.
         * Every row is labelled, every row has a stable id, and every row goes
         * to the screen that already owned that data — this block reorders and
         * names the doors, it does not add a second editor for any store.
         */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>My pets</Text>
        <ModuleRow
          emoji="🪪"
          label="Profile & vitals"
          caption="Name, breed, birthday, chip and the one weigh-in we keep."
          onPress={() => rootNavigation.navigate('PetForm', { petId: pet.id })}
          testID="pet-module-profile"
        />
        <ModuleRow
          emoji="⚖️"
          label="Vitals"
          caption="One weight lives on the profile today — there is no weigh-in log behind this row yet."
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Vitals',
              slug: 'vitals',
              emoji: '⚖️',
              message:
                'A pet’s weight is the single number on its profile today — there is no weigh-in history kept on this device yet, and this page will not invent one.',
            })
          }
          testID="pet-module-vitals"
        />
        <ModuleRow
          emoji="💉"
          label="Health — vaccines"
          caption="Shots, due dates and reminders."
          onPress={() => navigation.navigate('Vaccines')}
          testID="pet-module-vaccines"
        />
        <ModuleRow
          emoji="🩺"
          label="Vet records"
          caption="Every visit, appointment and filed document."
          onPress={() => navigation.navigate('VetRecords')}
          testID="pet-module-vet-records"
        />
        <ModuleRow
          emoji="💊"
          label="Medication"
          caption="Doses, schedules and reminders."
          onPress={() => navigation.navigate('Meds')}
          testID="pet-module-meds"
        />
        <ModuleRow
          emoji="🍽️"
          label="Food & feeding"
          caption="Meals, portions and the days they repeat."
          onPress={() => navigation.navigate('Feeding')}
          testID="pet-module-feeding"
        />
        <ModuleRow
          emoji="💰"
          label="Spending"
          caption="What this pet costs you, month by month."
          onPress={() => navigation.navigate('Expenses')}
          testID="pet-module-expenses"
        />
        <ModuleRow
          emoji="📓"
          label="Journal & memories"
          caption="Moods, notes and photos — their story so far."
          onPress={() => navigation.navigate('Journal')}
          testID="pet-module-journal"
        />
        <ModuleRow
          emoji="📋"
          label="Care instructions"
          caption="Food, bathroom, sleep, behaviour and quirks — what a sitter follows."
          onPress={() => navigation.navigate('CareInstructions', { petId: pet.id })}
          testID="pet-care-instructions"
          trailing={careInstructionsSummary(petInstructions)}
        />

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Sitter Mode</Text>
        <TouchableOpacity
          style={BS.divRowBetween}
          onPress={() => navigation.navigate('CareLog', { petId: pet.id })}
          accessibilityRole="button"
          accessibilityLabel={`Care log for ${pet.name}`}
          testID="pet-care-log"
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>Care log</Text>
            <Text style={BS.caption}>
              Every check-in and mood note, newest first — who did it and when.
            </Text>
          </View>
          <Text style={BS.link}>
            {petCheckInCount === 0 ? 'Nothing yet' : `${petCheckInCount} recorded`} ›
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={BS.divRowBetween}
          onPress={() => openSitterScreenFromPetPage(rootNavigation, 'Emergency', pet.id)}
          accessibilityRole="button"
          accessibilityLabel={`Emergency info for ${pet.name}`}
          testID="pet-emergency-info"
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>🚨 Emergency info</Text>
            <Text style={BS.caption}>
              Age, weight, allergies, medication, chip and the numbers to call — one screen for an
              urgent trip to the vet.
            </Text>
          </View>
          <Text style={BS.link}>Open ›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={BS.divRowBetween}
          onPress={() => openSitterScreenFromPetPage(rootNavigation, 'VetMode', pet.id)}
          accessibilityRole="button"
          accessibilityLabel={`Vet visit prep for ${pet.name}`}
          testID="pet-vet-mode"
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>🩺 Vet visit prep</Text>
            <Text style={BS.caption}>
              The visit you’re preparing for — its reason and your questions — beside the last visit
              and current medication on file. Saving it files the visit here.
            </Text>
          </View>
          <Text style={BS.link}>Open ›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={BS.divRowBetween}
          onPress={() => openSitterScreenFromPetPage(rootNavigation, 'PrintableBinder', pet.id)}
          accessibilityRole="button"
          accessibilityLabel={`Printable binder for ${pet.name}`}
          testID="pet-handoff-binder"
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>🧳 Printable binder</Text>
            <Text style={BS.caption}>
              This pet’s whole care file, ready to print for a sitter, a vet or the fridge.
            </Text>
          </View>
          <Text style={BS.link}>Open ›</Text>
        </TouchableOpacity>

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

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>This profile</Text>
        <TouchableOpacity
          style={BS.divRowBetween}
          disabled={processing}
          onPress={() => rootNavigation.navigate('More', { screen: 'Shop', params: { screen: 'Premium' } })}
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
