/**
 * React context for the device-level account preferences — the owner's name and
 * the time zone dates/times are shown in — plus the "delete account" wipe.
 *
 * Holds the persisted values in memory (mirroring AsyncStorage, like the other
 * contexts) so screens can read them synchronously: `TodayScreen` renders its
 * live date and clock through `timeZone`, and the Settings screen reads and
 * writes both. Nothing here is a login: no server, no credential, no sync —
 * just two local strings.
 *
 * `deleteAccount()` is the one destructive operation in the app: it removes
 * every key below the app's storage prefix and cancels all scheduled local
 * reminders, then hands control back to the caller's `onDeleted` (the root
 * navigator uses that to show the first-run onboarding again, with the whole
 * data tree unmounted and empty). 100% offline.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_USERNAME,
  loadAccountSettings,
  saveTimeZone,
  saveUsername,
  wipeAllAppData,
} from '../storage/account';
import { cancelAllScheduledReminders } from '../storage/notifications';
import { AUTO_TIME_ZONE } from '../utils/datetime';

interface AccountContextValue {
  /** The owner's name, or `DEFAULT_USERNAME` when they have never set one. */
  username: string;
  /** The chosen IANA zone, or `AUTO_TIME_ZONE` for this device's own zone. */
  timeZone: string;
  /** True once the stored values have been read (avoids a flash of defaults). */
  loaded: boolean;
  /** Save the owner's name (trimmed; blank reverts to the default). */
  updateUsername: (value: string) => Promise<string>;
  /** Save the chosen zone (`auto` clears it). Returns the zone now in effect. */
  updateTimeZone: (zone: string) => Promise<string>;
  /**
   * Delete everything this app has stored on this device and cancel every
   * scheduled local reminder. Resolves after the wipe has been attempted.
   */
  deleteAccount: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({
  children,
  onDeleted,
}: {
  children: React.ReactNode;
  /** Called after a successful wipe — the root navigator re-shows onboarding. */
  onDeleted?: () => void;
}) {
  const [username, setUsername] = useState<string>(DEFAULT_USERNAME);
  const [timeZone, setTimeZone] = useState<string>(AUTO_TIME_ZONE);
  const [loaded, setLoaded] = useState(false);

  // Load once on mount, like the other providers.
  useEffect(() => {
    let cancelled = false;
    loadAccountSettings()
      .then((settings) => {
        if (cancelled) return;
        setUsername(settings.username);
        setTimeZone(settings.timeZone);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateUsername = useCallback(async (value: string) => {
    const next = await saveUsername(value);
    setUsername(next);
    return next;
  }, []);

  const updateTimeZone = useCallback(async (zone: string) => {
    const next = await saveTimeZone(zone);
    setTimeZone(next);
    return next;
  }, []);

  const deleteAccount = useCallback(async () => {
    // Order matters: drop the reminders first (they point at records that are
    // about to disappear), then wipe every stored key.
    await cancelAllScheduledReminders();
    await wipeAllAppData();
    // Reset in-memory state too, in case the caller keeps this tree mounted.
    setUsername(DEFAULT_USERNAME);
    setTimeZone(AUTO_TIME_ZONE);
    onDeleted?.();
  }, [onDeleted]);

  const value = useMemo(
    () => ({
      username,
      timeZone,
      loaded,
      updateUsername,
      updateTimeZone,
      deleteAccount,
    }),
    [username, timeZone, loaded, updateUsername, updateTimeZone, deleteAccount],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

/** Hook for reading the account preferences anywhere inside AccountProvider. */
export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return ctx;
}
