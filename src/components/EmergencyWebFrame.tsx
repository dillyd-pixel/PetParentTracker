/**
 * Emergency Pet Card pack — the browser preview frame (web only).
 *
 * A thin, named wrapper around the keepsake products' shared web frame: in the
 * browser the pack is previewed (and printed) as the REAL generated sheets — the
 * print HTML goes into an inline frame, so what the owner sees and prints in the
 * browser is byte-for-byte what `expo-print` renders into a PDF on a phone.
 *
 * Two places use it: the full-screen preview (with the frame's own print button)
 * and the live preview card on the card screen itself (`showPrintBar={false}` —
 * there, printing is the deliberate, premium-gated action further down).
 *
 * Native builds never render this component (the screens draw the cards with
 * `EmergencyCardFace` instead), so no frame element is ever created on a phone.
 * 100% offline: the frame's content is a local string, with no remote origin, no
 * script and no font — nothing is fetched.
 */
import React from 'react';

import { PlannerWebFrame } from './PlannerWebFrame';

export function EmergencyWebFrame({
  html,
  autoPrint = false,
  showPrintBar = true,
}: {
  html: string;
  /** Open the browser's print dialog as soon as the sheets are on screen. */
  autoPrint?: boolean;
  /** Hide the frame's own print button (the live preview on the card screen). */
  showPrintBar?: boolean;
}): React.JSX.Element {
  return (
    <PlannerWebFrame
      html={html}
      autoPrint={autoPrint}
      title="Emergency pet cards preview"
      printLabel="🖨️ Print these cards"
      showPrintBar={showPrintBar}
    />
  );
}
