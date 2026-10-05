/**
 * Care instructions — the read view (Stage 2 of Sitter Mode).
 *
 * What a sitter (or a vet, or family) reads: one pet's permanent care notes,
 * grouped Food / Bathroom / Sleep / Behaviour / Quirks, with only the groups
 * the owner actually wrote something in. Empty notes get a friendly invitation
 * instead of an empty page.
 *
 * This is the pet parent's own notes, kept on this device — they are also the
 * CONTENT a Care Pass shows (a later stage wires them into the pass's sections
 * through `careInstructionsContentBySection`). Writing them is free and always
 * available; only creating a Care Pass is Blueprint Premium.
 *
 * Reached from the pet's page (Pets tab) and from Sitter Mode home, so the
 * screen takes an optional `petId` and falls back to the active pet.
 *
 * 100% offline: reads the local store through CareInstructionsContext.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { usePets } from '../context/PetContext';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import {
  careInstructionsGroupsWithContent,
  careInstructionsSummary,
} from '../types';
import { petEmojiFor, shortDate } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<PetsStackParamList, 'CareInstructions'>;

export default function CareInstructionsScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const routePetId = route.params?.petId;
  const { pets, activePet } = usePets();
  const { getForPet } = useCareInstructions();

  const pet = (routePetId && pets.find((entry) => entry.id === routePetId)) || activePet;
  const instructions = pet ? getForPet(pet.id) : undefined;
  const groups = careInstructionsGroupsWithContent(instructions);

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
            accessibilityRole="button"
            accessibilityLabel="Back to Pets"
          >
            <Text style={BS.btnSecondaryText}>Back to Pets</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  const updatedOn = instructions?.updatedAt?.slice(0, 10);

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          testID="care-instructions-back"
        >
          <Text style={BS.link}>‹ Back</Text>
        </TouchableOpacity>

        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Care instructions</Text>
        <Text style={BS.kicker}>
          {petEmojiFor(pet)} {pet.name}
        </Text>

        {groups.length === 0 ? (
          /* Empty state — friendly, and it says what the notes are for. */
          <View style={[BS.dashedBox, { marginTop: SPACE.s4 }]} testID="care-instructions-empty">
            <Text style={{ fontSize: 34 }}>{petEmojiFor(pet)}</Text>
            <Text style={[BS.rowLabel, { marginTop: SPACE.s2, textAlign: 'center' }]}>
              Nothing written yet
            </Text>
            <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
              Write down how {pet.name} is fed, walked and settled — plus the quirks only you
              know. It takes a couple of minutes, and it’s what a sitter reads in a Care Pass.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: SPACE.s4 }}>
            {groups.map(({ group, entries }) => (
              <View key={group.id} testID={`care-instructions-group-${group.id}`}>
                <Text style={[BS.fieldLabel, { marginTop: SPACE.s3 }]}>
                  {group.emoji} {group.title}
                </Text>
                {entries.map((entry) => (
                  <View key={entry.field.key} style={BS.divRow} testID={`care-instructions-line-${entry.field.key}`}>
                    <Text style={BS.caption}>{entry.field.label}</Text>
                    <Text
                      style={[BS.body, { marginTop: 2, marginBottom: 0, lineHeight: 22 }]}
                    >
                      {entry.value}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <Text style={[BS.caption, { marginTop: SPACE.s3, color: COLOR.textFaint }]}>
              {careInstructionsSummary(instructions)}
              {updatedOn ? ` · last saved ${shortDate(updatedOn)}` : ''}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s4 }]}
          onPress={() => navigation.navigate('CareInstructionsEditor', { petId: pet.id })}
          accessibilityRole="button"
          accessibilityLabel={
            groups.length === 0 ? 'Write care instructions' : 'Edit care instructions'
          }
          testID="care-instructions-edit"
        >
          <Text style={BS.btnPrimaryText}>
            {groups.length === 0 ? 'Write care instructions' : 'Edit care instructions'}
          </Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          Free to write, and only ever stored on this device. Creating a Care Pass is part of
          Blueprint Premium.
        </Text>
      </ScrollView>
    </View>
  );
}
