/**
 * More — the fifth nav slot, and the app's HANDOFF command surface.
 *
 * The four areas of the pet-care OS are content organisation, not tabs: Home,
 * Pets, Records and More are the only four real slots (the "+" is drawn by the
 * tab bar and opens the Quick Add modal). So everything the OS map calls
 * YOUR CIRCLE / HANDOFF / SHOP & SETTINGS lives here, grouped in that order:
 *
 *   Your circle    — Care Circle (the roster on its way) and the real Emergency
 *                    card screen. Care Calendar used to sit here; it moved to
 *                    Records ▸ CARE (`records-care-calendar`) in OS-map chunk 3,
 *                    so `more-care-calendar` is retired.
 *   Handoff        — the whole Sitter/travel/vet family, one tap from the tab
 *                    bar instead of three: "I'm leaving town" (the guided
 *                    wizard), Sitter Mode (every pass you made or received),
 *                    caregiver check-in, Travel Mode, Vet Mode, Emergency Mode,
 *                    the printable binder and the sitter's "Open a Care Pass".
 *                    Sitter Mode stays a *stack under More* — it is a
 *                    top-level destination with its own stack and its own
 *                    premium gate, never a sixth tab (see the OS map §3a).
 *   Shop & settings — the shop (premium entry, co-parent share, PDF export and
 *                    all four keepsake products, all live), premium record
 *                    search and device settings.
 *   Privacy        — the offline promise, stated on-device.
 *
 * Every row deep-links into the More stack's nested Shop / Sitter navigators
 * with a plain `navigate('Sitter', { screen })`, so the child stack is created
 * at that screen and one step back lands on this menu again. Nothing here
 * reads or writes a store: no invented data, no dead buttons — a destination
 * that does not exist yet opens the illustrated ComingSoon page instead.
 *
 * 100% offline: local state and AsyncStorage only.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  CCCard,
  CCGradientCard,
  CCPill,
  CCSectionTitle,
  ccOnGradient,
} from '../components/CC';
import { usePremium } from '../context/PremiumContext';
import { useSitter } from '../context/SitterContext';
import type { MoreStackParamList } from '../navigation/MoreNavigator';
import { BS, COLOR, FONT_BODY, FONT_HEAD, RADIUS, SPACE } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'MoreHome'>;

/** One destination row: emoji chip, label, one-line caption, chevron. */
interface MoreRowProps {
  emoji: string;
  label: string;
  caption: string;
  onPress: () => void;
  /** Tint for the emoji chip (a `COLOR` token). */
  tint: string;
  testID?: string;
}

