/**
 * The app's root state: every screen lives in (or is reachable from) this tree.
 *
 * Layering:
 *  - `PetProvider` wraps everything (active-pet selection, pet CRUD).
 *  - `VaccinesProvider`, `MedicationsProvider`, `FeedingProvider` and
 *    `VetProvider` sit inside it, so module screens can read the active pet
 *    and their own collections together.
 *  - A `NativeStack` hosts the `MainTabs` plus a modal `PetForm` screen.
 *  - The bottom tab bar: Home (Pet Profiles, fully working) + module tabs
 *    (Vaccines + Meds + Feeding + Vet Records fully working, the rest
 *    placeholder) + "More" (upsell tabs).
 *
 * Future modules plug in here by swapping a placeholder screen for the real
 * module screen; the data layer and active-pet context are already wired.
 */
import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  useNavigation,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text, TouchableOpacity } from 'react-native';

import { createWebSafeStackNavigator } from './WebSafeStack';

import { PetProvider, usePets } from '../context/PetContext';
import { PremiumProvider } from '../context/PremiumContext';
import { VaccinesProvider } from '../context/VaccinesContext';
import { MedicationsProvider } from '../context/MedicationsContext';
import { FeedingProvider } from '../context/FeedingContext';
import { VetProvider } from '../context/VetContext';
import { ExpensesProvider } from '../context/ExpensesContext';
import { JournalProvider } from '../context/JournalContext';
import HomeScreen from '../screens/HomeScreen';
import PetFormScreen from '../screens/PetFormScreen';
import {
  VaccinesScreen,
  MedsScreen,
  FeedingScreen,
  VetRecordsScreen,
  ExpensesScreen,
  JournalScreen,
} from '../screens/modules';
import { UpsellsNavigator } from '../screens/upsells';
import { AppColors } from '../theme';

export type MainTabParamList = {
  Home: undefined;
  Vaccines: undefined;
  Meds: undefined;
  Feeding: undefined;
  VetRecords: undefined;
  Expenses: undefined;
  Journal: undefined;
  Upsells: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  PetForm: { petId?: string } | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createWebSafeStackNavigator<RootStackParamList>();

/** Simple emoji-based tab icons (no icon library dependency — fewer native deps). */
function TabIcon({ emoji, color }: { emoji: string; color?: string }) {
  return <Text style={{ fontSize: 20, color }}>{emoji}</Text>;
}

/**
 * Home tab. HomeScreen needs the ROOT stack's navigation (to open the PetForm
 * modal), but it is rendered inside the bottom tab navigator. `useNavigation`
 * returns the nearest navigator's navigation object, which at runtime is the
 * tab's — and `navigate('PetForm')` bubbles up to the root stack, exactly as
 * when HomeScreen was registered as the tab's own component. We fetch it via
 * the generic hook so HomeScreen's prop type is satisfied with no cast.
 */
function HomeTab() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Main'>>();
  return <HomeScreen navigation={navigation} />;
}

/** The six future core-module tabs; each is a props-free placeholder screen. */
const PLACEHOLDER_TABS: Array<{
  name: keyof MainTabParamList;
  label: string;
  emoji: string;
  component: React.ComponentType;
}> = [
  { name: 'Vaccines', label: 'Vaccines', emoji: '💉', component: VaccinesScreen },
  { name: 'Meds', label: 'Meds', emoji: '💊', component: MedsScreen },
  { name: 'Feeding', label: 'Feeding', emoji: '🍖', component: FeedingScreen },
  { name: 'VetRecords', label: 'Vet', emoji: '🏥', component: VetRecordsScreen },
  { name: 'Expenses', label: 'Expenses', emoji: '💰', component: ExpensesScreen },
  { name: 'Journal', label: 'Journal', emoji: '📔', component: JournalScreen },
];

/** Global search entry: opens the premium-gated Search screen in the More stack. */
function SearchHeaderButton() {
  const navigation = useNavigation<any>();
  const { activePet } = usePets();
  return (
    <TouchableOpacity
      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}
      onPress={() => navigation.navigate('Upsells', { screen: 'Search' })}
      accessibilityLabel="Search all records"
    >
      <Text style={{ fontSize: 18, marginRight: activePet ? 8 : 0 }}>🔍</Text>
      <Text style={{ fontSize: 13, color: AppColors.textMuted }}>
        {activePet ? `🐾 ${activePet.name}` : 'No pet selected'}
      </Text>
    </TouchableOpacity>
  );
}

/** Bottom tabs: Home + six future modules (all placeholder except Home). */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.placeholder,
        headerTitleStyle: { fontWeight: '700' },
        headerRight: () => <SearchHeaderButton />,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeTab}
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon emoji="🐾" color={color} />,
        }}
      />
      {PLACEHOLDER_TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={{
            title: tab.label,
            tabBarIcon: ({ color }) => <TabIcon emoji={tab.emoji} color={color} />,
          }}
        />
      ))}
      <Tab.Screen
        name="Upsells"
        component={UpsellsNavigator}
        options={{
          title: 'More',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabIcon emoji="✨" color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: AppColors.primary,
    background: AppColors.background,
    card: AppColors.card,
    text: AppColors.text,
    border: AppColors.border,
  },
};

/** Root navigation container + providers (Pet, Premium, then Vaccines + Medications + Feeding). */
export default function RootNavigator(): React.JSX.Element {
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
                          options={({ route }) => ({
                            title: route.params?.petId ? 'Edit Pet' : 'New Pet',
                            presentation: 'modal',
                          })}
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
