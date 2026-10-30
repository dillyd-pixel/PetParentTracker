/**
 * ComingSoonView — the app's one honest placeholder page.
 *
 * A destination that does not exist yet is never a dead button: it opens this
 * page, which is an illustrated `CCEmptyState` (the module's mascot in a tinted
 * halo), one honest sentence about what will land there, and a real back link
 * so it is a page and not a wall. Nothing is fetched and nothing is stored —
 * the component only renders the params it was opened with.
 *
 * It is shared, not copied: every stack that needs a placeholder registers its
 * own `ComingSoon` route and renders this view with its own `backLabel`, so the
 * More tab's Care Circle page and the Records tab's CARE shells cannot drift
 * into two different designs (OS content map §3d — "the rule, so five chunks
 * can't invent five different ones"). The Pets stack's placeholder (Vitals) has
 * since become a real page — `screens/VitalsScreen.tsx`.
 *
 * Props are the page's whole contract:
 *  - `title` / `emoji` / `message` / `accent` — what the page says;
 *  - `slug` — the stable id behind `coming-soon-<slug>` (defaults to `title`,
 *    which is what the two More rows have always rendered);
 *  - `backLabel` / `onBack` — the `‹ <label>` link at the top, pointing at the
 *    stack the page was opened from.
 */
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { CCEmptyState } from './CC';
import { BS, COLOR, SPACE } from '../theme';

export interface ComingSoonViewProps {
  title: string;
  emoji: string;
  /** One honest sentence: what will land here. Never a promise of a date. */
  message: string;
  accent?: string;
  /** Stable id for `coming-soon-<slug>`; defaults to the title. */
  slug?: string;
  /** What the back link returns to — "More" renders `‹ More`. */
  backLabel: string;
  onBack: () => void;
}

export function ComingSoonView({
  title,
  emoji,
  message,
  accent,
  slug,
  backLabel,
  onBack,
}: ComingSoonViewProps): React.JSX.Element {
  return (
    <View style={BS.screen}>
      <ScrollView contentContainerStyle={BS.pad}>
        <TouchableOpacity onPress={onBack} accessibilityLabel={`Back to ${backLabel}`}>
          <Text style={BS.link}>‹ {backLabel}</Text>
        </TouchableOpacity>
        <Text style={[BS.eyebrow, { marginTop: SPACE.s3 }]}>In the next update</Text>
        <Text style={BS.h1}>{title}</Text>
        <CCEmptyState
          emoji={emoji}
          title="This one is on its way"
          message={message}
          accent={accent ?? COLOR.aqua}
          style={{ marginTop: SPACE.s2 }}
          testID={`coming-soon-${slug ?? title}`}
        />
      </ScrollView>
    </View>
  );
}
