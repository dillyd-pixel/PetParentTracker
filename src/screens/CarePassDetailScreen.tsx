/**
 * One care pass, in full — the pet parent's copy and the sitter's copy alike.
 *
 * Shows who the pass is from and for, the permission level, the date range, the
 * status badge, the invite code and every care section the sitter may see, plus
 * the pets it covers with their species glyph (`petEmojiFor`, which also knows
 * an 'Other' pet's own species name). When the pass was received from someone
 * else's device the owner's name leads the screen: a sitter must never be in
 * doubt about whose pets these are.
 *
 * Owner actions: **Share pass file** (writes the invite on-device and opens the
 * system share sheet; on the web preview it shows the same text to copy) and
 * **Close pass** (ends the pass early — only ever offered on the copy created
 * here, so a sitter can't close someone else's pass).
 *
 * It also shows the two things this stage added:
 *  - **What the pass carries** — the per-pet notes the "I'm Leaving Town" wizard
 *    collected (feeding, medication, care notes, emergency contacts, microchip
 *    and allergies) plus the household note. A pass from the compact create form
 *    carries none, and the screen says so rather than showing empty rows.
 *  - **Check-ins** — the records filed under this pass, newest first, with who
 *    did it and the time (`utils/passCheckIns`). A pass with none falls back to
 *    the covered pets' records inside its own dates, and says which of the two
 *    the owner is reading, so a sit recorded before passes were tagged still
 *    shows up honestly.
 *
 * 100% offline: invitation text built locally, shared locally, no upload.
 */
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import CarePassStatusBadge from '../components/CarePassStatusBadge';
import { useAccount } from '../context/AccountContext';
import { useCheckIns } from '../context/CheckInsContext';
import { usePets } from '../context/PetContext';
import { useSitter } from '../context/SitterContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import {
  carePassFileName,
  resolveCarePassPets,
  serializeCarePassInvite,
} from '../storage/carePasses';
import {
  carePassContactLine,
  carePassDateRange,
  carePassDurationDays,
  carePassPermissionLabel,
  carePassPetNotes,
  carePassPetNotesAreEmpty,
  carePassSectionLabel,
  carePassStatus,
  carePassStatusLabel,
} from '../types';
import { passCheckInEntries, passWindowLabel } from '../utils/passCheckIns';
import { petEmojiFor, petSpeciesLabel } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'CarePassDetail'>;

const SHARE_MIME_TYPE = 'application/json';

