/**
 * Blueprint Premium screen — the app's on-device paid tier.
 *
 * Not an upsell product: this screen presents the premium tier itself
 * (trial + one-time unlock, fully functional on-device, no money moves) and
 * the four premium features. Status is read live from PremiumContext:
 *  - Not premium      → "Start free for 14 days" + "Unlock Blueprint Premium".
 *  - Trial running    → "You're on Blueprint Premium (trial)" + remaining days.
 *  - Trial expired    → back to the start/unlock buttons.
 *  - Unlocked         → "You're on Blueprint Premium" (permanent).
 * "Restore" re-reads AsyncStorage so the web preview refreshes correctly.
 *
 * 100% offline: pure local state + local rendering; no network, no storefront.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { usePremium } from '../context/PremiumContext';
import { AppColors, cardShadow } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { PREMIUM_TRIAL_DAYS } from '../storage/premium';

/** The four premium features, in the owner's wording. */
const PREMIUM_FEATURES = [
  {
    title: 'Push reminders for meds, feeding and vaccines',
    emoji: '🔔',
  },
  {
    title: 'Share the account with a co-parent',
    emoji: '🤝',
  },
  {
    title: 'Unlimited record history and search',
    emoji: '🔍',
  },
  {
    title: "Export any pet's file as PDF",
    emoji: '📄',
  },
];

/** Human-friendly expiry date, e.g. "Thu, Sep 18". Empty when unset. */
function formatTrialEndDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function PremiumScreen() {
  const {
    isPremium,
    trialRemainingDays,
    trialStarted,
    trialEndsAt,
    unlockedAt,
    startTrial,
    unlock,
    restore,
  } = usePremium();
  const [busy, setBusy] = useState(false);

  const active = isPremium();
  const permanentlyUnlocked = !!unlockedAt();
  const trialActive = active && !permanentlyUnlocked;
  const trialDays = trialRemainingDays();
  const trialExpired = !active && trialStarted() && !permanentlyUnlocked;
  const endsOn = formatTrialEndDate(trialEndsAt());
  const unlockedOn = formatTrialEndDate(unlockedAt());
  const free = !active;

  const handleStartTrial = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startTrial();
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await unlock();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await restore();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Hero card */}
        <View style={[styles.heroCard, cardShadow]}>
          <Text style={styles.heroEmoji}>👑</Text>
          <Text style={styles.heroTitle}>Blueprint Premium</Text>
          <Text style={styles.heroPrice}>
            One-time unlock · <Text style={styles.heroPriceStrong}>$4/mo</Text>
          </Text>
          <View style={styles.trialBadge}>
            <Text style={styles.trialBadgeText}>
              {trialActive
                ? `14-day free trial · ${trialDays} day${trialDays === 1 ? '' : 's'} left`
                : '14-day free trial'}
            </Text>
          </View>
        </View>

        {/* Status banner */}
        {active ? (
          <View style={[styles.statusCard, cardShadow]}>
            <Text style={styles.statusEmoji}>✨</Text>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>You’re on Blueprint Premium</Text>
              <Text style={styles.statusText}>
                {trialActive
                  ? `Free trial · ${trialDays} day${trialDays === 1 ? '' : 's'} left${endsOn ? ` · ends ${endsOn}` : ''}`
                  : `Unlocked on-device${unlockedOn ? ` · ${unlockedOn}` : ''}`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.statusCard, cardShadow]}>
            <Text style={styles.statusEmoji}>💛</Text>
            <View style={styles.statusBody}>
              <Text style={styles.statusTitle}>
                {trialExpired ? 'Your free trial has ended' : 'Premium is available'}
              </Text>
              <Text style={styles.statusText}>
                {trialExpired
                  ? 'A new trial isn’t available — the trial runs once. You can still unlock Blueprint Premium below.'
                  : `Start the ${PREMIUM_TRIAL_DAYS}-day free trial or unlock Blueprint Premium — all on-device.`}
              </Text>
            </View>
          </View>
        )}

        {/* Feature list */}
        <View style={[styles.featureCard, cardShadow]}>
          <Text style={styles.featureHeading}>Why Blueprint Premium?</Text>
          {PREMIUM_FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{feature.emoji}</Text>
              <Text style={styles.featureText}>{feature.title}</Text>
            </View>
          ))}
          <Text style={styles.freeNote}>Tracking, profiles and records stay free.</Text>
        </View>

        {/* Actions */}
        {free ? (
          <View style={styles.actions}>
            {trialExpired && (
              <Text style={styles.expiredNote}>
                Your 14-day free trial has ended — the trial only runs once.
              </Text>
            )}
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, busy && styles.buttonDisabled]}
              onPress={handleStartTrial}
              disabled={busy || trialExpired}
            >
              <Text style={styles.buttonPrimaryText}>Start free for 14 days</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary, busy && styles.buttonDisabled]}
              onPress={handleUnlock}
              disabled={busy}
            >
              <Text style={styles.buttonSecondaryText}>Unlock Blueprint Premium</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.unlockedNote}>
            {permanentlyUnlocked
              ? 'Blueprint Premium is unlocked on this device. Enjoy!'
              : 'Your free trial is active — no need to unlock yet.'}
          </Text>
        )}

        {/* Restore: re-reads stored state (web preview refreshes correctly). */}
        <TouchableOpacity
          style={[styles.restoreBtn, busy && styles.buttonDisabled]}
          onPress={handleRestore}
          disabled={busy}
        >
          <Text style={styles.restoreText}>Restore</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  scroll: { padding: 16, paddingBottom: 40 },
  heroCard: {
    backgroundColor: AppColors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  heroEmoji: { fontSize: 40, marginBottom: 6 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: AppColors.text },
  heroPrice: {
    fontSize: 14,
    color: AppColors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  heroPriceStrong: { color: AppColors.primary, fontWeight: '700' },
  trialBadge: {
    marginTop: 10,
    backgroundColor: AppColors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  trialBadgeText: { color: AppColors.white, fontSize: 12, fontWeight: '700' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  statusEmoji: { fontSize: 26, marginRight: 10 },
  statusBody: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: AppColors.text },
  statusText: { fontSize: 13, color: AppColors.textMuted, marginTop: 3 },
  featureCard: {
    backgroundColor: AppColors.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  featureHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 10,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  featureEmoji: { fontSize: 18, marginRight: 10 },
  featureText: { flex: 1, fontSize: 14, color: AppColors.text },
  freeNote: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actions: { marginTop: 16 },
  expiredNote: {
    fontSize: 13,
    color: AppColors.textMuted,
    textAlign: 'center',
    marginBottom: 10,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonPrimary: { backgroundColor: AppColors.primary },
  buttonSecondary: {
    backgroundColor: AppColors.card,
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonPrimaryText: { color: AppColors.white, fontSize: 16, fontWeight: '700' },
  buttonSecondaryText: { color: AppColors.primary, fontSize: 16, fontWeight: '700' },
  unlockedNote: {
    fontSize: 13,
    color: AppColors.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  restoreBtn: { alignSelf: 'center', padding: 10, marginTop: 4 },
  restoreText: { fontSize: 13, color: AppColors.textMuted, fontWeight: '600' },
});