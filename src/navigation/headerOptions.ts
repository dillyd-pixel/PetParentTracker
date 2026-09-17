/**
 * Shared native-header options for the paper-coloured Broadsheet look.
 *
 * The design puts every page title in the page itself (an `h1` with a back
 * link), so the five tab roots, the pet/module stack, the Records stack and the
 * Shop stack's interior screens all render their own headings and hide the
 * navigator header — one header per screen, never a stacked duplicate. Search
 * is the one exception (its page is the search field, with no in-page title),
 * so it keeps this header: paper background, no shadow, serif title, deep-teal
 * tint.
 */
import { COLOR, FONT_HEAD } from '../theme';

/** Header options spread into every nested stack's `screenOptions`. */
export const PAPER_HEADER = {
  headerStyle: {
    backgroundColor: COLOR.bg,
  },
  headerShadowVisible: false,
  headerTintColor: COLOR.accent700,
  headerTitleStyle: {
    fontFamily: FONT_HEAD,
    fontWeight: '700' as const,
    fontSize: 18,
    color: COLOR.text,
  },
};
