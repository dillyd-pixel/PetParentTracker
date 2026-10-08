/**
 * Custom Pet Artwork — getting the pet's own photo onto the printed sheet.
 *
 * A photo picked in the app lives in the device's own storage and is referenced
 * by a local URI. That is exactly what the on-screen canvas wants (an `Image`
 * loads it directly), but the PRINT document is a single self-contained HTML
 * string, so it needs the picture itself, inline. This module reads the local
 * file and turns it into a `data:` URI — on the device, with the file-system API
 * the app already ships (no new dependency), and only when a sheet is actually
 * being made.
 *
 * In a browser there is nothing to read: the picker already hands back a
 * `data:`/`blob:` URI the frame can load, so it is passed straight through.
 *
 * Whitelist, not a transformation: the bytes are the owner's own photo,
 * unmodified — the "artistic" part of this product is the frame drawn around it.
 *
 * 100% offline: the file is read from the device's own storage and inlined into
 * a local string. Nothing is fetched and nothing is uploaded.
 */
import { Platform } from 'react-native';

/** The image types the picker can hand back, by file extension. */
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpg_: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * The photo's MIME type, from the URI's file extension (query strings and
 * fragments ignored). Defaults to JPEG — what a camera photo almost always is —
 * for a URI with no usable extension.
 */
export function photoMimeType(uri: string): string {
  const withoutQuery = uri.split(/[?#]/)[0];
  const match = /\.([a-zA-Z0-9]+)$/.exec(withoutQuery);
  const extension = match ? match[1].toLowerCase() : '';
  return MIME_BY_EXTENSION[extension] ?? 'image/jpeg';
}

/** A URI the sheet can hold as it stands — already inline, nothing to read. */
export function isInlinePhoto(uri: string): boolean {
  return /^data:/i.test(uri);
}

/**
 * The photo as something the print document can carry:
 *  - `data:` URIs are handed straight back;
 *  - in a browser the picked URI is returned unchanged (the frame loads it);
 *  - on a device the local file is read and inlined as a `data:` URI.
 *
 * Returns null when there is no photo, or when the file cannot be read — the
 * sheet then prints the honest "a photo goes here" note instead of breaking.
 */
export async function toPrintPhoto(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  if (isInlinePhoto(uri)) return uri;
  if (Platform.OS === 'web') return uri;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require('expo-file-system');
    const file = new FileSystem.File(uri);
    const base64: string = await file.base64();
    if (!base64) return null;
    return `data:${photoMimeType(uri)};base64,${base64}`;
  } catch {
    // A photo that has since been deleted, or a URI we cannot read: no photo on
    // the sheet, with the honest note, rather than a broken page.
    return null;
  }
}
