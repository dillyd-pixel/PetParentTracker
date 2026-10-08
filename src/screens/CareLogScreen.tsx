/**
 * Care log — one pet's whole check-in history, as the owner reads it.
 *
 * This is the owner's side of the Caregiver Check-In engine: every act a person
 * recorded, and every mood note, newest first and grouped by the local day it
 * happened on ("Today", "Yesterday", then a date). A sitter's line says who did
 * it — "Medication given by Sarah — 8:03 AM", "Mood: Normal — Sarah — 8:02 AM"
 * — while the owner's own ring taps simply read "Fed — 8:03 AM".
 *
 * Two entry points, one screen: the pet's own page (under Sitter Mode, in the
 * Pets stack) and Sitter Mode home (the Sitter stack). The pet is the route
 * param; with none, the active pet is used, so the screen is never empty by
 * accident.
 *
 * Timestamps are rendered in the owner's chosen display time zone through the
 * same helpers the Daily Care Ring uses (`utils/datetime`), so a record made in
 * another zone still lands on the right day. Nothing here is scored, and an
 * absent act is absent — there is no "missed" row and no negative copy.
 *
 * 100% offline: reads the on-device check-in repository through CheckInsContext.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { CCCard, CCEmptyState } from '../components/CC';
import { useAccount } from '../context/AccountContext';
import { useCheckIns } from '../context/CheckInsContext';
import { usePets } from '../context/PetContext';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { careLogGroups } from '../utils/caregiverCheckIn';
import { todayISOInTimeZone } from '../utils/datetime';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, FONT_HEAD, SPACE } from '../theme';

/**
 * The route params as both stacks declare them (`CareLog: { petId? }`), typed
 * against the Pets stack because that is where the pet page opens it from; the
 * Sitter stack registers the same screen with the same params.
 */
type CareLogRoute = RouteProp<
  PetsStackParamList & SitterStackParamList,
  'CareLog'
>;

export default function CareLogScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<CareLogRoute>();
  const { checkIns } = useCheckIns();
  const { pets, activePet } = usePets();
  const { timeZone } = useAccount();

  const todayKey = useMemo(() => todayISOInTimeZone(new Date(), timeZone), [timeZone]);

  const petId = route.params?.petId;
  const pet = useMemo(
    () => pets.find((candidate) => candidate.id === petId) ?? (petId ? null : activePet),
    [pets, petId, activePet],
  );

  const groups = useMemo(
    () => (pet ? careLogGroups(checkIns, pet.id, todayKey, timeZone) : []),
    [checkIns, pet, todayKey, timeZone],
  );

  const total = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <Text
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={BS.link}
        >
          ‹ Back
        </Text>

        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Care & handoff</Text>
        <Text style={BS.h1}>Care log</Text>
        <Text style={BS.body}>
          {pet
            ? `Everything recorded for ${pet.name} — every act and every mood note, newest first.`
            : 'Everything recorded for your pets — every act and every mood note, newest first.'}
        </Text>

        {!pet ? (
          <CCEmptyState
            emoji="🐾"
            title="No pet to show"
            message="Add a pet first, then open its care log from its page or from Sitter Mode."
            testID="carelog-no-pet"
          />
        ) : total === 0 ? (
          <CCEmptyState
            emoji="🗒️"
            title={`Nothing logged for ${pet.name} yet`}
            message="Caregiver check-ins and mood notes appear here the moment they are recorded — with who did it and when."
            testID="carelog-empty"
          />
        ) : (
          <>
            <Text style={[BS.caption, { marginBottom: SPACE.s1 }]}>
              {total} {total === 1 ? 'record' : 'records'} · {petEmojiFor(pet)} {pet.name}
            </Text>
            {groups.map((group) => (
              <CCCard key={group.dayKey || 'unknown'} testID={`carelog-day-${group.dayKey || 'unknown'}`}>
                <Text style={styles.dayLabel}>{group.label}</Text>
                {group.entries.map((entry) => (
                  <View key={entry.id} style={styles.row} testID={`carelog-line-${entry.id}`}>
                    <Text style={styles.line}>{entry.text}</Text>
                  </View>
                ))}
              </CCCard>
            ))}
          </>
        )}

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          Everything is read from this device’s own records — nothing is sent anywhere, and an act
          nobody recorded simply isn’t listed.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    fontFamily: FONT_HEAD,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: COLOR.accent,
    marginBottom: SPACE.s1,
  },
  row: {
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  line: { fontFamily: FONT_BODY, fontSize: 14.5, color: COLOR.text },
});
