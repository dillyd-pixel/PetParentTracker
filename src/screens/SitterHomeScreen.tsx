/**
 * Sitter Mode home — every care pass on this device, and the two ways in.
 *
 *  - "I'm Leaving Town" (the pet parent's side): the guided eight-step wizard
 *    that builds a pass with every per-pet fact prefilled from the pet's own
 *    records. Premium-gated exactly like the compact create form, so a
 *    non-entitled user is routed to the Blueprint Premium screen instead of
 *    step 1. The card is always visible — the feature is never hidden.
 *  - "Create a Care Pass" (the same side, the compact way): the single-screen
 *    form, for an owner who already knows what they want. Same gate, same
 *    store, same invite code.
 *  - "Open a Care Pass" (the sitter's side): free, no account, no premium.
 *  - "Care instructions for your pets" (owner side): the permanent per-pet
 *    notes a sitter follows. Free to write and NOT premium-gated — the content
 *    is always the owner's; only creating a pass is premium. Each row opens
 *    that pet's notes (read view, then editor) in the Pets tab's stack.
 *
 * Each row shows who the pass is for, the dates, the pets it covers and a
 * status badge: Active (usable today), Expired (end date has passed) or
 * Closed (the owner ended it early). Statuses are derived at render time with
 * `carePassStatus()`, so an expired pass never shows as active just because it
 * was created while the dates were still ahead.
 *
 * 100% offline: passes are read from AsyncStorage through SitterContext.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import CarePassStatusBadge from '../components/CarePassStatusBadge';
import { CCCard } from '../components/CC';
import { useGoToPremium } from '../components/CarePassPremiumLock';
import { useCareInstructions } from '../context/CareInstructionsContext';
import { useCheckIns } from '../context/CheckInsContext';
import { usePremium } from '../context/PremiumContext';
import { usePets } from '../context/PetContext';
import { useSitter } from '../context/SitterContext';
import { useTabRootNavigation } from '../navigation/RootNavigator';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { resolveCarePassPets } from '../storage/carePasses';
import { careInstructionsSummary, carePassStatus, carePassStatusLabel } from '../types';
import type { CarePass } from '../types';
import { careLogCount } from '../utils/caregiverCheckIn';
import { petEmojiFor } from '../utils/petDisplay';
import { BS, COLOR, SPACE, TONE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'SitterHome'>;

export default function SitterHomeScreen({ navigation }: Props): React.JSX.Element {
  const { carePasses } = useSitter();
  const { pets } = usePets();
  const { checkIns } = useCheckIns();
  const { getForPet: getCareInstructions } = useCareInstructions();
  const premium = usePremium();
  const goToPremium = useGoToPremium();
  const rootNavigation = useTabRootNavigation();
  const entitled = premium.isPremium();

  // The pets a pass covers: the live pets here, or the snapshots that came
  // with a pass received from someone else's device.
  const petsLabel = (pass: CarePass): string => {
    const covered = resolveCarePassPets(pass, pets);
    if (covered.length === 0) return 'No pets listed';
    return covered.map((pet) => pet.name).join(' · ');
  };

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to More">
          <Text style={BS.link}>‹ More</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Care & handoff</Text>
        <Text style={BS.h1}>Sitter Mode</Text>
        <Text style={BS.body}>
          Hand a trusted caregiver a care pass so they can look after your pets while you’re
          away — the pets, the dates, and what they’re allowed to do. Nothing leaves your
          device: the pass travels as a file or a short code, exactly like a co-parent share.
        </Text>

        {/* ---- Caregiver check-in (free, both sides) ---- */}
        <CCCard
          glowTint={COLOR.aqua}
          accent={COLOR.aqua}
          onPress={() => navigation.navigate('CheckIn')}
          accessibilityLabel="Open caregiver check-in"
          testID="sitter-checkin-card"
          style={{ marginTop: SPACE.s3 }}
        >
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={[BS.cardKicker, { color: TONE.aqua.fg }]}>Free · no account</Text>
              <Text style={BS.cardTitleLg}>Caregiver check-in</Text>
            </View>
            <Text style={BS.link}>›</Text>
          </View>
          <Text style={BS.caption}>
            Fed, water, medication, walks, litter and how each pet is doing — one tap each, signed
            with who did it and the time. Works for you, and for a sitter with no account of their
            own.
          </Text>
        </CCCard>

        {/* ---- The guided creator (pet parent, premium) ---- */}
        <CCCard
          glowTint={COLOR.blue}
          accent={COLOR.blue}
          onPress={() =>
            entitled ? navigation.navigate('CarePassWizard') : goToPremium()
          }
          accessibilityLabel="I'm Leaving Town — build a care pass step by step"
          testID="sitter-leaving-town-card"
          style={{ marginTop: SPACE.s3 }}
        >
          <View style={styles.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={[BS.cardKicker, { color: TONE.blue.fg }]}>
                {entitled ? 'Guided · 8 steps' : 'Blueprint Premium'}
              </Text>
              <Text style={BS.cardTitleLg}>I’m Leaving Town</Text>
            </View>
            <Text style={BS.link}>›</Text>
          </View>
          <Text style={BS.caption}>
            Answer eight short steps and the pass writes itself from your own records: the pets,
            the days, their meals and medication, and who to call. Nothing is invented — blank
            stays blank, and you can edit every line.
          </Text>
        </CCCard>

        {/* ---- Create (pet parent, premium) ---- */}
        <TouchableOpacity
          style={[BS.btnPrimary, { marginTop: SPACE.s3 }]}
          onPress={() => (entitled ? navigation.navigate('CarePassForm') : goToPremium())}
          accessibilityRole="button"
          accessibilityLabel="Create a Care Pass"
        >
          <Text style={BS.btnPrimaryText}>Create a Care Pass</Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          {entitled
            ? 'The quick way: pick the pets, the dates and what your sitter may do.'
            : 'Blueprint Premium — start your 14-day free trial to create passes.'}
        </Text>

        {/* ---- Open (sitter, free) ---- */}
        <TouchableOpacity
          style={[BS.btnSecondary, { marginTop: SPACE.s4 }]}
          onPress={() => navigation.navigate('OpenCarePass')}
          accessibilityRole="button"
          accessibilityLabel="Open a Care Pass"
        >
          <Text style={BS.btnSecondaryText}>Open a Care Pass</Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2, textAlign: 'center' }]}>
          Looking after someone’s pets? Open the pass they shared — free, no account, no
          premium.
        </Text>

        {/* ---- The passes on this device ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>Care passes</Text>
        {carePasses.length === 0 ? (
          <View style={BS.dashedBox}>
            <Text style={BS.caption}>
              No care passes on this device yet — create one, or open one a pet parent shared
              with you.
            </Text>
          </View>
        ) : (
          carePasses.map((pass) => {
            const status = carePassStatus(pass);
            return (
              <TouchableOpacity
                key={pass.id}
                style={BS.divRow}
                onPress={() => navigation.navigate('CarePassDetail', { passId: pass.id })}
                accessibilityRole="button"
                accessibilityLabel={`Care pass for ${pass.caregiverName}`}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[BS.rowLabel, { flex: 1 }]}>
                    {pass.source === 'received'
                      ? `From ${pass.creatorName} → ${pass.caregiverName}`
                      : pass.caregiverName}
                  </Text>
                  <CarePassStatusBadge status={status} label={carePassStatusLabel(status)} />
                </View>
                <Text style={[BS.caption, { marginTop: SPACE.s1 }]}>
                  {pass.startDate} → {pass.endDate} · {petsLabel(pass)}
                </Text>
                <Text style={[BS.caption, { color: COLOR.textFaint, marginTop: 2 }]}>
                  Pass code {pass.inviteCode}
                </Text>
              </TouchableOpacity>
            );
          })
        )}

        {/* ---- Care instructions (owner side, always free) ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>
          Care instructions for your pets
        </Text>
        <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
          Write once what a sitter needs to know about each pet — food, bathroom, sleep,
          behaviour and quirks. It stays on this device, and it’s the content a Care Pass shows.
          Free: only creating a pass is part of Blueprint Premium.
        </Text>
        {pets.length === 0 ? (
          <View style={BS.dashedBox}>
            <Text style={BS.caption}>
              Add a pet first — care instructions belong to a pet.
            </Text>
          </View>
        ) : (
          pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={BS.divRowBetween}
              onPress={() =>
                rootNavigation.navigate('Pets', {
                  screen: 'CareInstructions',
                  params: { petId: pet.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Care instructions for ${pet.name}`}
              testID={`sitter-care-instructions-${pet.id}`}
            >
              <Text style={BS.rowLabel}>
                {petEmojiFor(pet)} {pet.name}
              </Text>
              <Text style={BS.link}>{careInstructionsSummary(getCareInstructions(pet.id))} ›</Text>
            </TouchableOpacity>
          ))
        )}

        {/* ---- Care log: what each pet's check-ins actually say ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>Care log</Text>
        <Text style={[BS.caption, { marginBottom: SPACE.s2 }]}>
          Every act a caregiver recorded and every mood note, newest first, with who did it and
          when. Free, and read straight off this device.
        </Text>
        {pets.length === 0 ? (
          <View style={BS.dashedBox}>
            <Text style={BS.caption}>
              Add a pet first — a care log belongs to a pet.
            </Text>
          </View>
        ) : (
          pets.map((pet) => {
            const count = careLogCount(checkIns, pet.id);
            return (
              <TouchableOpacity
                key={pet.id}
                style={BS.divRowBetween}
                onPress={() => navigation.navigate('CareLog', { petId: pet.id })}
                accessibilityRole="button"
                accessibilityLabel={`Care log for ${pet.name}`}
                testID={`sitter-care-log-${pet.id}`}
              >
                <Text style={BS.rowLabel}>
                  {petEmojiFor(pet)} {pet.name}
                </Text>
                <Text style={BS.link}>
                  {count === 0 ? 'Nothing yet' : `${count} recorded`} ›
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.s3 },
});
