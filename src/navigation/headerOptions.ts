/**
 * Shared native-header options for the Command Center look (design Phase A).
 *
 * The design puts every page title in the page itself (a serif `h1` with a
 * back link), so the four tab roots and every nested stack's interior screens
 * render their own headings and hide the navigator header — one header per
 * screen, never a stacked duplicate. Search is the one exception (its page is
 * the search field, with no in-page title), so it keeps this header: ivory
 * background, no shadow, serif title in Deep Ink, Blueprint Blue accents.
 *
 * 100% offline: colours only, nothing loaded.
 */
import { COLOR, FONT_HEAD } from '../theme';

/** Header options spread into every nested stack's `screenOptions`. */
export const PAPER_HEADER = {
  headerStyle: {
    backgroundColor: COLOR.bg,
  },
  headerShadowVisible: false,
  headerTintColor: COLOR.accent,
  headerTitleStyle: {
    fontFamily: FONT_HEAD,
    fontWeight: '700' as const,
    fontSize: 18,
    color: COLOR.text,
  },
};
