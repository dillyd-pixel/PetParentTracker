/**
 * Upsell products tab — four on-device generated products.
 *
 * The "More" tab hosts a small stack:
 *  - UpsellList: the four products as a scrollable list.
 *  - Each product detail is a PlaceholderScreen describing the future
 *    on-device generator (no server — everything generated on the phone).
 *
 * Products: Printable Pet Planner, Memorial Book, Custom Pet Artwork,
 * Emergency Pet Card.
 */
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { createWebSafeStackNavigator } from '../navigation/WebSafeStack';
import PlaceholderScreen from './PlaceholderScreen';
import { AppColors } from '../theme';
import { usePets } from '../context/PetContext';

export type UpsellStackParamList = {
  UpsellList: undefined;
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

/** "More" list of the four upsell products. */
export function UpsellList({ navigation }: { navigation: any }) {
  const { activePet } = usePets();
  return (
    <View style={styles.container}>
      <FlatList
        data={PRODUCTS}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.header}>
            {activePet ? `Gift ideas for ${activePet.name}` : 'Select a pet to personalise products'}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate(item.name)}
          >
            <Text style={styles.emoji}>{item.emoji}</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

/** The "More" tab: a stack whose first screen lists the four upsell products. */
export function UpsellsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="UpsellList" component={UpsellList} options={{ title: 'More' }} />
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
  emoji: { fontSize: 28, marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: AppColors.text },
  cardDesc: { fontSize: 13, color: AppColors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: AppColors.textMuted },
});
