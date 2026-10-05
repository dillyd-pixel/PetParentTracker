/**
 * The app's root state: every screen lives in (or is reachable from) this tree.
 *
 * Information architecture (design Phase A — the "Pet Parent Command Center"
 * shell). The bottom nav is exactly five slots, in order:
 *
 *   Home    — today's meds and meals across every pet, the pets list, the
 *             spend snapshot and the premium card (the Today dashboard; its
 *             content is rebuilt in Phase B).
 *   Pets    — the pets list → a pet's page (photo plate, meta, Vaccines and
 *             Feeding buttons, medications, journal) → every per-pet module
 *             (vaccines, meds, feeding, vet records, expenses, journal).
 *   +       — the raised centre button. It is not a route: it opens the
 *             root-stack Quick Add modal (the real one-tap sheet arrives in
 *             Phase C; today the sheet previews the nine actions honestly).
 *   Records — every pet's vet records in one list, plus add-a-record with
 *             camera / library capture.
 *   More    — everything else, grouped: Care Circle / Care Calendar
 *             placeholders and the Emergency Card (Your circle), Sitter Mode
 *             and Open a Care Pass (Care & handoff), Shop & keepsakes, record
 *             search and Settings (Extras), plus the offline promise.
 *
 * Nothing was lost in the pivot: the old Card, Shop and Sitter tabs are the
 * More stack's `EmergencyCard`, nested `Shop` and nested `Sitter` screens, so
 * every one of them is still two taps away. Sitter Mode keeps its premium gate
 * and per-pet care instructions untouched.
 *
 * Layering:
 *  - `PetProvider` wraps everything (active-pet selection, pet CRUD), then the
 *    premium provider, the Sitter Mode provider (care passes) with the care
 *    instructions provider inside it, and the six module providers.
 *  - A web-safe `NativeStack` hosts `MainTabs` plus the modal `PetForm` and
 *    the modal `QuickAdd` sheet.
 *  - Each tab that needs depth owns a web-safe nested stack, so the browser
 *    preview keeps working exactly as on device.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigation,
} from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { createWebSafeStackNavigator } from './WebSafeStack';
import { CCTabBar } from './CCTabBar';
import { PetsNavigator } from './PetsNavigator';
import type { PetsStackParamList } from './PetsNavigator';
import { RecordsNavigator } from './RecordsNavigator';
import type { RecordsStackParamList } from './RecordsNavigator';
import { MoreNavigator } from './MoreNavigator';
import type { MoreStackParamList } from './MoreNavigator';

import { PetProvider } from '../context/PetContext';
import { AccountProvider } from '../context/AccountContext';
import { PremiumProvider } from '../context/PremiumContext';
import { SitterProvider } from '../context/SitterContext';
import { CareInstructionsProvider } from '../context/CareInstructionsContext';
import { VaccinesProvider } from '../context/VaccinesContext';
import { MedicationsProvider } from '../context/MedicationsContext';
import { FeedingProvider } from '../context/FeedingContext';
import { CheckInsProvider } from '../context/CheckInsContext';
import { AwardsProvider } from '../context/AwardsContext';
import { VetProvider } from '../context/VetContext';
import { ExpensesProvider } from '../context/ExpensesContext';
import { JournalProvider } from '../context/JournalContext';
import TodayScreen from '../screens/TodayScreen';
import PetFormScreen from '../screens/PetFormScreen';
import QuickAddSheetScreen from '../screens/QuickAddSheetScreen';
import OnboardingScreen, { hasSeenOnboarding } from '../screens/OnboardingScreen';
import { BS, COLOR } from '../theme';

/**
 * The four real slots of the design's IA, each carrying its nested stack. The
 * fifth slot — the raised "+" — is drawn by `CCTabBar` and opens the root
 * stack's Quick Add modal, so it is deliberately not a route here.
 */
