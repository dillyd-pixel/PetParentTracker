/**
 * Card — the pet's emergency card (the "Card" tab).
 *
 * Everything a sitter or an emergency vet needs, read straight off the device:
 * the pet's photo and name, its meta line, the vet on file from its latest
 * visit, the medications it is on, and its vaccine count. Pet tags switch which
 * pet the card is for.
 *
 * The card is rendered on-device; its PDF/print path is the app's existing
 * premium export (on-device `expo-print`, no server).
 *
 * 100% offline: nothing is fetched, nothing is uploaded — the card is a view of
 * local records.
 */
import React, { useMemo } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { usePets } from '../context/PetContext';
import { useMedications } from '../context/MedicationsContext';
import { useVaccines } from '../context/VaccinesContext';
import { useVetRecords } from '../context/VetContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { ExportPetPdfRow } from '../components/ExportPetPdfRow';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { medicationScheduleLabel } from '../types';
import { petEmoji, petMetaLine, shortDate } from '../utils/petDisplay';
import { BS, SPACE } from '../theme';

export default function EmergencyCardScreen(): React.JSX.Element {
  const navigation = useTabRootNavigation();
  const { pets, activePet, selectPet } = usePets();
  const { medications } = useMedications();
  const { vaccines } = useVaccines();
  const { vetRecords } = useVetRecords();

  const pet = activePet ?? pets[0];

  const petMeds = useMemo(
    () => (pet ? medications.filter((med) => med.petId === pet.id && med.active) : []),
    [medications, pet],
  );
  const petVaccines = useMemo(
    () => (pet ? vaccines.filter((vaccine) => vaccine.petId === pet.id) : []),
    [vaccines, pet],
  );
  const lastVisit = useMemo(() => {
    if (!pet) return undefined;
    return vetRecords
      .filter((record) => record.petId === pet.id)
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate))[0];
  }, [vetRecords, pet]);

  if (!pet) {
    return (
      <View style={BS.screen}>
        <BackgroundCharacters />
        <ScrollView contentContainerStyle={BS.pad}>
          <Text style={BS.h1}>Emergency card</Text>
          <Text style={BS.italic}>
            Add a pet first — the card is built from that pet’s own records.
          </Text>
          <TouchableOpacity
            style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
            onPress={() => navigation.navigate('PetForm')}
          >
            <Text style={BS.btnSecondaryText}>＋ Add a pet</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <Text style={BS.h1}>Emergency card</Text>
        <Text style={BS.italic}>
          Keep this card where a sitter or an emergency vet can find it.
        </Text>

        {pets.length > 1 && (
          <View style={[BS.rowWrap, { marginTop: SPACE.s3 }]}>
            {pets.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={[BS.tag, entry.id === pet.id && BS.tagActive]}
                onPress={() => selectPet(entry.id).catch(() => undefined)}
              >
                <Text style={entry.id === pet.id ? BS.tagTextActive : BS.tagText}>
                  {entry.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Vet on file</Text>
        {lastVisit ? (
          <View style={BS.divRowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={BS.rowLabel}>
                {lastVisit.veterinarian || lastVisit.clinicName || 'Last visit'}
              </Text>
              <Text style={BS.caption}>
                {[lastVisit.clinicName, shortDate(lastVisit.visitDate)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={BS.italic}>No vet visit on file yet.</Text>
        )}

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

        <View style={[BS.divRowBetween, { marginTop: SPACE.s2 }]}>
          <Text style={BS.rowLabel}>Vaccines on file</Text>
          <Text style={BS.caption}>
            {petVaccines.length === 0 ? 'none yet' : `${petVaccines.length}`}
          </Text>
        </View>

        <ExportPetPdfRow />

        <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
          This card is built from records stored on this device only.
        </Text>
      </ScrollView>
    </View>
  );
}
