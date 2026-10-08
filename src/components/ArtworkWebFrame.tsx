/**
 * Custom Pet Artwork — the browser preview frame (web only).
 *
 * A thin, named wrapper around the keepsake products' shared web frame: in the
 * browser the artwork is previewed (and printed) as the REAL generated sheet —
 * the print HTML goes into an inline frame, so what the owner sees and prints in
 * the browser is byte-for-byte what `expo-print` renders into a PDF on a phone.
 *
 * Two places use it: the full-screen preview (with the frame's own print button)
 * and the live preview card on the artwork screen itself (`showPrintBar={false}`
 * — there, printing is the deliberate, premium-gated action in the card below).
 *
 * Native builds never render this component (the artwork screen and the preview
 * screen draw the piece with `ArtworkCanvas` instead), so no frame element is
 * ever created on a phone. 100% offline: the frame's content is a local string,
 * with no remote origin, no script and no font — nothing is fetched.
 */
import React from 'react';

import { PlannerWebFrame } from './PlannerWebFrame';

export function ArtworkWebFrame({
  html,
  autoPrint = false,
  showPrintBar = true,
}: {
  html: string;
  /** Open the browser's print dialog as soon as the sheet is on screen. */
  autoPrint?: boolean;
  /** Hide the frame's own print button (the live preview on the artwork screen). */
  showPrintBar?: boolean;
}): React.JSX.Element {
  return (
    <PlannerWebFrame
      html={html}
      autoPrint={autoPrint}
      title="Custom pet artwork preview"
      printLabel="🖨️ Print this artwork"
      showPrintBar={showPrintBar}
    />
  );
}
