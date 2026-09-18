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
 * Detailed care instructions, the Today care dashboard and emergency mode are
 * later stages — this screen says so rather than pretending otherwise.
 *
 * 100% offline: invitation text built locally, shared locally, no upload.
 */
import React, { useState } from 'react';
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

import BackgroundCharacters from '../components/BackgroundCharacters';
import CarePassStatusBadge from '../components/CarePassStatusBadge';
import { usePets } from '../context/PetContext';
import { useSitter } from '../context/SitterContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import {
  carePassFileName,
  resolveCarePassPets,
  serializeCarePassInvite,
} from '../storage/carePasses';
import {
  carePassDateRange,
  carePassDurationDays,
  carePassPermissionLabel,
  carePassSectionLabel,
  carePassStatus,
  carePassStatusLabel,
} from '../types';
import { petEmojiFor, petSpeciesLabel } from '../utils/petDisplay';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'CarePassDetail'>;

const SHARE_MIME_TYPE = 'application/json';

export default function CarePassDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { getPass, carePasses, closePass } = useSitter();
  const { pets } = usePets();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  /** The invite text, shown on the web preview where there is no share sheet. */
  const [shareText, setShareText] = useState('');

  const pass = getPass(route.params.passId) ?? carePasses.find((p) => p.id === route.params.passId);

  if (!pass) {
    return (
      <View style={BS.screen}>
        <BackgroundCharacters />
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
      <BackgroundCharacters />
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

        <Text style={[BS.italic, { marginTop: SPACE.s4 }]}>
          Detailed care instructions, the Today care dashboard and check-in, and emergency mode
          arrive in a later stage — this pass lists what a sitter may see, and the pets it
          covers.
        </Text>

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
