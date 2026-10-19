/**
 * ComingSoon — the friendly placeholder behind the Care Circle and Care
 * Calendar rows on the More screen, and the same page reused by the Pets tab
 * (Vitals) and the Records tab's CARE shells.
 *
 * The page itself lives in `components/ComingSoonView.tsx` so every stack can
 * render the identical thing; these two wrappers only say which stack the page
 * was opened from, so its `‹ back` link reads correctly:
 *
 *  - `ComingSoonScreen` (default) — the More tab's route. Params unchanged
 *    (`title`, `emoji`, `message`, `accent`) and the id is still
 *    `coming-soon-<title>`, so `more-care-circle` / `more-care-calendar` behave
 *    exactly as they did before.
 *  - `PetsComingSoonScreen` — the Pets stack's route (Vitals). Same params plus
 *    an optional `slug`, so the page can be `coming-soon-vitals` while its
 *    heading stays "Vitals".
 */
import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ComingSoonView } from '../components/ComingSoonView';
import type { MoreStackParamList } from '../navigation/MoreNavigator';
import type { PetsStackParamList } from '../navigation/PetsNavigator';

type Props = NativeStackScreenProps<MoreStackParamList, 'ComingSoon'>;

export default function ComingSoonScreen({ navigation, route }: Props): React.JSX.Element {
  const { title, emoji, message, accent } = route.params;
  return (
    <ComingSoonView
      title={title}
      emoji={emoji}
      message={message}
      accent={accent}
      backLabel="More"
      onBack={() => navigation.goBack()}
    />
  );
}

type PetsProps = NativeStackScreenProps<PetsStackParamList, 'ComingSoon'>;

/** The same page, opened from inside the Pets stack (currently: Vitals). */
export function PetsComingSoonScreen({ navigation, route }: PetsProps): React.JSX.Element {
  const { title, emoji, message, accent, slug } = route.params;
  return (
    <ComingSoonView
      title={title}
      emoji={emoji}
      message={message}
      accent={accent}
      slug={slug}
      backLabel="Back"
      onBack={() => navigation.goBack()}
    />
  );
}
