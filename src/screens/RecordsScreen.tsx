/**
 * Records — the CARE surface (OS content map §2.4).
 *
 * Two layers, in this order:
 *
 *  1. **All records** — the existing all-pets record list, unchanged: one row per
 *     `VetRecord` (thumb, title, pet · clinic · date, cost), the Blueprint Premium
 *     card for unlimited history + search, the global `Search ›` link and the
 *     `Add a record` button. It is wrapped in one container (`records-list`) so the
 *     CARE group below it can never be mistaken for part of the list.
 *  2. **🍽️ CARE** — the everyday-care group: Food & feeding and Medication open the
 *     *active pet's* existing module on the Pets tab, Routines / Supplies / Care
 *     calendar open the shared illustrated ComingSoon page, and a copy-only
 *     Vet records row scrolls the reader back up to the list they just passed.
 *
 * Multi-pet homes: the two module rows say the active pet's name out loud and show
 * a `Change pet ›` chip. The chip **only** sets the active pet (PetContext) — the
 * Feeding / Meds screens are not re-registered in this stack; they keep reading
 * PetContext on the Pets tab, so a morning edit can never fork into two states.
 * A household with no pets gets the same rows with no name and no chip.
 *
 * 100% offline — pure reads of PetContext + VetContext (AsyncStorage).
 */
import React, { useCallback, useMemo, useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CCSectionTitle } from '../components/CC';
import { usePets } from '../context/PetContext';
import { useVetRecords } from '../context/VetContext';
import { useAccount } from '../context/AccountContext';
import { usePremium } from '../context/PremiumContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { RecordsStackParamList } from '../navigation/RecordsNavigator';
import { recordKind } from '../utils/records';
import { shortDate } from '../utils/petDisplay';
import { BS, COLOR, FONT_BODY, RADIUS, SPACE } from '../theme';

type Props = NativeStackScreenProps<RecordsStackParamList, 'RecordsList'>;

/** One CARE destination: emoji chip, label, one-line caption, chevron. */
interface CareRowProps {
  emoji: string;
  label: string;
  caption: string;
  /** Tint for the emoji chip (a `COLOR` token). */
  tint: string;
  onPress: () => void;
  testID?: string;
  /** Present (with `activePetName`) only when the household has more than one pet. */
  onChangePet?: () => void;
  changePetTestID?: string;
  activePetName?: string | null;
}

