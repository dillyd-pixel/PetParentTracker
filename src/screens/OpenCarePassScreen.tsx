/**
 * Open a Care Pass — the sitter's side of Sitter Mode.
 *
 * Free, account-free and premium-free by design: a sitter on a fresh device
 * must be able to accept the pass the pet parent handed them without signing
 * in, buying anything, or owning a pet of their own. This screen therefore has
 * no premium gate at all (contrast `CarePassFormScreen`).
 *
 * Two ways in, both of them offline:
 *  - **The pass file** the owner sent — picked with the system document picker
 *    on device, or pasted as text (the same JSON the share sheet hands over,
 *    which is how a browser preview or a plain text message delivers it).
 *  - **The pass code** — six characters, typed by hand. There is no server to
 *    look a code up in, so the code resolves against the passes already on this
 *    device: it re-opens one the sitter has accepted before (and is the
 *    duplicate check when a second copy of the same pass arrives).
 *
 * Opening the same pass twice asks first (the inline confirm below) instead of
 * silently replacing the copy already on the device.
 *
 * 100% offline: no fetch, no URL, no account — local files, local text and
 * AsyncStorage.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import { useSitter } from '../context/SitterContext';
import type { SitterStackParamList } from '../navigation/SitterNavigator';
import {
  carePassFileProblemMessage,
  normalizeInviteCode,
  parseCarePassInvite,
} from '../storage/carePasses';
import type { CarePassInviteFile } from '../types';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<SitterStackParamList, 'OpenCarePass'>;

const INVITE_MIME_TYPE = 'application/json';

export default function OpenCarePassScreen({ navigation }: Props): React.JSX.Element {
  const { findByInviteCode, openInvite } = useSitter();
  const [code, setCode] = useState('');
  const [sharedText, setSharedText] = useState('');
  /** A parsed invite waiting for the sitter to confirm replacing a copy here. */
  const [pending, setPending] = useState<CarePassInviteFile | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setError('');
    setNotice('');
  };

  /** Open by hand-typed code: only a pass already on this device can match. */
  const handleOpenByCode = () => {
    reset();
    const wanted = normalizeInviteCode(code);
    if (!wanted) {
      setError('Type the six-character pass code the pet parent sent you.');
      return;
    }
    const match = findByInviteCode(wanted);
    if (!match) {
      setError(
        `No pass with code ${wanted} is on this device yet. Ask the pet parent to send the ` +
          `pass file (or paste the shared text below) — a code on its own can’t carry the ` +
          `pass, because nothing is fetched from a server.`,
      );
      return;
    }
    navigation.navigate('CarePassDetail', { passId: match.id });
  };

  /** Store a validated invite, asking first when a copy of it is already here. */
  const storeInvite = async (file: CarePassInviteFile, overwrite: boolean): Promise<void> => {
    setBusy(true);
    try {
      const outcome = await openInvite(file, { overwrite });
      if (!outcome.ok) {
        setPending(file);
        setNotice('');
        return;
      }
      setPending(null);
      navigation.navigate('CarePassDetail', { passId: outcome.pass.id });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong saving that pass on this device. Try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenText = async (raw: string): Promise<void> => {
    reset();
    const parsed = parseCarePassInvite(raw);
    if (!parsed.ok) {
      setError(carePassFileProblemMessage(parsed.problem));
      return;
    }
    await storeInvite(parsed.file, false);
  };

  /** Native only: pick the file the owner shared and open it. */
  const handlePickFile = async (): Promise<void> => {
    reset();
    setBusy(true);
    try {
      // Lazy native requires — keeps the web bundle free of native modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const DocumentPicker = require('expo-document-picker');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const FileSystem = require('expo-file-system/legacy');
      const picked = await DocumentPicker.getDocumentAsync({
        type: [INVITE_MIME_TYPE, 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled) return;
      const asset = picked.assets?.[0];
      if (!asset?.uri) {
        setError('The picker didn’t return a file to read.');
        return;
      }
      const raw: string = await FileSystem.readAsStringAsync(asset.uri);
      await handleOpenText(raw);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Something went wrong reading that file. Try again.',
      );
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
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>Open a Care Pass</Text>
        <Text style={BS.body}>
          Looking after someone’s pets? Open the pass they sent you. Free, no account, nothing
          to sign up for — the pass stays on this device.
        </Text>

        {/* ---- The pass file (device picker, or paste the shared text) ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s3 }]}>The pass file</Text>
        <Text style={BS.caption}>
          {Platform.OS === 'web'
            ? 'Open the file the pet parent sent you, or paste the shared text below.'
            : 'Pick the care-pass file the pet parent sent you (text, email, a chat — however they sent it).'}
        </Text>
        {Platform.OS === 'web' ? null : (
          <TouchableOpacity
            style={[BS.btnSecondary, { marginTop: SPACE.s2, opacity: busy ? 0.6 : 1 }]}
            onPress={handlePickFile}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Choose the pass file"
          >
            <Text style={BS.btnSecondaryText}>Choose the pass file</Text>
          </TouchableOpacity>
        )}
        <View style={BS.field}>
          <Text style={[BS.fieldLabel, { marginTop: SPACE.s3 }]}>
            Or paste the shared pass
          </Text>
          <TextInput
            style={[BS.input, { minHeight: 96, paddingTop: SPACE.s2 }]}
            value={sharedText}
            onChangeText={setSharedText}
            placeholder="{ the pass text the pet parent sent you }"
            placeholderTextColor={COLOR.textFaint}
            multiline
            accessibilityLabel="Shared pass text"
          />
        </View>
        <TouchableOpacity
          style={[BS.btnPrimary, { opacity: busy || !sharedText.trim() ? 0.6 : 1 }]}
          onPress={() => handleOpenText(sharedText)}
          disabled={busy || !sharedText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Open the pasted pass"
        >
          {busy ? (
            <ActivityIndicator color={COLOR.bg} />
          ) : (
            <Text style={BS.btnPrimaryText}>Open the pasted pass</Text>
          )}
        </TouchableOpacity>

        {/* ---- The pass code ---- */}
        <Text style={[BS.fieldLabel, { marginTop: SPACE.s6 }]}>The pass code</Text>
        <Text style={BS.caption}>
          Six characters. Re-opens a pass you already have on this device.
        </Text>
        <View style={[BS.row, { marginTop: SPACE.s2 }]}>
          <TextInput
            style={[BS.input, { flex: 1 }]}
            value={code}
            onChangeText={(value) => setCode(normalizeInviteCode(value))}
            placeholder="ABC123"
            placeholderTextColor={COLOR.textFaint}
            autoCapitalize="characters"
            maxLength={6}
            accessibilityLabel="Pass code"
          />
          <TouchableOpacity
            style={[BS.btnSecondary, { paddingHorizontal: SPACE.s3 }]}
            onPress={handleOpenByCode}
            accessibilityRole="button"
            accessibilityLabel="Open by code"
          >
            <Text style={BS.btnSecondaryText}>Open</Text>
          </TouchableOpacity>
        </View>

        {/* ---- Replacing a copy that is already here ---- */}
        {pending ? (
          <View style={BS.card}>
            <Text style={BS.cardKicker}>Already on this device</Text>
            <Text style={BS.cardTitleLg}>
              A pass with code {pending.pass.inviteCode} is already here
            </Text>
            <Text style={BS.body}>
              Replace it with this copy from {pending.pass.creatorName}? The pets, dates and
              sections come from the new copy.
            </Text>
            <TouchableOpacity
              style={[BS.btnPrimary, { opacity: busy ? 0.6 : 1 }]}
              onPress={() => storeInvite(pending, true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Replace the pass"
            >
              <Text style={BS.btnPrimaryText}>Replace it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={BS.btnSecondary}
              onPress={() => {
                setPending(null);
                setNotice('Kept the pass already on this device.');
              }}
              accessibilityRole="button"
              accessibilityLabel="Keep the existing pass"
            >
              <Text style={BS.btnSecondaryText}>Keep the one I have</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? (
          <Text style={{ color: COLOR.accent2_700, fontSize: 13, marginTop: SPACE.s3 }}>
            {error}
          </Text>
        ) : null}
        {notice ? (
          <Text style={{ color: COLOR.textMuted, fontSize: 13, marginTop: SPACE.s3 }}>
            {notice}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