export default function CarePassDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { getPass, carePasses, closePass } = useSitter();
  const { pets } = usePets();
  const { checkIns } = useCheckIns();
  const { timeZone } = useAccount();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  /** The invite text, shown on the web preview where there is no share sheet. */
  const [shareText, setShareText] = useState('');

  const pass = getPass(route.params.passId) ?? carePasses.find((p) => p.id === route.params.passId);

  // Hooks run before the "pass not found" return, so the order never changes.
  const petNames = useMemo(() => {
    const out: Record<string, string> = {};
    for (const pet of pets) out[pet.id] = pet.name;
    return out;
  }, [pets]);

  const checkInEntries = useMemo(
    () => (pass ? passCheckInEntries(checkIns, pass, { petNames, zone: timeZone }) : []),
    [checkIns, pass, petNames, timeZone],
  );

  if (!pass) {
    return (
      <View style={BS.screen}>
        <ScrollView contentContainerStyle={BS.pad}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={BS.link}>‹ Sitter Mode</Text>
          </TouchableOpacity>
          <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Pass not found</Text>
          <Text style={BS.body}>
            This pass isn’t on this device any more. Open it again from the file the pet
            parent sent you.
          </Text>
        </ScrollView>
      </View>
    );
  }

  const status = carePassStatus(pass);
  const owned = pass.source === 'created';
  const covered = resolveCarePassPets(pass, pets);
  /** Only the covered pets that actually carry notes — a blank pet shows nothing. */
  const carried = covered.filter((pet) => !carePassPetNotesAreEmpty(pet));
  const inviteText = () => serializeCarePassInvite(pass, pets);

  /** Owner: write the invite on-device and hand it to the share sheet. */
  const handleShare = async (): Promise<void> => {
    setError('');
    setNotice('');
    const json = inviteText();
    if (Platform.OS === 'web') {
      // No share sheet in the browser preview — show the very same document so
      // it can be copied to the sitter (and so the sitter flow is testable).
      setShareText(json);
      setNotice('No share sheet in the browser — copy the pass file below.');
      return;
    }
    setBusy(true);
    try {
      // Lazy native requires — keeps the web bundle free of native modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sharing = require('expo-sharing');
      const baseDir: string | null =
        FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? null;
      if (!baseDir) {
        setError('This device didn’t offer a place to write the pass file. Try again.');
        return;
      }
      const uri = `${baseDir}${carePassFileName(pass)}`;
      await FileSystem.writeAsStringAsync(uri, json);
      const available: boolean = await Sharing.isAvailableAsync();
      if (!available) {
        setShareText(json);
        setNotice(`The pass file is saved on this device at ${uri}`);
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: SHARE_MIME_TYPE,
        dialogTitle: `Care pass for ${pass.caregiverName}`,
      });
      setNotice(`Pass file ready — send it to ${pass.caregiverName}.`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong writing the pass file. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async (): Promise<void> => {
    setBusy(true);
    try {
      await closePass(pass.id);
      setNotice('Pass closed. It stays on both devices, marked Closed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={BS.link}>‹ Sitter Mode</Text>
        </TouchableOpacity>

        {/* The sitter's view: whose pets these are, right at the top. */}
        {owned ? (
          <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>
            {pass.caregiverName}’s care pass
          </Text>
        ) : (
          <>
            <Text style={[BS.kicker, { marginTop: SPACE.s3 }]}>Care pass from</Text>
            <Text style={BS.h1}>{pass.creatorName}</Text>
          </>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={BS.rowLabel}>Status</Text>
          <View style={{ marginLeft: SPACE.s2 }}>
            <CarePassStatusBadge status={status} label={carePassStatusLabel(status)} />
          </View>
        </View>

        <View style={[BS.divRowBetween, { marginTop: SPACE.s3 }]}>
          <Text style={BS.caption}>Pet parent</Text>
          <Text style={BS.rowLabel}>{pass.creatorName}</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.caption}>Sitter</Text>
          <Text style={BS.rowLabel}>{pass.caregiverName}</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.caption}>Dates</Text>
          <Text style={BS.rowLabel}>{carePassDateRange(pass)}</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.caption}>Runs for</Text>
          <Text style={BS.rowLabel}>{carePassDurationDays(pass)} days</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.caption}>Sitter may</Text>
          <Text style={BS.rowLabel}>{carePassPermissionLabel(pass.permissionLevel)}</Text>
        </View>
        <View style={BS.divRowBetween}>
          <Text style={BS.caption}>Pass code</Text>
          <Text selectable style={[BS.rowLabel, styles.code]} accessibilityLabel="Pass code">
            {pass.inviteCode}
          </Text>
        </View>

        {/* ---- The pets this pass covers ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Pets on this pass</Text>
        {covered.length === 0 ? (
          <Text style={BS.caption}>No pets are on this pass.</Text>
        ) : (
          covered.map((pet) => (
            <View key={pet.id} style={[BS.divRowBetween, { justifyContent: 'flex-start' }]}>
              <Text style={{ fontSize: 24, width: 34 }}>{petEmojiFor(pet)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={BS.rowLabel}>{pet.name}</Text>
                <Text style={BS.caption}>{petSpeciesLabel(pet)}</Text>
              </View>
            </View>
          ))
        )}

        {/* ---- What the sitter can see ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Sections the sitter sees</Text>
        <View style={BS.rowWrap}>
          {pass.visibleSections.map((section) => (
            <View key={section} style={BS.tag}>
              <Text style={BS.tagText}>{carePassSectionLabel(section)}</Text>
            </View>
          ))}
        </View>

        {/* ---- What the pass carries (the wizard's per-pet notes) ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>What this pass carries</Text>
        {carried.length === 0 ? (
          <Text style={BS.caption}>
            No per-pet notes are on this pass — it carries the pets, the dates and the sections
            above. “I’m Leaving Town” is the guided way to add meals, medication and emergency
            contacts.
          </Text>
        ) : (
          carried.map((pet) => {
            const notes = carePassPetNotes(pet);
            const rows: Array<[string, string]> = [];
            if (notes.feeding) rows.push(['Feeding', notes.feeding]);
            if (notes.medications) rows.push(['Medication', notes.medications]);
            if (notes.care) rows.push(['Care notes', notes.care]);
            for (const contact of notes.contacts) {
              rows.push([carePassContactLine(contact).split(':')[0], contact.name
                ? `${contact.name}${contact.phone ? ` · ${contact.phone}` : ''}`
                : contact.phone ?? '']);
            }
            if (notes.microchip) rows.push(['Microchip', notes.microchip]);
            if (notes.allergies) rows.push(['Allergies', notes.allergies]);
            return (
              <View key={`notes-${pet.id}`} style={{ marginTop: SPACE.s3 }}>
                <Text style={BS.rowLabel}>
                  {petEmojiFor(pet)} {pet.name}
                </Text>
                {rows.map(([label, value]) => (
                  <View key={`${pet.id}-${label}`} style={styles.noteRow}>
                    <Text style={styles.noteLabel}>{label}</Text>
                    <Text style={styles.noteValue}>{value}</Text>
                  </View>
                ))}
              </View>
            );
          })
        )}
        {pass.householdNote ? (
          <View style={{ marginTop: SPACE.s3 }}>
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s2 }]}>The house</Text>
            <Text style={styles.noteValue}>{pass.householdNote}</Text>
          </View>
        ) : null}

        {/* ---- Check-ins: what the sitter actually recorded ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Check-ins</Text>
        {checkInEntries.length === 0 ? (
          <Text style={BS.caption} testID="pass-checkin-empty">
            Nothing recorded under this pass yet. Anything logged in Caregiver check-in while the
            pass is running appears here with the sitter’s name and the time.
          </Text>
        ) : (
          <>
            <Text style={BS.caption} testID="pass-checkin-count">
              {checkInEntries.length === 1 ? '1 record' : `${checkInEntries.length} records`}
              {checkInEntries.some((entry) => entry.tagged)
                ? ' — filed under this pass.'
                : ` — from the pets on this pass, between ${passWindowLabel(
                    pass,
                    timeZone,
                  )} (recorded before passes were tagged).`}
            </Text>
            {checkInEntries.slice(0, 8).map((entry) => (
              <View key={entry.id} style={styles.checkInRow}>
                <Text style={styles.checkInText}>{entry.line}</Text>
                <Text style={styles.checkInDay}>{entry.dayKey}</Text>
              </View>
            ))}
            {checkInEntries.length > 8 ? (
              <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
                Newest 8 of {checkInEntries.length} — every line is in the pets’ care logs.
              </Text>
            ) : null}
          </>
        )}

        {/* ---- Owner actions ---- */}
        {owned ? (
          <>
            <Text style={[BS.fieldLabel, { marginTop: SPACE.s4 }]}>Hand it over</Text>
            <TouchableOpacity
              style={[BS.btnPrimary, { opacity: busy ? 0.6 : 1 }]}
              onPress={handleShare}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Share pass file"
            >
              {busy ? (
                <ActivityIndicator color={COLOR.bg} />
              ) : (
                <Text style={BS.btnPrimaryText}>Share pass file</Text>
              )}
            </TouchableOpacity>
            <Text style={[BS.caption, { marginTop: SPACE.s2 }]}>
              {Platform.OS === 'web'
                ? 'On the Android app this opens the share sheet. Here you can copy the pass text.'
                : `Sends ${pass.caregiverName} a file with this pass (code ${pass.inviteCode}) — nothing is uploaded.`}
            </Text>

            {status === 'active' ? (
              <TouchableOpacity
                style={[BS.btnSecondary, { marginTop: SPACE.s3, opacity: busy ? 0.6 : 1 }]}
                onPress={handleClose}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Close pass"
              >
                <Text style={BS.btnSecondaryText}>Close pass</Text>
              </TouchableOpacity>
            ) : (
              <Text style={[BS.caption, { marginTop: SPACE.s3 }]}>
                {status === 'closed'
                  ? 'You closed this pass — it stays on both devices, marked Closed.'
                  : 'This pass has passed its end date, so it reads as Expired.'}
              </Text>
            )}
          </>
        ) : (
          <Text style={[BS.caption, { marginTop: SPACE.s4 }]}>
            This pass came from {pass.creatorName}. Only they can change or close it.
          </Text>
        )}

        {shareText ? (
          <View style={{ marginTop: SPACE.s4 }}>
            <Text style={BS.fieldLabel}>Pass file (copy this to your sitter)</Text>
            <Text selectable style={styles.fileText} accessibilityLabel="Pass file text">
              {shareText}
            </Text>
          </View>
        ) : null}

        {notice ? (
          <Text style={{ color: COLOR.textMuted, fontSize: 13, marginTop: SPACE.s3 }}>
            {notice}
          </Text>
        ) : null}
        {error ? (
          <Text style={{ color: COLOR.accent2_700, fontSize: 13, marginTop: SPACE.s3 }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: 3 },
  noteRow: { marginTop: SPACE.s2 },
  noteLabel: {
    fontSize: 10.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: COLOR.textMuted,
  },
  noteValue: { fontSize: 14, lineHeight: 20, color: COLOR.text, marginTop: 2 },
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.s3,
    paddingVertical: SPACE.s2,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.divider,
  },
  checkInText: { flex: 1, fontSize: 14, lineHeight: 20, color: COLOR.text },
  checkInDay: { fontSize: 11.5, color: COLOR.textFaint },
  fileText: {
    fontSize: 11,
    color: COLOR.textMuted,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    padding: SPACE.s2,
    lineHeight: 15,
  },
});
