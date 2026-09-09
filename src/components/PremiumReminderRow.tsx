/**
 * Shared premium-gated reminder controls for the pet care tabs.
 *
 * Blueprint Premium feature 1/4: meds, feeding, and vaccine reminders are a
 * premium feature. When the user is premium (unlocked or trial running), this
 * renders the real Switch; otherwise it renders a friendly lock row that
 * routes to the Blueprint Premium screen in the "More" tab. On the web
 * preview, reminders can never be delivered, so the control renders a note
 * (premium users see the switch disabled next to the note) instead of
 * silently doing nothing.
 *
 * 100% offline: no navigation deep-link URLs, no server — routing uses the
 * in-app tab navigator only.
 */
import React from 'react';
import { Platform, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { usePremium } from '../context/PremiumContext';
import { AppColors } from '../theme';

/** Navigate to the Blueprint Premium screen (nested in the "More" tab). */
function useGoToPremium(): () => void {
  // Loosely typed on purpose: the destination lives in the "More" tab's
  // nested stack, which the current tab's navigation type doesn't know.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  return () => {
    try {
      navigation.navigate('Upsells', { screen: 'Premium' });
    } catch {
      // Navigation must never crash a screen — the lock note stays visible.
    }
  };
}

/**
 * Premium-gated reminder row: a label + Switch for premium users, a "Part of
 * Blueprint Premium" lock row otherwise. Works for the card list rows and the
 * add/edit forms (the `compact` variant trims padding for modals).
 */
export function PremiumReminderRow({
  value,
  onToggle,
  label = 'Reminders',
  compact = false,
}: {
  value: boolean;
  onToggle: (enabled: boolean) => void;
  label?: string;
  compact?: boolean;
}) {
  const { isPremium } = usePremium();
  const premium = isPremium();
  const goToPremium = useGoToPremium();

  if (Platform.OS === 'web') {
    return (
      <View style={compact ? styles.formBlock : styles.cardBlock}>
        <View style={styles.row}>
          <Text style={styles.switchLabel}>{label}</Text>
          <Switch
            value={premium && value}
            onValueChange={premium ? onToggle : undefined}
            disabled={!premium}
            trackColor={{ false: AppColors.trackOff, true: AppColors.accent }}
            thumbColor={AppColors.white}
          />
        </View>
        {premium ? (
          <Text style={styles.webNote}>
            Notifications aren’t delivered in the web preview — reminders are
            saved on this device but nothing is scheduled here. They work on
            the Android app.
          </Text>
        ) : (
          <TouchableOpacity style={styles.lockRow} onPress={goToPremium}>
            <Text style={styles.lockText}>
              🔒 Part of Blueprint Premium — start your 14-day free trial
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!premium) {
    return (
      <View style={compact ? styles.formBlock : styles.cardBlock}>
        <TouchableOpacity style={styles.lockRow} onPress={goToPremium}>
          <Text style={styles.lockEmoji}>🔒</Text>
          <View style={styles.lockCopy}>
            <Text style={styles.lockTitle}>Reminders — Blueprint Premium</Text>
            <Text style={styles.lockText}>
              Part of Blueprint Premium — start your 14-day free trial
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={compact ? styles.formBlock : styles.cardBlock}>
      <View style={styles.row}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: AppColors.trackOff, true: AppColors.accent }}
          thumbColor={AppColors.white}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
  },
  formBlock: {
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: AppColors.text },
  webNote: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 6,
    lineHeight: 16,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  lockEmoji: { fontSize: 20, marginRight: 10 },
  lockCopy: { flex: 1 },
  lockTitle: { fontSize: 14, fontWeight: '700', color: AppColors.text },
  lockText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.primary,
    marginTop: 2,
    lineHeight: 18,
  },
});
