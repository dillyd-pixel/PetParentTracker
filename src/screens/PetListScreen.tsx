/**
 * Pets — the pets list (the "Pets" tab's first screen).
 *
 * One row per pet on paper: photo thumb (or a species glyph), name, the meta
 * line, the active marker. Tapping a row makes that pet active and opens its
 * page in the same stack; "＋ Add a pet" opens the pet form modal.
 *
 * All pet CRUD still goes through PetContext → AsyncStorage. The pet's page
 * carries the edit and delete actions (delete cascades exactly as before).
 */
import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { usePets } from '../context/PetContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { petEmojiFor, petMetaLine } from '../utils/petDisplay';
import { BS, SPACE } from '../theme';
import type { Pet } from '../types';

/** Photo thumb, or a species glyph on the blank plate. */
function PetThumb({ pet }: { pet: Pet }): React.JSX.Element {
  if (pet.photoUri) {
    return <Image source={{ uri: pet.photoUri }} style={BS.thumb} />;
  }
  return (
    <View style={[BS.thumb, BS.thumbBlank, { alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ fontSize: 22 }}>{petEmojiFor(pet)}</Text>
    </View>
  );
}

export default function PetListScreen(): React.JSX.Element {
  const navigation = useTabRootNavigation();
  const { pets, activePet, selectPet } = usePets();

  const openPet = async (petId: string) => {
    if (activePet?.id !== petId) {
      try {
        await selectPet(petId);
      } catch {
        // Pet switch is best-effort; the page still opens.
      }
    }
    navigation.navigate('Pets', { screen: 'PetProfile', params: { petId } });
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <Text style={BS.h1}>Pets</Text>
          <TouchableOpacity onPress={() => navigation.navigate('PetForm')}>
            <Text style={BS.link}>＋ Add</Text>
          </TouchableOpacity>
        </View>

        {pets.length === 0 ? (
          <Text style={BS.italic}>
            No pets yet. Add the first one — its page is where its shots, meals, meds, vet runs,
            spend and journal live.
          </Text>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity key={pet.id} style={BS.divRowBetween} onPress={() => openPet(pet.id)}>
              <PetThumb pet={pet} />
              <View style={{ flex: 1, marginLeft: SPACE.s2 }}>
                <Text style={BS.rowLabel}>
                  {pet.name}
                  {activePet?.id === pet.id ? '  ·  active' : ''}
                </Text>
                <Text style={BS.caption}>{petMetaLine(pet)}</Text>
              </View>
              <Text style={BS.link}>›</Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
          onPress={() => navigation.navigate('PetForm')}
        >
          <Text style={BS.btnSecondaryText}>＋ Add a pet</Text>
        </TouchableOpacity>

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          {pets.length}/20 pets tracked · everything stays on this device.
        </Text>
      </ScrollView>
    </View>
  );
}
