/**
 * ComingSoon — the friendly placeholder behind the Care Circle and Care
 * Calendar rows on the More screen.
 *
 * It is deliberately an illustrated prompt rather than a dead end: the serif
 * title, the module's mascot in a tinted halo and one honest line about what
 * will land here (see `CCEmptyState`). Nothing is fetched and nothing is
 * stored — this screen only reads the route params it was opened with.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import BackgroundCharacters from '../components/BackgroundCharacters';
import { CCEmptyState } from '../components/CC';
import type { MoreStackParamList } from '../navigation/MoreNavigator';
import { BS, COLOR, SPACE } from '../theme';

type Props = NativeStackScreenProps<MoreStackParamList, 'ComingSoon'>;

export default function ComingSoonScreen({ navigation, route }: Props): React.JSX.Element {
  const { title, emoji, message, accent } = route.params;
  return (
    <View style={BS.screen}>
      <BackgroundCharacters />
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel="Back to More">
          <Text style={BS.link}>‹ More</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>In the next update</Text>
        <Text style={BS.h1}>{title}</Text>
        <CCEmptyState
          emoji={emoji}
          title="This one is on its way"
          message={message}
          accent={accent ?? COLOR.aqua}
          style={{ marginTop: SPACE.s2 }}
          testID={`coming-soon-${title}`}
        />
      </ScrollView>
    </View>
  );
}
