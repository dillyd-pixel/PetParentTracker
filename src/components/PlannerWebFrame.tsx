/**
 * Keepsake documents — the browser preview frame (web only).
 *
 * In the browser a keepsake can be previewed (and printed) as the REAL generated
 * document: the print HTML goes straight into an inline frame, so what the owner
 * sees and prints in the browser is byte-for-byte what `expo-print` renders into
 * a PDF on a phone. The printable pet planner and the memorial book share this
 * one frame (each passes its own title and print-button label) — the frame's
 * content is the document that was generated for it.
 *
 * `autoPrint` opens the browser's own print dialog once the frame has loaded —
 * the web equivalent of the native print dialog, used by the "Print" action.
 *
 * Native builds never render this component (the preview screens pick the native
 * paper renderers instead), so no frame element is ever created on a phone.
 * 100% offline: the frame's content is a local string, `srcDoc`, with no remote
 * origin, no script and no font — nothing is fetched.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BS, COLOR, SHADOW, SPACE } from '../theme';

export function PlannerWebFrame({
  html,
  autoPrint = false,
  title = 'Pet planner preview',
  printLabel = '🖨️ Print this planner',
}: {
  html: string;
  /** Open the browser's print dialog as soon as the document is on screen. */
  autoPrint?: boolean;
  /** The frame's accessible title (the keepsake products pass their own). */
  title?: string;
  /** The label on the frame's own print button. */
  printLabel?: string;
}): React.JSX.Element {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameRef = useRef<any>(null);
  const [autoPrinted, setAutoPrinted] = useState(false);

  /** Print the frame's own document (falls back to the page's own dialog). */
  const printDocument = useCallback(() => {
    const frame = frameRef.current;
    try {
      if (frame?.contentWindow) {
        frame.contentWindow.focus();
        frame.contentWindow.print();
        return;
      }
    } catch {
      // Fall through to the page-level dialog below.
    }
    try {
      window.print();
    } catch {
      // A browser that blocks programmatic printing simply does nothing here.
    }
  }, []);

  useEffect(() => {
    if (!autoPrint || autoPrinted) return;
    setAutoPrinted(true);
    const timer = setTimeout(printDocument, 700);
    return () => clearTimeout(timer);
  }, [autoPrint, autoPrinted, printDocument]);

  return (
    <View style={styles.frameWrap}>
      {React.createElement('iframe', {
        ref: frameRef,
        srcDoc: html,
        title,
        style: {
          border: '0',
          width: '100%',
          height: '100%',
          backgroundColor: COLOR.bg,
        },
      })}
      <View style={styles.printBar}>
        <TouchableOpacity onPress={printDocument} accessibilityLabel={printLabel}>
          <Text style={[BS.btnSecondaryText, styles.printText]}>{printLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frameWrap: { flex: 1, backgroundColor: COLOR.bg, position: 'relative' },
  printBar: {
    position: 'absolute',
    left: SPACE.s3,
    right: SPACE.s3,
    bottom: SPACE.s3,
    backgroundColor: COLOR.surface,
    borderWidth: 1,
    borderColor: COLOR.divider,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    ...SHADOW.pop,
  },
  printText: { color: COLOR.text },
});
