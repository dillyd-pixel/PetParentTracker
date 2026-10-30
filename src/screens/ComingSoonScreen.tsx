/**
 * ComingSoon — the friendly placeholder behind the Care Circle row on the More
 * screen and the Records tab's CARE shells.
 *
 * The page itself lives in `components/ComingSoonView.tsx` so every stack can
 * render the identical thing; these two wrappers only say which stack the page
 * was opened from, so its `‹ back` link reads correctly:
 *
 *  - `ComingSoonScreen` (default) — the More tab's route. Params unchanged
 *    (`title`, `emoji`, `message`, `accent`) and the id is still
 *    `coming-soon-<title>`, so `more-care-circle` behaves exactly as it did
 *    before. (`more-care-calendar` was retired in OS-map chunk 3 — the Care
 *    Calendar row now lives in Records ▸ CARE as `records-care-calendar`.)
 *  - `RecordsComingSoonScreen` — the Records stack's route (Routines, Supplies,
 *    Care calendar). Same params plus an optional `slug`, `‹ Records` back link;
 *    the id defaults to the title, so the pages are `coming-soon-Routines`,
 *    `coming-soon-Supplies` and `coming-soon-Care calendar`.
 *
 * The Pets stack's wrapper (`PetsComingSoonScreen`, the old `coming-soon-vitals`
 * page) was retired when the owner decided Vitals is a real page built on the
 * one weigh-in the app already keeps (2026-10-20) — see `VitalsScreen.tsx`.
 */
import React from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ComingSoonView } from '../components/ComingSoonView';
import type { MoreStackParamList } from '../navigation/MoreNavigator';
import type { RecordsStackParamList } from '../navigation/RecordsNavigator';

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

type RecordsProps = NativeStackScreenProps<RecordsStackParamList, 'ComingSoon'>;

/** The same page, opened from inside the Records stack (Routines / Supplies / Care calendar). */
export function RecordsComingSoonScreen({ navigation, route }: RecordsProps): React.JSX.Element {
  const { title, emoji, message, accent, slug } = route.params;
  return (
    <ComingSoonView
      title={title}
      emoji={emoji}
      message={message}
      accent={accent}
      slug={slug}
      backLabel="Records"
      onBack={() => navigation.goBack()}
    />
  );
}
