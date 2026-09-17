/**
 * Placeholder screen shared by the four upsell (keepsake) screens on hold.
 * It shows the module's title, which pet it applies to (the active pet), and a
 * "coming soon" note. When a real module is built, replace this screen with the
 * module's own screen file.
 *
 * Like every other screen in the app it draws the design's own header — a
 * `‹ Shop` back link (these screens all sit in the Shop stack) plus the serif
 * title — so the navigator header stays hidden and no title is shown twice.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { usePets } from '../context/PetContext';
import { AppColors, BS, SPACE } from '../theme';
import BackgroundCharacters from '../components/BackgroundCharacters';
import type { ShopStackParamList } from '../navigation/ShopNavigator';

interface Props {
  /** e.g. "Printable Pet Planner", "Memorial Book"… */
  title: string;
  /** e.g. a vaccine record, feeding schedule… */
  noun?: string;
}

export default function PlaceholderScreen({ title, noun = 'records' }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const { activePet } = usePets();
  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={BS.link}>‹ Shop</Text>
        </TouchableOpacity>
        <Text style={[BS.h1, { marginTop: SPACE.s3 }]}>{title}</Text>
        <Text style={BS.kicker}>Keepsake · on hold</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.emoji}>🚧</Text>
        {activePet ? (
          <Text style={styles.text}>
            Applying to active pet: <Text style={styles.bold}>{activePet.name}</Text>
          </Text>
        ) : (
          <Text style={styles.text}>Select a pet on the Pets tab to enable this area.</Text>
        )}
        <Text style={styles.muted}>
          {title} {noun} will appear here in a future update.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: 16, paddingHorizontal: 24 },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji: { fontSize: 44, marginBottom: 8 },
  text: { fontSize: 15, color: AppColors.text, textAlign: 'center', marginBottom: 4 },
  bold: { fontWeight: '700' },
  muted: { fontSize: 13, color: AppColors.textMuted, textAlign: 'center', marginTop: 8 },
});
