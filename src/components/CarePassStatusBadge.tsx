/**
 * The status pill on every care pass row and on the pass detail.
 *
 * One badge, three looks, all drawn from the Broadsheet tags so the colours
 * stay in the design system rather than in a screen:
 *  - Active  — teal fill (the pass is usable today).
 *  - Expired — magenta tint (its end date has passed).
 *  - Closed  — muted paper (the owner ended it early).
 *
 * Purely presentational: the caller derives the status with
 * `carePassStatus()` and passes the wording in.
 */
import React from 'react';
import { Text, View } from 'react-native';
import type { TextStyle, ViewStyle } from 'react-native';

import { BS } from '../theme';
import type { CarePassStatus } from '../types';

/** Tag styles per status — fill + the matching text style. */
const BADGE: Record<CarePassStatus, { fill: ViewStyle; text: TextStyle }> = {
  active: { fill: BS.tagActive, text: BS.tagTextActive },
  expired: { fill: BS.tagAccent2, text: BS.tagTextAccent2 },
  closed: { fill: BS.tagNeutral, text: BS.tagTextNeutral },
};

export default function CarePassStatusBadge({
  status,
  label,
}: {
  status: CarePassStatus;
  /** Wording to show, e.g. `carePassStatusLabel(status)` ("Active"). */
  label: string;
}): React.JSX.Element {
  const badge = BADGE[status];
  return (
    <View style={[BS.tag, badge.fill]}>
      <Text style={[BS.tagText, badge.text]}>{label}</Text>
    </View>
  );
}