export type MainTabParamList = {
  Home: undefined;
  Pets: NavigatorScreenParams<PetsStackParamList> | undefined;
  Records: NavigatorScreenParams<RecordsStackParamList> | undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type RootStackParamList = {
  /** The five-slot shell; Quick Add sends it nested params to open a screen. */
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  PetForm: { petId?: string } | undefined;
  QuickAdd: undefined;
};

/**
 * Tab-root screens navigate to sibling tabs *and* to the root stack's modals;
 * at runtime react-navigation bubbles a route the current navigator doesn't own
 * up to the parent. Typing the hook against both param lists keeps that honest
 * without casts.
 */
export type TabRootNavigation = NativeStackNavigationProp<
  MainTabParamList & RootStackParamList
>;

/** Convenience hook for the tab-root screens. */
export function useTabRootNavigation(): TabRootNavigation {
  return useNavigation<TabRootNavigation>();
}

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createWebSafeStackNavigator<RootStackParamList>();

/**
 * The five-slot shell: the four tab screens plus the custom bar that draws
 * Home | Pets | + | Records | More. The "+" opens the Quick Add modal on the
 * root stack (this component is a root-stack screen, so it can navigate there).
 */
function MainTabs(): React.JSX.Element {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openQuickAdd = useCallback(
    () => rootNavigation.navigate('QuickAdd'),
    [rootNavigation],
  );

  return (
    <Tab.Navigator
      tabBar={(props) => <CCTabBar {...props} onQuickAdd={openQuickAdd} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: COLOR.surface },
      }}
    >
      <Tab.Screen name="Home" component={TodayScreen} />
      <Tab.Screen name="Pets" component={PetsNavigator} />
      <Tab.Screen name="Records" component={RecordsNavigator} />
      <Tab.Screen name="More" component={MoreNavigator} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLOR.accent,
    background: COLOR.bg,
    card: COLOR.surface,
    text: COLOR.text,
    border: COLOR.divider,
  },
};

/** Root navigation container + providers (Pet, Premium, then the six modules). */
export default function RootNavigator(): React.JSX.Element {
  /**
   * First-run onboarding gate: `null` while the on-device flag is being read
   * (ivory-coloured blank instead of a flash of the wrong screen), `false`
   * until it has been finished or skipped once, `true` afterwards.
   */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding()
      .then(setOnboarded)
      .catch(() => setOnboarded(true));
  }, []);

  /**
   * After a full local wipe from Settings ("delete account"), the app goes back
   * to the first-run flow. Flipping `onboarded` unmounts the entire data tree —
   * every provider and screen — so nothing survives in memory either, and the
   * onboarding flag it just deleted is honoured without a reload. Works offline
   * on device and in the browser, with no new dependency.
   */
  const handleAccountDeleted = useCallback(() => setOnboarded(false), []);

  if (onboarded === null) {
    return <View style={BS.screen} />;
  }

  // First run only: the design's four steps, then the app itself.
  if (!onboarded) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <AccountProvider onDeleted={handleAccountDeleted}>
      <PetProvider>
        <PremiumProvider>
          <SitterProvider>
            <CareInstructionsProvider>
              <VaccinesProvider>
                <MedicationsProvider>
                  <FeedingProvider>
                    <CheckInsProvider>
                      <AwardsProvider>
                        <VetProvider>
                          <ExpensesProvider>
                            <JournalProvider>
                            <NavigationContainer theme={navTheme}>
                              <StatusBar style="auto" />
                              <Stack.Navigator>
                                <Stack.Screen
                                  name="Main"
                                  component={MainTabs}
                                  options={{ headerShown: false }}
                                />
                                <Stack.Screen
                                  name="PetForm"
                                  component={PetFormScreen}
                                  options={{
                                    // The form draws the design's own header (an h1 plus
                                    // a `‹ Pets` / `‹ Pet page` link), so the native
                                    // header is hidden — the modal is dismissed by that
                                    // in-page link (and Android's back gesture/button).
                                    presentation: 'modal',
                                    headerShown: false,
                                  }}
                                />
                                <Stack.Screen
                                  name="QuickAdd"
                                  component={QuickAddSheetScreen}
                                  options={{
                                    // The raised "+" opens this sheet; it draws its own
                                    // grabber, title and close affordances, and dismisses
                                    // by its scrim, its Close button or Android's back.
                                    presentation: 'modal',
                                    headerShown: false,
                                  }}
                                />
                              </Stack.Navigator>
                            </NavigationContainer>
                            </JournalProvider>
                          </ExpensesProvider>
                        </VetProvider>
                      </AwardsProvider>
                    </CheckInsProvider>
                  </FeedingProvider>
                </MedicationsProvider>
              </VaccinesProvider>
            </CareInstructionsProvider>
          </SitterProvider>
        </PremiumProvider>
      </PetProvider>
    </AccountProvider>
  );
}
