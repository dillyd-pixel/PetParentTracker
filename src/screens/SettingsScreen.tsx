/**
 * Settings — the device-level account preferences, in the design's own voice.
 *
 * Four sections, on paper, under the screen's own `‹ Shop` header:
 *  - Account: the pet parent's name. A plain local string, no login and no
 *    credential — the field saves on return/blur, exactly like renaming the
 *    home title on Today.
 *  - Date & time: which time zone dates and times are shown in — this device's
 *    own (`auto`, the default) or one of the curated IANA zones. Every row
 *    shows that zone's current clock, so the effect of a choice is visible
 *    before it is made. What is *stored* never changes: ISO strings keep the
 *    date the owner typed.
 *  - Blueprint Premium: the live premium state, read from `usePremium()`
 *    (trial / one-time unlock), plus an honest billing note — no payment
 *    method is connected, nothing is charged on-device, and no invoice,
 *    amount or renewal date exists to show.
 *  - Danger: delete account. Two-step confirm, then a full local wipe (every
 *    key under the app's storage prefix + all scheduled local reminders), and
 *    the app returns to first-run onboarding with empty data.
 *
 * 100% offline: local state and local rendering only. No network, no account
 * server, no analytics — the destructive action deletes this device's copy and
 * nothing else, because nothing else exists.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAccount } from '../context/AccountContext';
import { usePremium } from '../context/PremiumContext';
import BackgroundCharacters from '../components/BackgroundCharacters';
import type { ShopStackParamList } from '../navigation/ShopNavigator';
import { DEFAULT_USERNAME } from '../storage/account';
import { PREMIUM_TRIAL_DAYS } from '../storage/premium';
import {
  AUTO_TIME_ZONE,
  TIME_ZONE_CHOICES,
  deviceTimeZone,
  formatClock,
  formatTimestampInTimeZone,
  timeZoneLabel,
  timeZoneOffsetLabel,
} from '../utils/datetime';
import { BS, COLOR, FONT_HEAD, SPACE } from '../theme';

export default function SettingsScreen(): React.JSX.Element {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const premium = usePremium();
  const { username, timeZone, updateUsername, updateTimeZone, deleteAccount } = useAccount();

  /* ---- Account: the owner's name ---- */
  const [nameDraft, setNameDraft] = useState(username);
  const [editingName, setEditingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const nameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the field in step with storage (including the async first load),
  // but never fight the owner while they are typing in it.
  useEffect(() => {
    if (!editingName) setNameDraft(username);
  }, [username, editingName]);

  useEffect(
    () => () => {
      if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
    },
    [],
  );

  /** Save on return/blur — trimmed, blank reverts to the default name. */
  const commitName = async () => {
    if (!editingName) return;
    setEditingName(false);
    const next = await updateUsername(nameDraft);
    setNameDraft(next);
    setNameSaved(true);
    if (nameSavedTimer.current) clearTimeout(nameSavedTimer.current);
    nameSavedTimer.current = setTimeout(() => setNameSaved(false), 2500);
  };

  /* ---- Date & time: the display time zone ---- */
  const [zonePickerOpen, setZonePickerOpen] = useState(false);
  const [zoneSaved, setZoneSaved] = useState(false);
  const zoneSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A live "now" so each row's clock is real; ticks twice a minute. */
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(
    () => () => {
      if (zoneSavedTimer.current) clearTimeout(zoneSavedTimer.current);
    },
    [],
  );

  const pickZone = async (zone: string) => {
    await updateTimeZone(zone);
    setZoneSaved(true);
    if (zoneSavedTimer.current) clearTimeout(zoneSavedTimer.current);
    zoneSavedTimer.current = setTimeout(() => setZoneSaved(false), 2500);
  };

  /** The device's own zone, resolved once per render for the "auto" row. */
  const deviceZone = useMemo(() => deviceTimeZone(), []);

  /* ---- Premium: live state, no invented billing ---- */
  const active = premium.isPremium();
  const permanentlyUnlocked = !!premium.unlockedAt();
  const trialActive = active && !permanentlyUnlocked;
  const trialExpired = !active && premium.trialStarted();
  const trialDays = premium.trialRemainingDays();
  const trialEndsOn = formatTimestampInTimeZone(premium.trialEndsAt(), timeZone);
  const unlockedOn = formatTimestampInTimeZone(premium.unlockedAt(), timeZone);

  const statusTitle = permanentlyUnlocked
    ? 'Premium active (one-time unlock)'
    : trialActive
      ? `Trial active — ${trialDays} day${trialDays === 1 ? '' : 's'} left`
      : trialExpired
        ? 'Trial ended — not premium'
        : 'Not premium yet';

  const statusDetail = permanentlyUnlocked
    ? `Unlocked on this device${unlockedOn ? ` on ${unlockedOn}` : ''}.`
    : trialActive
      ? `Free trial${trialEndsOn ? ` · ends ${trialEndsOn}` : ''} · shown in ${timeZoneLabel(timeZone)}.`
      : trialExpired
        ? 'The 14-day free trial runs once. You can still unlock Blueprint Premium — all on this device.'
        : `One-time unlock with a ${PREMIUM_TRIAL_DAYS}-day free trial. Tracking, profiles and records stay free.`;

  /* ---- Danger: delete account ---- */
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteProblem, setDeleteProblem] = useState(false);

  const runDelete = async () => {
    setDeleting(true);
    setDeleteProblem(false);
    try {
      // On success the root navigator swaps in the first-run onboarding and
      // unmounts this whole tree — nothing more to do here.
      await deleteAccount();
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
      setDeleteProblem(true);
    }
  };

  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        {/* The design's in-page header — this screen's own back link + title. */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back to Shop"
        >
          <Text style={BS.link}>‹ Shop</Text>
        </TouchableOpacity>
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Settings</Text>
        <Text style={BS.kicker}>This device only · nothing leaves it</Text>

        {/* ---- Account ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Account</Text>
        <Text style={BS.caption}>Your name, as this app addresses you.</Text>
        <TextInput
          style={[BS.input, styles.nameInput]}
          value={nameDraft}
          onChangeText={(value) => {
            setNameDraft(value);
            setEditingName(true);
            setNameSaved(false);
          }}
          onFocus={() => setEditingName(true)}
          onBlur={commitName}
          onSubmitEditing={commitName}
          returnKeyType="done"
          maxLength={40}
          placeholder={DEFAULT_USERNAME}
          placeholderTextColor={COLOR.textFaint}
          accessibilityLabel="Your name"
        />
        <View style={styles.feedbackRow}>
          <Text style={BS.caption}>
            {editingName
              ? 'Return or tap away to save. Blank restores “' + DEFAULT_USERNAME + '”.'
              : nameSaved
                ? 'Saved'
                : ''}
          </Text>
        </View>
        <Text style={BS.caption}>
          No sign-in, no password, no cloud account — this name is one local value
          stored on this device.
        </Text>

        {/* ---- Date & time ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Date & time</Text>
        <View style={BS.divRowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={BS.rowLabel}>Time zone</Text>
            <Text style={BS.caption}>
              {timeZoneLabel(timeZone)}
              {timeZone !== AUTO_TIME_ZONE ? ` · ${timeZoneOffsetLabel(timeZone, now)}` : ''}
            </Text>
          </View>
          <View style={styles.zoneRight}>
            <Text style={styles.clock}>{formatClock(now, timeZone)}</Text>
            <TouchableOpacity
              onPress={() => setZonePickerOpen((open) => !open)}
              accessibilityLabel={zonePickerOpen ? 'Hide the time zone list' : 'Choose a time zone'}
            >
              <Text style={BS.link}>{zonePickerOpen ? 'Done' : 'Change'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {zonePickerOpen && (
          <View style={styles.zoneList}>
            {TIME_ZONE_CHOICES.map((choice) => {
              const selected = choice.zone === timeZone;
              return (
                <TouchableOpacity
                  key={choice.zone}
                  style={styles.zoneRow}
                  onPress={() => pickZone(choice.zone)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={choice.label}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={selected ? styles.zoneLabelActive : BS.rowLabel}>
                      {choice.label}
                      {selected ? '  ✓' : ''}
                    </Text>
                    <Text style={BS.caption}>
                      {choice.zone === AUTO_TIME_ZONE
                        ? `Follow this device’s clock — currently ${deviceZone}`
                        : choice.detail}
                    </Text>
                  </View>
                  <Text style={styles.clock}>{formatClock(now, choice.zone)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.feedbackRow}>
          <Text style={BS.caption}>{zoneSaved ? 'Saved — dates and times now use this zone' : ''}</Text>
        </View>
        <Text style={BS.caption}>
          Dates and times across the app are shown in this zone — the live clock on
          Today, upcoming dates, and vet visits. What you type keeps the date you
          typed; only the display changes.
        </Text>

        {/* ---- Blueprint Premium + billing ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Blueprint Premium</Text>
        <View style={BS.card}>
          <View style={BS.rowBetween}>
            <Text style={BS.cardKicker}>Status</Text>
            <Text style={BS.caption}>
              {permanentlyUnlocked ? 'Unlocked' : trialActive ? 'Trial' : 'Free'}
            </Text>
          </View>
          <Text style={BS.cardTitleLg}>{statusTitle}</Text>
          <Text style={BS.body}>{statusDetail}</Text>
          <TouchableOpacity
            style={BS.btnSecondary}
            onPress={() => navigation.navigate('Premium')}
          >
            <Text style={BS.btnSecondaryText}>
              {permanentlyUnlocked ? 'Blueprint Premium details' : 'See Blueprint Premium'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Billing</Text>
        <Text style={BS.body}>
          No payment method connected. Billing arrives with the Play Store release;
          Blueprint Premium is a one-time unlock with a 14-day free trial, and
          nothing is charged on-device yet.
        </Text>
        <Text style={BS.caption}>
          There is no invoice, receipt, amount or renewal date to show — none exists
          on this device, because no payment has ever been made here.
        </Text>

        {/* ---- Danger: delete account ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Danger</Text>
        <View style={styles.dangerCard}>
          <Text style={styles.dangerTitle}>Delete account</Text>
          <Text style={BS.caption}>
            Removes everything this app has stored on this device — every pet,
            vaccine, medication, meal, vet record, expense, journal entry, reminder
            and setting — and cancels all scheduled reminders. The app returns to
            its first-run welcome screen. This cannot be undone, and there is no
            copy anywhere else to restore from.
          </Text>

          {!confirmingDelete ? (
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={() => setConfirmingDelete(true)}
              accessibilityLabel="Delete account and all data"
            >
              <Text style={styles.dangerButtonText}>Delete account & all data</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.dangerConfirmText}>
                Delete all data on this device now? This is the last step — there is
                no undo.
              </Text>
              <View style={styles.dangerActions}>
                <TouchableOpacity
                  style={[BS.btnSecondary, styles.dangerAction]}
                  onPress={() => setConfirmingDelete(false)}
                  disabled={deleting}
                >
                  <Text style={BS.btnSecondaryText}>Keep my data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dangerButton, styles.dangerAction, deleting && styles.busy]}
                  onPress={runDelete}
                  disabled={deleting}
                  accessibilityLabel="Confirm deleting everything"
                >
                  <Text style={styles.dangerButtonText}>
                    {deleting ? 'Deleting…' : 'Delete everything'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {deleteProblem && (
            <Text style={styles.dangerConfirmText}>
              The wipe did not finish, so nothing was confirmed as deleted. Try again.
            </Text>
          )}
        </View>

        <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
          Everything in this app lives on this device. Deleting it here is the whole
          deletion — there is no server that also holds a copy.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  nameInput: { marginTop: SPACE.s2 },
  feedbackRow: { minHeight: 18, justifyContent: 'center', marginTop: SPACE.s1 },
  zoneRight: { alignItems: 'flex-end', marginLeft: SPACE.s2, gap: 2 },
  clock: {
    fontFamily: FONT_HEAD,
    fontSize: 16,
    fontWeight: '700',
    color: COLOR.text,
  },
  zoneList: { marginTop: SPACE.s1 },
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  zoneLabelActive: { fontSize: 16, fontWeight: '600', color: COLOR.accent700 },
  dangerCard: {
    borderWidth: 1.5,
    borderColor: COLOR.accent2_700,
    padding: SPACE.s4,
    marginTop: SPACE.s2,
    gap: SPACE.s2,
  },
  dangerTitle: {
    fontFamily: FONT_HEAD,
    fontSize: 19,
    fontWeight: '700',
    color: COLOR.accent2_700,
  },
  dangerButton: {
    backgroundColor: COLOR.accent2_700,
    borderRadius: 2,
    paddingVertical: 12,
    paddingHorizontal: SPACE.s3,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: COLOR.bg,
    fontWeight: '700',
    fontSize: 15,
    fontFamily: FONT_HEAD,
  },
  dangerConfirmText: { fontSize: 13, color: COLOR.accent2_700, fontWeight: '600' },
  dangerActions: { flexDirection: 'row', gap: SPACE.s2 },
  dangerAction: { flex: 1 },
  busy: { opacity: 0.6 },
});
