/**
 * Vitals — the one weigh-in the app keeps (owner decision 2026-10-20).
 *
 * This page used to be an honest `ComingSoonView` placeholder ("weigh-in
 * history is the next thing to build"). The owner has since decided there is
 * no history to build: a pet's weight is a **single value**, stored on the pet
 * itself (`Pet.weight`, `Pet.weightUnit`, `Pet.weightUpdatedAt`), and this page
 * shows exactly that — the number, its unit, and the calendar day the owner
 * recorded it.
 *
 * What this page deliberately does NOT do:
 *  - no weight-history store, so no migration and no new key on the device;
 *  - no chart, no trend, no "since last time" delta, no projection — there is
 *    nothing to compare against, and a trend line drawn from one number would
 *    be an invented measurement;
 *  - no date when the schema has none: pets saved before `weightUpdatedAt`
 *    existed carry a weight with no date, and the page says so plainly instead
 *    of stamping today's date on an old number.
 *
 * It is a read view with one door out: the weight is edited where it has
 * always been edited — `PetForm`, the app's only weight field — reached through
 * the root stack so saving comes straight back here with the new value. Both
 * the filled state and the empty state carry that door, so this is never a
 * wall.
 *
 * 100% offline: reads `PetContext` (AsyncStorage) and nothing else.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CCCard } from '../components/CC';
import { usePets } from '../context/PetContext';
import type { PetsStackParamList } from '../navigation/PetsNavigator';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import { petEmojiFor, petWeightLabel, shortDate } from '../utils/petDisplay';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';

type Props = NativeStackScreenProps<PetsStackParamList, 'Vitals'>;

/** A well-formed ISO calendar day, or null. A malformed date is treated as absent. */
function isoDay(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export default function VitalsScreen({ navigation, route }: Props): React.JSX.Element {
  const routePetId = route.params?.petId;
  const { pets, activePet } = usePets();
  const rootNavigation = useTabRootNavigation();
  const pet = (routePetId && pets.find((entry) => entry.id === routePetId)) || activePet;

  if (!pet) {
    return (
      <View style={BS.screen}>
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

  const weightLabel = petWeightLabel(pet);
  const hasWeight = weightLabel.length > 0;
  const weighedOn = isoDay(pet.weightUpdatedAt);

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back to the pet's page"
          testID="vitals-back"
        >
          <Text style={BS.link}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>My pets</Text>
        <Text style={BS.h1}>Vitals</Text>
        <Text style={BS.kicker}>
          {petEmojiFor(pet)} {pet.name}
        </Text>

        {hasWeight ? (
          <CCCard
            glowTint={COLOR.aqua}
            radius={22}
            padding={SPACE.s4}
            style={{ marginTop: SPACE.s4 }}
            testID="vitals-card"
          >
            <Text style={BS.cardKicker}>Last weigh-in</Text>
            <Text style={styles.bigValue} testID="vitals-weight">
              {weightLabel}
            </Text>
            {weighedOn ? (
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]} testID="vitals-date">
                Recorded {shortDate(weighedOn)}
              </Text>
            ) : (
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]} testID="vitals-no-date">
                No date was recorded with this weight — that’s all the app knows, so it won’t
                make one up.
              </Text>
            )}
            <View style={styles.rule} />
            <Text style={BS.caption} testID="vitals-no-history">
              This is the whole picture: one number per pet, kept on {pet.name}’s profile. The
              app doesn’t log weigh-ins over time, so there’s no chart, no trend and no
              “since last time” here — nothing gets invented.
            </Text>
          </CCCard>
        ) : (
          <View style={[BS.dashedBox, { marginTop: SPACE.s4 }]} testID="vitals-empty">
            <Text style={{ fontSize: 34 }}>⚖️</Text>
            <Text style={[BS.rowLabel, { marginTop: SPACE.s2, textAlign: 'center' }]}>
              No weight on file yet
            </Text>
            <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
              A rough number from the last vet visit is plenty. It lives on {pet.name}’s
              profile, and there’s no weigh-in log behind it — the app keeps the one number and
              never charts a trend from it.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s4 }]}
          onPress={() => rootNavigation.navigate('PetForm', { petId: pet.id })}
          accessibilityRole="button"
          accessibilityLabel={
            hasWeight ? `Edit ${pet.name}’s weight in the profile` : `Add ${pet.name}’s weight`
          }
          testID="vitals-edit-weight"
        >
          <Text style={BS.btnPrimaryText}>
            {hasWeight ? 'Edit in profile' : 'Add in profile'}
          </Text>
        </TouchableOpacity>

        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          A pet’s weight has one home — the profile form. Saving there updates this page, Home’s
          Health Snapshot and the printable keepsakes at once. Stored on this device only.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = {
  /** The weigh-in itself — the biggest thing on the page, on purpose. */
  bigValue: {
    fontFamily: FONT_HEAD,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '700' as const,
    color: COLOR.text,
  },
  /** A hairline between the fact and the honest explanation. */
  rule: {
    height: 1,
    backgroundColor: COLOR.divider,
    marginVertical: SPACE.s3,
  },
};
