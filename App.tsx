/**
 * App entry point. Renders the app root — the Warm Cream canvas and the
 * wallpaper layer — around the root navigator, which wires the pet data
 * context (AsyncStorage-backed), navigation tree, and all screens together.
 *
 * The wallpaper (`BackgroundCharacters`) is mounted here, ONCE, as the first
 * child of the root view: absolutely positioned, never touchable, and below
 * everything else, so every screen of the app — Home/Today, Pets, Records,
 * More, Shop, Sitter, onboarding, the modals — sits on it. No screen mounts it
 * itself. To make that visible, the root view carries the canvas colour
 * (`COLOR.bg`), the navigator theme's background is transparent and the shared
 * screen root (`BS.screen`) paints no fill. See the component's docstring for
 * the full stacking contract.
 *
 * 100% offline: no network, no API calls — every byte of user data lives on
 * the device via AsyncStorage. The only "service" touched is the device's
 * own local notification center (expo-notifications LOCAL triggers): the
 * app-wide handler + Android channel are configured here once at start.
 * That step is native-only — on web it is skipped entirely.
 */
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import BackgroundCharacters from './src/components/BackgroundCharacters';
import { setupNotifications } from './src/storage/notifications';
import { COLOR } from './src/theme';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // Idempotent: sets the in-app notification handler and (on Android 8+)
    // the "Medication reminders" notification channel. Best-effort — a
    // failure here must not block the rest of the app.
    setupNotifications().catch(() => undefined);
  }, []);
  return (
    <View style={styles.root}>
      <BackgroundCharacters />
      <RootNavigator />
    </View>
  );
}

const styles = StyleSheet.create({
  /** The app root: the ivory canvas the wallpaper is painted onto. */
  root: { flex: 1, backgroundColor: COLOR.bg },
});
