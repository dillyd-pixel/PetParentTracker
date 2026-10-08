/**
 * Shop — Blueprint Premium, the offline co-parent share, PDF export and the
 * keepsake products (all four live).
 *
 * The design's shop page, restyled to our real product decisions:
 *  - Premium is a ONE-TIME UNLOCK with a 14-day trial (no subscription, no
 *    "$4/mo" marketing copy) — the buttons open the premium screen, where the
 *    trial/unlock flow and its stored state live.
 *  - Co-parent sharing stays our offline export/import implementation: premium
 *    travels with the share file, import is open to everyone.
 *  - The keepsake products are cards with NO prices and NO purchase flow — the
 *    exact same product copy, links and live/on-hold state as before, presented
 *    as the house's premium cards (design pass 2026-10-07): a white rounded card
 *    on the ivory canvas, its own illustrated gradient icon, generous spacing, a
 *    soft shadow and a Blueprint Blue chevron. All four are finished and open
 *    their own on-device screens (preview free, PDFs with Blueprint Premium): the
 *    printable pet planner, the memorial book, custom pet artwork and the
 *    emergency card pack.
 *
 * Presentation only: no copy, no price, no state and no data flow changed. The
 * grid is one column on a phone and two on a tablet or a desktop window, capped
 * at a comfortable reading width instead of stretching across a wide screen.
 *
 * 100% offline: every entry point here is local state + on-device file export.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { usePets } from '../context/PetContext';
import { usePremium } from '../context/PremiumContext';
import { CoParentShareRows } from '../components/CoParentShareRows';
import { ExportPetPdfRow } from '../components/ExportPetPdfRow';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { BS, COLOR, FONT_HEAD, RADIUS, SHADOW, SPACE } from '../theme';

/** The keepsake product routes this screen links to (all take no params). */
type KeepsakeRoute = 'PetPlanner' | 'MemorialBook' | 'Artwork' | 'EmergencyCards';

/** The keepsake products — all four finished and live. */
const PRODUCTS: Array<{ name: KeepsakeRoute; title: string; desc: string }> = [
  {
    name: 'PetPlanner',
    title: 'Printable pet planner',
    desc: 'On-device PDF planner you can print — 14 sections, Letter or A4.',
  },
  {
    name: 'MemorialBook',
    title: 'Memorial book',
    desc: 'A keepsake book of one pet’s memories, milestones and life story — made on-device from your own records, Letter or A4.',
  },
  {
    name: 'Artwork',
    title: 'Custom pet artwork',
    desc: 'Artwork made from your pet photo, on-device.',
  },
  {
    name: 'EmergencyCards',
    title: 'Emergency pet card pack',
    desc: 'Wallet-sized emergency cards, one per pet — 85.6 × 54 mm, printed at 100% with an offline QR.',
  },
];

/** The keepsake rows that open a finished, live product screen — all four. */
const LIVE_PRODUCTS: KeepsakeRoute[] = [
  'PetPlanner',
  'MemorialBook',
  'Artwork',
  'EmergencyCards',
];

/**
 * Each keepsake's own illustrated icon: a gradient tile in the house palette
 * with the product's own glyph and a small paw badge. Presentation only — the
 * tile is never the tap target's only signal, the title carries the meaning.
 */
const ICONS: Record<KeepsakeRoute, { glyph: string; colors: [string, string] }> = {
  PetPlanner: { glyph: '📅', colors: ['#246BFD', '#31D7D7'] },      // blue → aqua
  MemorialBook: { glyph: '📖', colors: ['#FF6B78', '#9B78FF'] },     // coral → lavender
  Artwork: { glyph: '🖼️', colors: ['#9B78FF', '#246BFD'] },         // lavender → blue
  EmergencyCards: { glyph: '🪪', colors: ['#FFD84D', '#FF9548'] },   // sunshine → tangerine
};

