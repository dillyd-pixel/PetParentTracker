/**
 * Shop — Blueprint Premium, the offline co-parent share, PDF export and the
 * keepsake products (on hold).
 *
 * The design's shop page, restyled to our real product decisions:
 *  - Premium is a ONE-TIME UNLOCK with a 14-day trial (no subscription, no
 *    "$4/mo" marketing copy) — the buttons open the premium screen, where the
 *    trial/unlock flow and its stored state live.
 *  - Co-parent sharing stays our offline export/import implementation: premium
 *    travels with the share file, import is open to everyone.
 *  - The keepsake products are rows with NO prices and NO purchase flow. The
 *    printable pet planner is the first of them to be finished: it opens its own
 *    on-device screen (preview free, PDFs with Blueprint Premium), while the
 *    other three stay on hold for the owner.
 *
 * 100% offline: every entry point here is local state + on-device file export.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { CoParentShareRows } from '../components/CoParentShareRows';
import { ExportPetPdfRow } from '../components/ExportPetPdfRow';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, COLOR, SPACE } from '../theme';

/** The keepsake product routes this screen links to (all take no params). */
type KeepsakeRoute = 'PetPlanner' | 'MemorialBook' | 'Artwork' | 'EmergencyCard';

/** The keepsake products. The planner is live; the other three stay on hold. */
const PRODUCTS: Array<{ name: KeepsakeRoute; title: string; desc: string }> = [
  {
    name: 'PetPlanner',
    title: 'Printable pet planner',
    desc: 'On-device PDF planner you can print — 14 sections, Letter or A4.',
  },
  {
    name: 'MemorialBook',
    title: 'Memorial book',
    desc: 'A keepsake book generated from your data.',
  },
  {
    name: 'Artwork',
    title: 'Custom pet artwork',
    desc: 'Artwork made from your pet photo, on-device.',
  },
  {
    name: 'EmergencyCard',
    title: 'Emergency card pack',
    desc: 'Printable emergency info cards.',
  },
];

/** The four premium features, in the owner's wording. */
const PREMIUM_FEATURES = [
  'Push reminders for meds, feeding and vaccines',
  'Share the file with a co-parent',
  'Unlimited record history and search',
  "Export any pet's file as PDF",
];

export default function ShopScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { activePet } = usePets();
  const premium = usePremium();

  const unlocked = premium.isPremium();
  const trialActive = unlocked && !premium.unlockedAt();

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to More">
          <Text style={BS.link}>‹ More</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>Extras</Text>
        <Text style={BS.h1}>Premium & keepsakes</Text>

        {/* ---- Blueprint Premium (one-time unlock + 14-day trial) ---- */}
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardTitleLg}>Blueprint Premium</Text>
            <Text style={BS.priceText}>{unlocked ? 'Active' : 'One-time'}</Text>
          </View>
          <Text style={BS.body}>{PREMIUM_FEATURES.join(' · ')}</Text>
          {unlocked ? (
            <View style={[BS.btnSecondary, { opacity: 0.6 }]}>
              <Text style={BS.btnSecondaryText}>
                {trialActive
                  ? `Premium active — ${premium.trialRemainingDays()} days left in your trial`
                  : 'Premium unlocked on this device'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={BS.btnPrimary}
              onPress={() => navigation.navigate('Premium')}
            >
              <Text style={BS.btnPrimaryText}>Start free for 14 days</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={BS.btnSecondary}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={BS.btnSecondaryText}>
              {unlocked ? 'Manage Blueprint Premium' : 'Unlock Blueprint Premium'}
            </Text>
          </TouchableOpacity>
          <Text style={[BS.caption, { textAlign: 'center' }]}>
            Tracking, profiles and records stay free.
          </Text>
        </View>

        {/* ---- Search (premium) ---- */}
        <TouchableOpacity
          style={[BS.divRowBetween, { marginTop: SPACE.s4 }]}
          onPress={() => navigation.navigate('Search')}
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>Search every record</Text>
            <Text style={BS.caption}>Find anything across all pets — Blueprint Premium</Text>
          </View>
          <Text style={BS.link}>›</Text>
        </TouchableOpacity>

        {/* ---- Co-parent share (offline export/import) ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Co-parent share</Text>
        <Text style={BS.caption}>
          Offline by design: export the pet file and hand it over. Premium travels with the file.
        </Text>
        <View style={{ marginTop: SPACE.s2 }}>
          <CoParentShareRows />
        </View>

        {/* ---- PDF export ---- */}
        {activePet && (
          <>
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>
              {activePet.name}’s pet file
            </Text>
            <ExportPetPdfRow />
          </>
        )}

        {/* ---- Keepsakes ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Keepsakes</Text>
        {PRODUCTS.map((product) => (
          <TouchableOpacity
            key={product.name}
            style={BS.divRowBetween}
            onPress={() => navigation.navigate(product.name)}
          >
            <View style={{ flex: 1 }}>
              <Text style={BS.rowLabel}>{product.title}</Text>
              <Text style={BS.caption}>{product.desc}</Text>
              {product.name === 'PetPlanner' && (
                <Text style={[BS.caption, { color: COLOR.accent700 }]}>
                  {unlocked ? 'Ready to print' : 'Preview free · PDFs with Blueprint Premium'}
                </Text>
              )}
            </View>
            <Text style={BS.link}>›</Text>
          </TouchableOpacity>
        ))}
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          The printable pet planner is ready to use — preview it free, and generate, download, print
          or share the PDF with Blueprint Premium. The other keepsakes are still being designed: no
          prices, no purchase flow.
        </Text>

        {/* ---- Settings (quiet row — account, display zone, premium, wipe) ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>App</Text>
        <TouchableOpacity
          style={BS.divRowBetween}
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
        >
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>Settings</Text>
            <Text style={BS.caption}>
              Your name, time zone, premium and billing details, and deleting your data
            </Text>
          </View>
          <Text style={BS.link}>›</Text>
        </TouchableOpacity>
        <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
          Device settings, not an account: one name and one time zone, both stored only here.
        </Text>
      </ScrollView>
    </View>
  );
}
