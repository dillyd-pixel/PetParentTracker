/**
 * Pet Memorial Book — the browser preview frame (web only).
 *
 * A thin, named wrapper around the keepsake products' shared web frame: in the
 * browser the book is previewed (and printed) as the REAL generated document —
 * the print HTML goes into an inline frame, so what the owner sees and prints in
 * the browser is byte-for-byte what `expo-print` renders into a PDF on a phone.
 *
 * Native builds never render this component (the preview screen picks the native
 * paper renderer instead), so no frame element is ever created on a phone.
 * 100% offline: the frame's content is a local string, with no remote origin, no
 * script and no font — nothing is fetched.
 */
import React from 'react';

import { PlannerWebFrame } from './PlannerWebFrame';

export function MemorialWebFrame({
  html,
  autoPrint = false,
}: {
  html: string;
  /** Open the browser's print dialog as soon as the book is on screen. */
  autoPrint?: boolean;
}): React.JSX.Element {
  return (
    <PlannerWebFrame
      html={html}
      autoPrint={autoPrint}
      title="Memorial book preview"
      printLabel="🖨️ Print this book"
    />
  );
}