/** The four premium features, in the owner's wording. */
const PREMIUM_FEATURES = [
  'Push reminders for meds, feeding and vaccines',
  'Share the file with a co-parent',
  'Unlimited record history and search',
  "Export any pet's file as PDF",
];

/** A very wide window is a reading width, not a poster: cap the content column. */
const WIDE_CONTENT = 980;

export default function ShopScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { activePet } = usePets();
  const premium = usePremium();
  const { width } = useWindowDimensions();

  const unlocked = premium.isPremium();
  const trialActive = unlocked && !premium.unlockedAt();
  /** Two keepsake cards per row from tablet up — never one stretched-to-death card. */
  const twoUp = width >= 700;
  const wide = width > WIDE_CONTENT;

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <View style={wide ? { width: WIDE_CONTENT, alignSelf: 'center' } : undefined}>
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

          {/* ---- Keepsakes: the four premium cards ---- */}
          <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Keepsakes</Text>
          <View style={[styles.grid, { marginTop: SPACE.s3 }]}>
            {PRODUCTS.map((product) => {
              const icon = ICONS[product.name];
              return (
                <TouchableOpacity
                  key={product.name}
                  style={[styles.card, twoUp && styles.cardTwoUp]}
                  onPress={() => navigation.navigate(product.name)}
                  accessibilityRole="button"
                  accessibilityLabel={product.title}
                  testID={`keepsake-card-${product.name}`}
                >
                  <LinearGradient
                    colors={icon.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconTile}
                  >
                    <Text style={styles.iconGlyph}>{icon.glyph}</Text>
                    <Text style={styles.iconPaw}>🐾</Text>
                    <Text style={[styles.spark, styles.sparkTop]}>✦</Text>
                  </LinearGradient>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{product.title}</Text>
                    <Text style={styles.cardDesc}>{product.desc}</Text>
                    {LIVE_PRODUCTS.includes(product.name) && (
                      <Text style={styles.cardNote}>
                        {unlocked ? 'Ready to print' : 'Preview free · PDFs with Blueprint Premium'}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
            All four keepsakes are ready to use — the printable pet planner, the memorial book,
            custom pet artwork and the emergency pet card pack. Preview any of them free, and
            generate, download, print or share the PDF with Blueprint Premium. No prices, no purchase
            flow, and no files leave your phone: every one of them is made on this device.
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** One card per row on a phone, two from tablet up. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.s3 },
  /**
   * A keepsake card: white on the ivory canvas, 22px corners, a soft shadow, a
   * 58pt gradient icon tile and a Blueprint Blue chevron. Big and calm — the
   * illustration carries the product, the type stays the house sans.
   */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: 'rgba(32,33,38,0.05)',
    padding: SPACE.s3,
    gap: SPACE.s3,
    ...SHADOW.card,
  },
  cardTwoUp: { width: '49%' },
  /** The gradient icon tile: the product's glyph, a paw badge and one sparkle. */
  iconTile: {
    width: 58,
    height: 58,
    borderRadius: RADIUS.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 26, lineHeight: 32 },
  iconPaw: { position: 'absolute', right: 3, bottom: 1, fontSize: 12, opacity: 0.9 },
  spark: {
    position: 'absolute',
    color: COLOR.surface,
    fontSize: 11,
    opacity: 0.85,
  },
  sparkTop: { right: 6, top: 4 },
  cardBody: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 18,
    fontWeight: '600',
    color: COLOR.text,
    letterSpacing: -0.2,
  },
  cardDesc: { fontFamily: BS.caption.fontFamily, fontSize: 13, color: COLOR.textMuted },
  cardNote: { fontFamily: BS.caption.fontFamily, fontSize: 12.5, color: COLOR.accent700 },
  chevron: {
    fontFamily: BS.link.fontFamily,
    fontSize: 26,
    lineHeight: 28,
    color: COLOR.blue,
    paddingHorizontal: SPACE.s1,
  },
});
