/**
 * "More" tab — Blueprint Premium entry + the four upsell products (on hold).
 *
 * The "More" tab hosts a small stack:
 *  - UpsellList: a Search card + a Blueprint Premium card (opens the premium
 *    tier screen) followed by the four upsell products as a scrollable list.
 *  - Premium: the Blueprint Premium tier screen (trial + one-time unlock).
 *  - Search: the premium-gated global record search across all pets.
 *  - Each upsell product detail is a PlaceholderScreen describing the future
 *    on-device generator (no server — everything generated on the phone).
 *
 * Premium is not an upsell product: it's the app's paid tier, presented on
 * its own screen. The upsell products below it stay untouched and ON HOLD
 * for the owner — this list only adds the premium entry card above them.
 *
 * Products: Printable Pet Planner, Memorial Book, Custom Pet Artwork,
 * Emergency Pet Card.
 */
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { createWebSafeStackNavigator } from '../navigation/WebSafeStack';
import PlaceholderScreen from './PlaceholderScreen';
import PremiumScreen from './PremiumScreen';
import SearchScreen from './SearchScreen';
import { AppColors } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import { usePets } from '../context/PetContext';

export type UpsellStackParamList = {
  UpsellList: undefined;
  Premium: undefined;
  Search: undefined;
  PetPlanner: undefined;
  MemorialBook: undefined;
  Artwork: undefined;
  EmergencyCard: undefined;
};

const Stack = createWebSafeStackNavigator<UpsellStackParamList>();

const PRODUCTS: Array<{ name: keyof UpsellStackParamList; title: string; emoji: string; desc: string }> = [
  { name: 'PetPlanner', title: 'Printable Pet Planner', emoji: '📋', desc: 'On-device PDF planner you can print.' },
  { name: 'MemorialBook', title: 'Memorial Book', emoji: '🕊️', desc: 'A keepsake book generated from your data.' },
  { name: 'Artwork', title: 'Custom Pet Artwork', emoji: '🎨', desc: 'Artwork generated from your pet photo.' },
  { name: 'EmergencyCard', title: 'Emergency Pet Card', emoji: '🆘', desc: 'A printable emergency info card.' },
];

/** FlatList data: the search + premium entry cards first, then the upsell products. */
type MoreRow = { key: string; kind: 'search' | 'premium' | 'product'; product?: (typeof PRODUCTS)[number] };

const MORE_ROWS: MoreRow[] = [
  { key: 'search', kind: 'search' },
  { key: 'premium', kind: 'premium' },
  ...PRODUCTS.map((product) => ({ key: product.name, kind: 'product' as const, product })),
];

/** "More" list: Blueprint Premium card, then the upsell products. */
export function UpsellList({ navigation }: { navigation: any }) {
  const { activePet } = usePets();
  return (
    <View style={styles.container}>
      <BackgroundCharacters />
      <FlatList
        data={MORE_ROWS}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.header}>
            {activePet ? `Gift ideas for ${activePet.name}` : 'Select a pet to personalise products'}
          </Text>
        }
        renderItem={({ item }) => {
          if (item.kind === 'search') {
            return (
              <TouchableOpacity
                style={[styles.card, styles.premiumCard]}
                onPress={() => navigation.navigate('Search')}
              >
                <Text style={styles.emoji}>🔍</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Search all records</Text>
                  <Text style={styles.cardDesc}>
                    Find anything across all pets — Blueprint Premium
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }
          if (item.kind === 'premium') {
            return (
              <TouchableOpacity
                style={[styles.card, styles.premiumCard]}
                onPress={() => navigation.navigate('Premium')}
              >
                <Text style={styles.emoji}>👑</Text>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>Blueprint Premium</Text>
                  <Text style={styles.cardDesc}>
                    Push reminders · co-parent share · unlimited history · PDF export
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            );
          }
          const product = item.product!;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate(product.name)}
            >
              <Text style={styles.emoji}>{product.emoji}</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{product.title}</Text>
                <Text style={styles.cardDesc}>{product.desc}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <Text style={styles.footerNote}>
            Upsell products are on hold while the owner reviews the app.
          </Text>
        }
      />
    </View>
  );
}

/** The "More" tab: a stack whose first screen lists premium + the upsell products. */
export function UpsellsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="UpsellList" component={UpsellList} options={{ title: 'More' }} />
      <Stack.Screen name="Premium" component={PremiumScreen} options={{ title: 'Blueprint Premium' }} />
      <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
      <Stack.Screen name="PetPlanner" options={{ title: 'Pet Planner' }}>
        {() => <PlaceholderScreen title="Printable Pet Planner" noun="PDF that prints at home — generated on-device, no server" />}
      </Stack.Screen>
      <Stack.Screen name="MemorialBook" options={{ title: 'Memorial Book' }}>
        {() => <PlaceholderScreen title="Memorial Book" noun="keepsake book generated on-device from your records" />}
      </Stack.Screen>
      <Stack.Screen name="Artwork" options={{ title: 'Custom Artwork' }}>
        {() => <PlaceholderScreen title="Custom Pet Artwork" noun="artwork generated on-device from your pet photo" />}
      </Stack.Screen>
      <Stack.Screen name="EmergencyCard" options={{ title: 'Emergency Card' }}>
        {() => <PlaceholderScreen title="Emergency Pet Card" noun="printable emergency info card, generated on-device" />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: AppColors.background },
  list: { padding: 16 },
  header: { fontSize: 15, color: AppColors.textMuted, marginBottom: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  premiumCard: { borderColor: AppColors.accent, borderWidth: 2 },
  emoji: { fontSize: 28, marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  cardDesc: { fontSize: 13, color: AppColors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: AppColors.textMuted },
  footerNote: {
    fontSize: 12,
    color: AppColors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
});
