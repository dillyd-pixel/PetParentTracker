/**
 * Shared native-header options for the paper-coloured Broadsheet look.
 *
 * The design puts every page title in the page itself (an `h1` with a back
 * link), so the five tab roots hide the navigator header and render their own
 * headings. The nested stacks — whose module screens still carry their
 * title/back in the header — keep one, restyled: paper background, no shadow,
 * serif title, deep-teal tint.
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