function MoreRow({ emoji, label, caption, onPress, tint, testID }: MoreRowProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={[styles.rowChip, { backgroundColor: tint }]}>
        <Text style={styles.rowChipEmoji}>{emoji}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={BS.caption}>{caption}</Text>
      </View>
      <Text style={styles.rowChevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function MoreScreen({ navigation }: Props): React.JSX.Element {
  const premium = usePremium();
  const { carePasses } = useSitter();

  const unlocked = premium.isPremium();
  const trialActive = unlocked && !premium.unlockedAt();
  const premiumState = unlocked
    ? trialActive
      ? `Active · ${premium.trialRemainingDays()} days left in your trial`
      : 'Active on this device'
    : 'One-time unlock · 14-day free trial';

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <Text style={BS.eyebrow}>Pet parent command center</Text>
        <Text style={BS.h1}>More</Text>
        <Text style={BS.caption}>
          Your circle, the handoff tools and the shop. Everything here stays on this device.
        </Text>

        {/* ---- Blueprint Premium: the pricing entry ---- */}
        <CCGradientCard
          gradient="premium"
          style={styles.premiumCard}
          onPress={() => navigation.navigate('Shop', { screen: 'Premium' })}
          accessibilityLabel="Blueprint Premium"
          testID="more-premium-card"
        >
          <Text style={ccOnGradient.eyebrow}>The blueprint</Text>
          <Text style={styles.premiumTitle}>Blueprint Premium</Text>
          <Text style={[ccOnGradient.body, styles.premiumState]}>{premiumState}</Text>
          <Text style={[ccOnGradient.body, styles.premiumLink]}>
            {unlocked ? 'Manage Blueprint Premium' : 'Unlock Blueprint Premium'} ›
          </Text>
        </CCGradientCard>
        <Text style={[BS.caption, styles.premiumNote]}>
          Reminders, co-parent sharing, unlimited history and PDF export. Tracking, profiles and
          records stay free.
        </Text>

        {/* ---- Your circle ---- */}
        <CCSectionTitle
          eyebrow="Your circle"
          title="People & emergency plans"
          emoji="🐾"
          accent={COLOR.aqua}
        />
        <MoreRow
          emoji="👥"
          label="Care Circle"
          caption="Pet parents, sitters, family and emergency contacts — on its way"
          tint={COLOR.aqua}
          onPress={() =>
            navigation.navigate('ComingSoon', {
              title: 'Care Circle',
              emoji: '🐾',
              message:
                'Your pet parents, sitters, family and emergency contacts will live here — each one kept on this device.',
            })
          }
          testID="more-care-circle"
        />
        <MoreRow
          emoji="🚨"
          label="Emergency card"
          caption="The printable card a sitter or emergency vet reads off your device"
          tint={COLOR.coral}
          onPress={() => navigation.navigate('EmergencyCard')}
          testID="more-emergency-card"
        />

        {/* ---- Handoff ---- */}
        <CCSectionTitle
          eyebrow="Handoff"
          title="Sitter, travel & the vet"
          emoji="🤝"
          accent={COLOR.coral}
          right={
            <CCPill
              label={`${carePasses.length} pass${carePasses.length === 1 ? '' : 'es'}`}
              tone="coral"
            />
          }
        />
        <MoreRow
          emoji="🧳"
          label="I'm leaving town"
          caption="Build the care pass step by step — premium"
          tint={COLOR.tangerine}
          onPress={() => navigation.navigate('Sitter', { screen: 'CarePassWizard' })}
          testID="more-handoff-leaving-town"
        />
        <MoreRow
          emoji="🤝"
          label="Sitter Mode"
          caption="Every pass you made or received"
          tint={COLOR.coral}
          onPress={() => navigation.navigate('Sitter', { screen: 'SitterHome' })}
          testID="more-sitter-mode"
        />
        <MoreRow
          emoji="✅"
          label="Caregiver check-in"
          caption="What happened today, one tap — free for a sitter"
          tint={COLOR.leaf}
          onPress={() => navigation.navigate('Sitter', { screen: 'CheckIn' })}
          testID="more-handoff-checkin"
        />
        <MoreRow
          emoji="✈️"
          label="Travel Mode"
          caption="The trip, the packing list, the handoff"
          tint={COLOR.aqua}
          onPress={() => navigation.navigate('Sitter', { screen: 'TravelMode' })}
          testID="more-handoff-travel"
        />
        <MoreRow
          emoji="🩺"
          label="Vet Mode"
          caption="Before, during and after a vet visit"
          tint={COLOR.blue}
          onPress={() => navigation.navigate('Sitter', { screen: 'VetMode' })}
          testID="more-handoff-vet"
        />
        <MoreRow
          emoji="🚨"
          label="Emergency Mode"
          caption="Allergies, chip and the numbers to call"
          tint={COLOR.coral}
          onPress={() => navigation.navigate('Sitter', { screen: 'Emergency' })}
          testID="more-handoff-emergency"
        />
        <MoreRow
          emoji="📄"
          label="Printable binder"
          caption="The whole care file on paper"
          tint={COLOR.lavender}
          onPress={() => navigation.navigate('Sitter', { screen: 'PrintableBinder' })}
          testID="more-handoff-binder"
        />
        <MoreRow
          emoji="🔑"
          label="Open a Care Pass"
          caption="Looking after someone's pets? Open the pass they shared — free"
          tint={COLOR.lavender}
          onPress={() => navigation.navigate('Sitter', { screen: 'OpenCarePass' })}
          testID="more-open-care-pass"
        />

        {/* ---- Shop & settings ---- */}
        <CCSectionTitle
          eyebrow="Shop & settings"
          title="Premium, keepsakes & device"
          emoji="✨"
          accent={COLOR.tangerine}
        />
        <MoreRow
          emoji="🛍️"
          label="Shop & keepsakes"
          caption="The planner, memorial book, artwork and card pack — all live"
          tint={COLOR.tangerine}
          onPress={() => navigation.navigate('Shop', { screen: 'ShopHome' })}
          testID="more-shop"
        />
        <MoreRow
          emoji="🔍"
          label="Search every record"
          caption="Find anything across all pets — Blueprint Premium"
          tint={COLOR.leaf}
          onPress={() => navigation.navigate('Shop', { screen: 'Search' })}
          testID="more-search"
        />
        <MoreRow
          emoji="⚙️"
          label="Settings"
          caption="Your name, time zone, premium details and deleting your data"
          tint={COLOR.blue}
          onPress={() => navigation.navigate('Shop', { screen: 'Settings' })}
          testID="more-settings"
        />

        {/* ---- Privacy ---- */}
        <CCSectionTitle
          eyebrow="Privacy"
          title="The offline promise"
          emoji="🔒"
          accent={COLOR.leaf}
        />
        <CCCard accent={COLOR.leaf} glowTint={COLOR.leaf} style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>🔒 100% offline, by design</Text>
          <Text style={BS.caption}>
            No account, no cloud, no tracking. Every pet, record and care pass is stored on this
            device and survives restarts — nothing is ever uploaded.
          </Text>
        </CCCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  premiumCard: { marginTop: SPACE.s4 },
  premiumTitle: {
    fontFamily: FONT_HEAD,
    fontWeight: '700',
    fontSize: 24,
    color: COLOR.white,
    marginTop: 2,
  },
  premiumState: { marginTop: 6 },
  premiumLink: { marginTop: SPACE.s3, fontWeight: '700' },
  premiumNote: { marginTop: SPACE.s2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    backgroundColor: COLOR.surface,
    borderRadius: RADIUS.cardSm,
    borderWidth: 1,
    borderColor: COLOR.divider,
    paddingVertical: 12,
    paddingHorizontal: SPACE.s3,
    marginBottom: SPACE.s2,
  },
  rowChip: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  rowChipEmoji: { fontSize: 19 },
  rowText: { flex: 1 },
  rowLabel: { fontFamily: FONT_BODY, fontSize: 15.5, fontWeight: '700', color: COLOR.text },
  rowChevron: {
    fontFamily: FONT_HEAD,
    fontSize: 20,
    color: COLOR.accent,
    fontWeight: '700',
  },

  privacyCard: { marginTop: SPACE.s2 },
  privacyTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 17,
    fontWeight: '700',
    color: COLOR.text,
  },
});