function CareRow({
  emoji,
  label,
  caption,
  tint,
  onPress,
  testID,
  onChangePet,
  changePetTestID,
  activePetName,
}: CareRowProps): React.JSX.Element {
  return (
    <View style={styles.careRow}>
      <TouchableOpacity
        style={styles.careMain}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
      >
        <View style={[styles.careChip, { backgroundColor: tint }]}>
          <Text style={styles.careChipEmoji}>{emoji}</Text>
        </View>
        <View style={styles.careText}>
          <Text style={styles.careLabel}>{label}</Text>
          <Text style={BS.caption}>{caption}</Text>
        </View>
        <Text style={styles.careChevron}>›</Text>
      </TouchableOpacity>
      {/*
       * A sibling touchable, never a child of the main one: tapping the chip must
       * change the pet, not open the module. It sets the active pet and nothing
       * else (see the file docblock).
       */}
      {onChangePet ? (
        <TouchableOpacity
          style={styles.changeChip}
          onPress={onChangePet}
          accessibilityRole="button"
          accessibilityLabel={
            activePetName ? `Change pet — currently ${activePetName}` : 'Change pet'
          }
          testID={changePetTestID}
        >
          <Text style={styles.changeChipText}>Change pet ›</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function RecordsScreen({ navigation }: Props): React.JSX.Element {
  const rootNavigation = useTabRootNavigation();
  const { pets, activePet, selectPet } = usePets();
  const { vetRecords } = useVetRecords();
  /** The owner's chosen display time zone (Settings → Date & time). */
  const { timeZone } = useAccount();
  const premium = usePremium();

  /** The list is the CARE group's "above" — a row scrolls the reader back to it. */
  const scrollRef = useRef<ScrollView>(null);

  const rows = useMemo(() => {
    const nameById = new Map(pets.map((pet) => [pet.id, pet.name]));
    return [...vetRecords]
      .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
      .map((record) => ({
        ...record,
        petName: nameById.get(record.petId) ?? 'Pet',
      }));
  }, [vetRecords, pets]);

  /** More than one pet at home → the two module rows offer the `Change pet ›` chip. */
  const multiPet = pets.length > 1;
  const activeName = activePet?.name ?? pets[0]?.name ?? null;
  /** Names the active pet out loud, and stays honest in a household with none. */
  const petPhrase = activeName ?? 'your pet';

  /**
   * Sets the active pet, and only that. With two pets the chip toggles; with more
   * it walks the crew in list order. Nothing else about this screen changes — the
   * module screens themselves read the same PetContext.
   */
  const cycleActivePet = useCallback(() => {
    if (pets.length < 2) return;
    const index = pets.findIndex((pet) => pet.id === activePet?.id);
    const next = pets[(index + 1) % pets.length];
    if (next) void selectPet(next.id);
  }, [pets, activePet, selectPet]);

  const openPetsModule = useCallback(
    (screen: 'Feeding' | 'Meds') => rootNavigation.navigate('Pets', { screen }),
    [rootNavigation],
  );

  const scrollToList = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <View style={BS.screen}>
      <ScrollView ref={scrollRef} contentContainerStyle={BS.pad}>
        <View style={BS.rowBetween}>
          <Text style={BS.h1}>Records</Text>
          <TouchableOpacity onPress={() => rootNavigation.navigate('More', { screen: 'Shop', params: { screen: 'Search' } })}>
            <Text style={BS.link}>Search ›</Text>
          </TouchableOpacity>
        </View>

        {/* ---- 1. All records: the existing list, unchanged ---- */}
        <View testID="records-list">
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
                    {shortDate(record.visitDate, timeZone)}
                    {record.visitTime ? ` ${record.visitTime}` : ''}
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
                onPress={() => rootNavigation.navigate('More', { screen: 'Shop', params: { screen: 'Premium' } })}
              >
                <Text style={BS.btnPrimaryText}>Unlock full history</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[BS.btnSecondary, { marginTop: SPACE.s3 }]}
            onPress={() => navigation.navigate('AddRecord')}
            testID="records-add-record"
          >
            <Text style={BS.btnSecondaryText}>Add a record</Text>
          </TouchableOpacity>
          <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
            Every record is stored on this device — nothing is uploaded.
          </Text>
        </View>

        {/* ---- 2. CARE: the everyday-care group ---- */}
        <CCSectionTitle
          eyebrow="Care"
          title="Food, meds, routines & supplies"
          emoji="🍽️"
          accent={COLOR.tangerine}
        />
        <CareRow
          emoji="🍽️"
          label="Food & feeding"
          caption={`Meals, portions and repeat days for ${petPhrase}.`}
          tint={COLOR.tangerine}
          onPress={() => openPetsModule('Feeding')}
          testID="records-care-food"
          onChangePet={multiPet ? cycleActivePet : undefined}
          changePetTestID="records-care-food-change-pet"
          activePetName={activeName}
        />
        <CareRow
          emoji="💊"
          label="Medication"
          caption={`Doses, schedules and reminders for ${petPhrase}.`}
          tint={COLOR.lavender}
          onPress={() => openPetsModule('Meds')}
          testID="records-care-medication"
          onChangePet={multiPet ? cycleActivePet : undefined}
          changePetTestID="records-care-medication-change-pet"
          activePetName={activeName}
        />
        <CareRow
          emoji="🐕"
          label="Routines"
          caption="Walks, play and grooming, on a rhythm. On its way."
          tint={COLOR.leaf}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Routines',
              emoji: '🐕',
              message:
                'Walks, play and grooming will keep their own rhythm here — with a gentle nudge when one is due.',
              accent: COLOR.leaf,
            })
          }
          testID="records-care-routines"
        />
        <CareRow
          emoji="📦"
          label="Supplies"
          caption="Food bags, litter, meds running low. On its way."
          tint={COLOR.sunshine}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Supplies',
              emoji: '📦',
              message:
                'Food bags, litter and the medication that runs low will be tracked here, so nothing runs out mid-week.',
              accent: COLOR.sunshine,
            })
          }
          testID="records-care-supplies"
        />
        <CareRow
          emoji="🗓️"
          label="Care calendar"
          caption="Feeding, meds, walks and vet visits on one timeline. On its way."
          tint={COLOR.aqua}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Care calendar',
              emoji: '🗓️',
              message:
                'Food, medication, routines, supplies and appointments will land on one care calendar here.',
              accent: COLOR.aqua,
            })
          }
          testID="records-care-calendar"
        />
        {/*
         * The copy-only row: it exists so the CARE group names the vet records the
         * reader just scrolled past, and it scrolls them back to it. No testID by
         * design (OS map §2.4) — it is a pointer, not a destination.
         */}
        <CareRow
          emoji="🩺"
          label="Vet records"
          caption="Already above — every visit in one list."
          tint={COLOR.coral}
          onPress={scrollToList}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  careRow: {
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    paddingVertical: 12,
    paddingHorizontal: SPACE.s3,
    marginBottom: SPACE.s2,
  },
  careMain: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
  careChip: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  careChipEmoji: { fontSize: 19 },
  careText: { flex: 1 },
  careLabel: { fontFamily: FONT_BODY, fontSize: 15.5, fontWeight: '700', color: COLOR.text },
  careChevron: {
    fontFamily: FONT_BODY,
    fontSize: 20,
    color: COLOR.accent,
    fontWeight: '700',
  },
  changeChip: {
    alignSelf: 'flex-start',
    marginTop: SPACE.s2,
    marginLeft: 40 + SPACE.s3,
    paddingVertical: 5,
    paddingHorizontal: SPACE.s2,
    borderRadius: RADIUS.pill,
    backgroundColor: COLOR.accentSoft,
  },
  changeChipText: { fontFamily: FONT_BODY, fontSize: 12.5, fontWeight: '700', color: COLOR.accent },
});
