/**
 * Web-safe stack navigator factory.
 *
 * `createNativeStackNavigator` (react-native-screens) has no browser
 * implementation, so the web preview swaps in the JS-based
 * `@react-navigation/stack`, which runs on both platforms. Native builds
 * keep the native stack exactly as before — Android isn't affected.
 *
 * The returned navigator is typed as the native stack's: both
 * implementations expose the same `<Navigator>`/`<Screen>` API and pass the
 * same `navigation`/`route` props, so screens compiled against the native
 * types work unchanged (and typecheck) on web. Native-only options such as
 * `presentation` are accepted and simply fall back to the JS stack's
 * default (a card) in the browser.
 */
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createStackNavigator } from '@react-navigation/stack';
import type { ParamListBase } from '@react-navigation/routers';

/**
 * The stack navigator for this platform. On Android/iOS this is the native
 * stack; in the browser it is the JS stack, cast to the same shape so every
 * call site keeps its native-stack types.
 */
export function createWebSafeStackNavigator<ParamList extends ParamListBase>() {
  if (Platform.OS === 'web') {
    return createStackNavigator<ParamList>() as unknown as ReturnType<
      typeof createNativeStackNavigator<ParamList>
    >;
  }
  return createNativeStackNavigator<ParamList>();
}