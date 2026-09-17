/**
 * The app's root state: every screen lives in (or is reachable from) this tree.
 *
 * Information architecture (Phase 1 of the Broadsheet design port) — five
 * text-only tabs, exactly as the design lays them out:
 *
 *   Today   — today's meds + meals across every pet, the pets list, the spend
 *             snapshot and the premium card.
 *   Pets    — the pets list → a pet's page (photo plate, meta, Vaccines and
 *             Feeding buttons, medications, journal) → every per-pet module
 *             (vaccines, meds, feeding, vet records, expenses, journal).
 *   Records — every pet's vet records in one list, plus add-a-record with
 *             camera / library capture.
 *   Card    — the pet's emergency card, exportable/printable on-device.
 *   Shop    — Blueprint Premium (trial + one-time unlock), the offline
 *             co-parent share and PDF export entries, and the keepsake
 *             products (on hold).
 *
 * Layering:
 *  - `PetProvider` wraps everything (active-pet selection, pet CRUD), then the
 *    premium provider and the six module providers.
 *  - A web-safe `NativeStack` hosts `MainTabs` plus the modal `PetForm`.
 *  - Each tab that needs depth owns a web-safe nested stack, so the browser
 *    preview keeps working exactly as on device.
 */
import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigation,
} from '@react-navigation/native';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { createWebSafeStackNavigator } from './WebSafeStack';
import { PetsNavigator } from './PetsNavigator';
import type { PetsStackParamList } from './PetsNavigator';
import { RecordsNavigator } from './RecordsNavigator';
import type { RecordsStackParamList } from './RecordsNavigator';
import { ShopNavigator } from './ShopNavigator';
import type { ShopStackParamList } from './ShopNavigator';

import { PetProvider } from '../context/PetContext';
import { PremiumProvider } from '../context/PremiumContext';
import { VaccinesProvider } from '../context/VaccinesContext';
import { MedicationsProvider } from '../context/MedicationsContext';
import { FeedingProvider } from '../context/FeedingContext';
import { VetProvider } from '../context/VetContext';
import { ExpensesProvider } from '../context/ExpensesContext';
import { JournalProvider } from '../context/JournalContext';
import TodayScreen from '../screens/TodayScreen';
import EmergencyCardScreen from '../screens/EmergencyCardScreen';
import PetFormScreen from '../screens/PetFormScreen';
import OnboardingScreen, { hasSeenOnboarding } from '../screens/OnboardingScreen';
import { BS, COLOR } from '../theme';

/** The five tabs of the design's IA, each carrying its nested stack. */
export type MainTabParamList = {
  Today: undefined;
  Pets: NavigatorScreenParams<PetsStackParamList> | undefined;
  Records: NavigatorScreenParams<RecordsStackParamList> | undefined;
  Card: undefined;
  Shop: NavigatorScreenParams<ShopStackParamList> | undefined;
};

export type RootStackParamList = {
  Main: undefined;
  PetForm: { petId?: string } | undefined;
};

/**
 * Tab-root screens navigate to sibling tabs *and* to the root stack's pet-form
 * modal; at runtime react-navigation bubbles a route the current navigator
 * doesn't own up to the parent. Typing the hook against both param lists keeps
 * that honest without casts.
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

/** Tab labels, in the design's wording. */
const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  Today: 'Today',
  Pets: 'Pets',
  Records: 'Records',
  Card: 'Card',
  Shop: 'Shop',
};

/**
 * The bottom tab bar, restyled to the design: five text-only items on paper,
 * one hairline on top, muted labels with the active one in deep teal.
 */
function MainTabs(): React.JSX.Element {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Text-only tabs — the design has no icon row.
        tabBarIcon: () => null,
        tabBarLabel: ({ focused }) => (
          <Text style={focused ? BS.tabTextActive : BS.tabText}>
            {TAB_LABELS[route.name as keyof MainTabParamList]}
          </Text>
        ),
        tabBarStyle: {
          backgroundColor: COLOR.bg,
          borderTopWidth: 1,
          borderTopColor: COLOR.divider,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Pets" component={PetsNavigator} />
      <Tab.Screen name="Records" component={RecordsNavigator} />
      <Tab.Screen name="Card" component={EmergencyCardScreen} />
      <Tab.Screen name="Shop" component={ShopNavigator} />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLOR.accent,
    background: COLOR.bg,
    card: COLOR.bg,
    text: COLOR.text,
    border: COLOR.divider,
  },
};

/** Root navigation container + providers (Pet, Premium, then the six modules). */
export default function RootNavigator(): React.JSX.Element {
  /**
   * First-run onboarding gate: `null` while the on-device flag is being read
   * (paper-coloured blank instead of a flash of the wrong screen), `false`
   * until it has been finished or skipped once, `true` afterwards.
   */
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasSeenOnboarding()
      .then(setOnboarded)
      .catch(() => setOnboarded(true));
  }, []);

  if (onboarded === null) {
    return <View style={BS.screen} />;
  }

  // First run only: the design's four steps, then the app itself.
  if (!onboarded) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <PetProvider>
      <PremiumProvider>
        <VaccinesProvider>
          <MedicationsProvider>
            <FeedingProvider>
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
                      </Stack.Navigator>
                    </NavigationContainer>
                  </JournalProvider>
                </ExpensesProvider>
              </VetProvider>
            </FeedingProvider>
          </MedicationsProvider>
        </VaccinesProvider>
      </PremiumProvider>
    </PetProvider>
  );
}
