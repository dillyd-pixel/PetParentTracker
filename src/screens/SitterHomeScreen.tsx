/**
 * Sitter Mode home — every care pass on this device, and the two ways in.
 *
 *  - "Create a Care Pass" (the pet parent's side): premium-gated, so a
 *    non-entitled user is routed to the Blueprint Premium screen instead of
 *    the form. The button is always visible — the feature is never hidden.
 *  - "Open a Care Pass" (the sitter's side): free, no account, no premium.
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
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import CarePassStatusBadge from '../components/CarePassStatusBadge';
import { useGoToPremium } from '../components/CarePassPremiumLock';
import { usePremium } from '../context/PremiumContext';
import { usePets } from '../context/PetContext';
import { useSitter } from '../context/SitterContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import { resolveCarePassPets } from '../storage/carePasses';
import { carePassStatus, carePassStatusLabel } from '../types';
import type { CarePass } from '../types';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'SitterHome'>;

export default function SitterHomeScreen({ navigation }: Props): React.JSX.Element {
  const { carePasses } = useSitter();
  const { pets } = usePets();
  const premium = usePremium();
  const goToPremium = useGoToPremium();
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
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <Text style={BS.h1}>Sitter Mode</Text>
        <Text style={BS.body}>
          Hand a trusted caregiver a care pass so they can look after your pets while you’re
          away — the pets, the dates, and what they’re allowed to do. Nothing leaves your
          device: the pass travels as a file or a short code, exactly like a co-parent share.
        </Text>

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
            ? 'Pick the pets, the dates and what your sitter may do.'
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
      </ScrollView>
    </View>
  );
}
