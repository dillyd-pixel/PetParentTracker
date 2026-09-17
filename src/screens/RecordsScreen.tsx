/**
 * Records — every pet's records in one chronological list (the "Records" tab).
 *
 * Rows carry the photo thumb, the title, the pet · clinic · date line and the
 * cost, with the record kind on the right. The premium card links to the
 * unlimited-history / search tier, and "Add a record" opens the capture screen.
 *
 * Records are the app's existing `VetRecord` entities, so this list and each
 * pet's own Vet records screen are two views of one on-device store.
 * 100% offline — pure reads of VetContext (AsyncStorage).
 */
import React, { useMemo } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { useVetRecords } from '../context/VetContext';
import { usePremium } from '../context/PremiumContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { RecordsStackParamList } from '../navigation/RecordsNavigator';
import { recordKind } from '../utils/records';
import { shortDate } from '../utils/petDisplay';
import { BS, SPACE } from '../theme';

type Props = NativeStackScreenProps<RecordsStackParamList, 'RecordsList'>;

export default function RecordsScreen({ navigation }: Props): React.JSX.Element {
  const rootNavigation = useTabRootNavigation();
  const { pets } = usePets();
  const { vetRecords } = useVetRecords();
  const premium = usePremium();

  const rows = useMemo(() => {
    const nameById = new Map(pets.map((pet) => [pet.id, pet.name]));
    return [...vetRecords]
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
      .map((record) => ({
        ...record,
        petName: nameById.get(record.petId) ?? 'Pet',
      }));
  }, [vetRecords, pets]);

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <Text style={BS.h1}>Records</Text>
          <TouchableOpacity onPress={() => rootNavigation.navigate('Shop', { screen: 'Search' })}>
            <Text style={BS.link}>Search ›</Text>
          </TouchableOpacity>
        </View>

        {rows.length === 0 ? (
          <Text style={BS.italic}>Nothing filed yet. Photograph an invoice to start the file.</Text>
        ) : (
          rows.map((record) => (
            <View key={record.id} style={BS.divRowBetween}>
              {record.photoUri ? (
                <Image source={{ uri: record.photoUri }} style={BS.thumb} />
              ) : (
                <View style={[BS.thumb, BS.thumbBlank]} />
              )}
              <View style={{ flex: 1, marginLeft: SPACE.s2 }}>
                <Text style={BS.rowLabel}>{record.visitTitle}</Text>
                <Text style={BS.caption}>
                  {record.petName}
                  {record.clinicName ? ` · ${record.clinicName}` : ''} ·{' '}
                  {shortDate(record.visitDate)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={BS.rowLabel}>
                  {record.cost === undefined ? '—' : record.cost.toFixed(2)}
                </Text>
                <Text style={BS.caption}>{recordKind(record.notes)}</Text>
              </View>
            </View>
          ))
        )}

        {!premium.isPremium() && (
          <View style={BS.card}>
            <Text style={BS.cardKicker}>Blueprint Premium</Text>
            <Text style={BS.cardTitleLg}>
              Unlimited record history and search across every pet.
            </Text>
            <Text style={BS.caption}>
              One-time unlock with a 14-day free trial. Recording stays free; premium keeps every
              record searchable.
            </Text>
            <TouchableOpacity
              style={BS.btnPrimary}
              onPress={() => rootNavigation.navigate('Shop', { screen: 'Premium' })}
            >
              <Text style={BS.btnPrimaryText}>Unlock full history</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
          onPress={() => navigation.navigate('AddRecord')}
        >
          <Text style={BS.btnSecondaryText}>Add a record</Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          Every record is stored on this device — nothing is uploaded.
        </Text>
      </ScrollView>
    </View>
  );
}
