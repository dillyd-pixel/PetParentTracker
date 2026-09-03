/**
 * App entry point. Renders the root navigator, which wires the pet data
 * context (AsyncStorage-backed), navigation tree, and all screens together.
 *
 * 100% offline: no network, no API calls — every byte of user data lives on
 * the device via AsyncStorage. The only "service" touched is the device's
 * own local notification center (expo-notifications LOCAL triggers): the
 * app-wide handler + Android channel are configured here once at start.
 */
import React, { useEffect } from 'react';

import RootNavigator from './src/navigation/RootNavigator';
import { setupNotifications } from './src/storage/notifications';

export default function App() {
  useEffect(() => {
    // Idempotent: sets the in-app notification handler and (on Android 8+)
    // the "Medication reminders" notification channel. Best-effort — a
    // failure here must not block the rest of the app.
    setupNotifications().catch(() => undefined);
  }, []);

  return <RootNavigator />;
}