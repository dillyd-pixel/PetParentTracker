/**
 * Printable Pet Planner — the on-device PDF file actions.
 *
 * Everything here is lazy-required: the native modules are loaded INSIDE the
 * handlers, so the web bundle never evaluates them (the same convention the
 * premium pet-file export row uses). Nothing in this file touches a network —
 * the PDF is rendered from the planner's own HTML string, written into the
 * app's temporary folder, and stays there until the owner downloads, prints or
 * shares it.
 *
 * Files deliberately do not accumulate: `generatePlannerPdf` is only called
 * when the owner asks for it, and the caller deletes the previous temporary
 * file before a new one is written (`deleteTempFile`).
 */
import { Platform } from 'react-native';

import { paperSizeDef, type PaperSize } from './sections';

/** A PDF that exists on this device right now. */
export interface GeneratedPlannerPdf {
  /** The local file URI (in the app's temporary/cache folder). */
  uri: string;
  /** Base64 of the same bytes — used by the Downloads save path. */
  base64: string;
  /** Size in bytes. */
  bytes: number;
}

/** Format a byte count for the confirmation line, e.g. "412 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A tidy file name for the planner, e.g. "pet-planner-bella-2026-10-06.pdf" or
 * "pet-planner-household-2026-10-06.pdf". Names are derived from the owner's
 * own pet names — nothing is invented.
 */
export function plannerFileName(petNames: string[], today: Date = new Date()): string {
  const slug = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const who =
    petNames.length === 0
      ? 'pets'
      : petNames.length === 1
        ? slug(petNames[0]) || 'pet'
        : petNames.length <= 3
          ? petNames.map((n) => slug(n) || 'pet').join('-')
          : `${slug(petNames[0]) || 'pet'}-and-${petNames.length - 1}-more`;
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  return `pet-planner-${who}-${stamp}.pdf`;
}

/**
 * Render the planner HTML to a PDF inside the app's temporary folder — entirely
 * on-device, via `expo-print`. The paper size is passed to the native renderer
 * as its page box (72 PPI: Letter 612×792, A4 595×842) and is also carried by
 * the HTML's own `@page` rule, so both native print-to-file and a browser print
 * come out at the chosen size.
 *
 * Native only — callers on the web show the "works on your phone" note instead.
 */
export async function generatePlannerPdf(
  html: string,
  paper: PaperSize,
): Promise<GeneratedPlannerPdf> {
  const size = paperSizeDef(paper);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system');

  const result = await Print.printToFileAsync({
    html,
    width: size.widthPx,
    height: size.heightPx,
    base64: true,
  });
  const uri: string = result.uri;
  const base64: string = result.base64 ?? '';
  let bytes = 0;
  try {
    bytes = new FileSystem.File(uri).size ?? 0;
  } catch {
    bytes = 0;
  }
  return { uri, base64, bytes };
}

/** Delete a temporary planner file (never throws — cleanup must not break a flow). */
export function deleteTempFile(uri: string | null): void {
  if (!uri || Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require('expo-file-system');
    const file = new FileSystem.File(uri);
    if (file.exists) file.delete();
  } catch {
    // The cache is the system's to clear; a failed cleanup is not an error.
  }
}

/**
 * Save a copy where the owner can see it — never a duplicate left inside the app:
 *  - Android: the folder picker (Downloads by default) via the file-system API,
 *    with the legacy Storage Access Framework as a fallback.
 *  - iOS: the app's own documents folder.
 * Returns the saved URI, or null when the owner cancelled the folder picker.
 * Native only.
 */
export async function savePlannerPdf(input: {
  uri: string;
  base64: string;
  fileName: string;
}): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FileSystem = require('expo-file-system');
  const source = new FileSystem.File(input.uri);

  if (Platform.OS === 'android') {
    try {
      const directory = await FileSystem.Directory.pickDirectoryAsync();
      const destination = directory.createFile(input.fileName, 'application/pdf');
      destination.write(source.bytesSync());
      return destination.uri as string;
    } catch {
      // Fall through to the legacy SAF path below (older Android, or a
      // cancelled picker falling back to the classic permission prompt).
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Legacy = require('expo-file-system/legacy');
    const permission = await Legacy.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return null;
    const destinationUri = await Legacy.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      input.fileName.replace(/\.pdf$/i, ''),
      'application/pdf',
    );
    await Legacy.StorageAccessFramework.writeAsStringAsync(destinationUri, input.base64, {
      encoding: Legacy.EncodingType.Base64,
    });
    return destinationUri as string;
  }

  const destination = new FileSystem.File(FileSystem.Paths.document, input.fileName);
  if (destination.exists) destination.delete();
  await source.copy(destination);
  return destination.uri as string;
}

/** Open the native print dialog for the planner HTML. Native only. */
export async function printPlannerPdf(html: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print');
  await Print.printAsync({ html });
}

/** Open the share sheet for a generated planner PDF. Returns false when unavailable. */
export async function sharePlannerPdf(uri: string, title: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
  return true;
}
