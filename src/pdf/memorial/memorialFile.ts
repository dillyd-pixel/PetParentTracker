/**
 * Pet Memorial Book — the on-device PDF file actions.
 *
 * The same on-device pipeline the printable pet planner ships, under this
 * product's own names: nothing here touches a network, the file is rendered
 * from the book's own HTML string by `expo-print`, written into the app's
 * TEMPORARY folder, and stays there until the owner downloads, prints or shares
 * it. `deleteTempFile` and `formatBytes` are reused straight from the planner's
 * file module — one cleanup routine and one byte formatter for every keepsake,
 * so the two products can never disagree about either.
 *
 * Every native module is lazy-required INSIDE its handler, so the web bundle
 * never evaluates expo-print / expo-file-system / expo-sharing (the convention
 * the whole repo follows). Files deliberately do not accumulate:
 * `generateMemorialPdf` runs only when the owner asks for it, and the caller
 * deletes the previous temporary file before a new one is written.
 */
import { Platform } from 'react-native';

import { paperSizeDef, type PaperSize } from '../planner/sections';
import { deleteTempFile, formatBytes } from '../planner/plannerFile';

export { deleteTempFile, formatBytes };

/** A PDF of the memorial book that exists on this device right now. */
export interface GeneratedMemorialPdf {
  /** The local file URI (in the app's temporary/cache folder). */
  uri: string;
  /** Base64 of the same bytes — used by the Downloads save path. */
  base64: string;
  /** Size in bytes. */
  bytes: number;
}

/**
 * A tidy file name for the book, e.g.
 * "memorial-book-bella-2026-10-07.pdf". The name comes from the owner's own
 * pet name — nothing is invented, and the pet's name is slugged for a file.
 */
export function memorialFileName(petName: string, today: Date = new Date()): string {
  const slug =
    petName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'pet';
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  return `memorial-book-${slug}-${stamp}.pdf`;
}

/**
 * Render the book's HTML to a PDF inside the app's temporary folder — entirely
 * on-device, via `expo-print`. The paper size is passed to the native renderer
 * as its page box (72 PPI: Letter 612×792, A4 595×842) and is also carried by
 * the HTML's own `@page` rule, so native print-to-file and a browser print both
 * come out at the chosen size.
 *
 * Native only — the web shows the "works on your phone" note instead.
 */
export async function generateMemorialPdf(
  html: string,
  paper: PaperSize,
): Promise<GeneratedMemorialPdf> {
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

/**
 * Save a copy where the owner can keep it — never a duplicate left inside the
 * app:
 *  - Android: the folder picker (Downloads by default) via the file-system API,
 *    with the legacy Storage Access Framework as a fallback.
 *  - iOS: the app's own documents folder.
 * Returns the saved URI, or null when the owner cancelled the folder picker.
 * Native only.
 */
export async function saveMemorialPdf(input: {
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

/** Open the native print dialog for the book's HTML. Native only. */
export async function printMemorialPdf(html: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Print = require('expo-print');
  await Print.printAsync({ html });
}

/** Open the share sheet for a generated book PDF. Returns false when unavailable. */
export async function shareMemorialPdf(uri: string, title: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Sharing = require('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (!available) return false;
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: title });
  return true;
}
