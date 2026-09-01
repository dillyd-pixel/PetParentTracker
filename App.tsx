/**
 * App entry point. Renders the root navigator, which wires the pet data
 * context (AsyncStorage-backed), navigation tree, and all screens together.
 *
 * 100% offline: no network, no API calls — every byte of user data lives on
 * the device via AsyncStorage.
 */
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return <RootNavigator />;
}
