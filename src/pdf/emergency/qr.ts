/**
 * Emergency Pet Card pack — the offline QR.
 *
 * The card carries one QR code whose payload is a SHORT PLAIN-TEXT summary of
 * the pet: name, species, age, weight, microchip, allergies, medication, the
 * vet's number and the owner's. Nothing else is encoded:
 *
 *  - **No URL, no link, no server.** A phone camera shows the text itself; no
 *    app, no account and no internet connection is involved in reading it, and
 *    there is nothing to fetch or look up. That is the whole point: a stranger
 *    who finds the pet can read the card even with no signal.
 *  - **ASCII only.** Accents are folded to their plain letters and every
 *    non-ASCII character (emoji, middle dots, curly quotes) is dropped, because
 *    scanners and camera apps handle a plain ASCII payload most reliably.
 *  - **Bounded.** Segments are added in priority order and the payload stops at
 *    `QR_MAX_CHARS`, so the code stays a scannable size on a 54 mm card.
 *
 * The encoder is `toqr` (0.1.1) — already in the tree as a transitive
 * dependency of Expo's own tooling, pure JavaScript, no network and no native
 * code. `toQR()` returns a size × size matrix of 0/1 modules (1 = dark) with NO
 * quiet zone, so the renderers add one; `qrRuns()` turns the matrix into
 * horizontal runs, which keeps the printed markup (and the on-device preview)
 * small and deterministic.
 *
 * If the encoder ever fails, `emergencyQr()` returns null and the renderers
 * leave the space empty — a card is never printed with a fake or unscannable
 * code in it.
 *
 * 100% offline: pure string/array maths plus a local encoder. No fetch, no URL.
 */
import { toQR } from 'toqr';

/** The payload never exceeds this many characters (a comfortable QR size). */
export const QR_MAX_CHARS = 300;
/** The quiet zone around the code, in modules (the QR standard asks for 4). */
export const QR_QUIET_ZONE = 4;

/** Every field the payload can carry, already resolved from the pet's records. */
export interface EmergencyQrInput {
  /** The pet's name, as the owner typed it. */
  petName: string;
  /** Species label ("Dog", "Cat", or the owner's own word for an 'Other' pet). */
  species: string;
  /** Breed, or '' when none is on file. */
  breed: string;
  /** Age phrase ("9 yr"), or ''. */
  age: string;
  /** Weight with its unit ("12 kg"), or ''. */
  weight: string;
  /** Microchip number, or '' when the owner has not typed one. */
  microchip: string;
  /** Allergies / conditions in the owner's own words, or ''. */
  allergies: string;
  /** Medication summary ("Apoquel daily"), or ''. */
  meds: string;
  /** The vet on file, or ''. */
  vetName: string;
  /** The vet's phone number, or ''. */
  vetPhone: string;
  /** The owner's name from Settings. */
  ownerName: string;
  /** The owner's phone number, or ''. */
  ownerPhone: string;
  /** The co-parent's name, or ''. */
  coParentName: string;
  /** The co-parent's phone number, or ''. */
  coParentPhone: string;
  /** One short behaviour line ("shy with strangers"), or ''. */
  note: string;
}

/**
 * Fold a value down to printable ASCII: accents lose their accent marks, and
 * anything still outside the printable ASCII range (emoji, dashes, symbols) is
 * dropped. Whitespace is collapsed and the result is capped.
 */
export function asciiOnly(value: string, max = 120): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

/**
 * Build the payload: the pet first (a stranger needs to know who they found),
 * then identification, then what to do. Segments that add nothing are skipped,
 * and the payload stops before it would pass `QR_MAX_CHARS` — so the same data
 * always produces the same string.
 */
export function emergencyQrPayload(input: EmergencyQrInput): string {
  const name = asciiOnly(input.petName, 40).toUpperCase();
  const species = asciiOnly(input.species, 20);
  const who = [name || 'PET', species].filter(Boolean).join(' ');

  const segments: string[] = [];
  const breed = asciiOnly(input.breed, 28);
  if (breed) segments.push(breed);
  const age = asciiOnly(input.age, 16);
  if (age) segments.push(age);
  const weight = asciiOnly(input.weight, 16);
  if (weight) segments.push(weight);
  const microchip = asciiOnly(input.microchip, 24);
  if (microchip) segments.push(`chipped ${microchip}`);
  const allergies = asciiOnly(input.allergies, 60);
  if (allergies) segments.push(`ALLERGIC ${allergies}`);
  const meds = asciiOnly(input.meds, 60);
  if (meds) segments.push(`meds ${meds}`);
  const vet = [asciiOnly(input.vetName, 30), asciiOnly(input.vetPhone, 20)]
    .filter(Boolean)
    .join(' ');
  if (vet) segments.push(`vet ${vet}`);
  const owner = [asciiOnly(input.ownerName, 24), asciiOnly(input.ownerPhone, 20)]
    .filter(Boolean)
    .join(' ');
  if (owner) segments.push(`owner ${owner}`);
  const coParent = [asciiOnly(input.coParentName, 24), asciiOnly(input.coParentPhone, 20)]
    .filter(Boolean)
    .join(' ');
  if (coParent) segments.push(`co-parent ${coParent}`);
  const note = asciiOnly(input.note, 60);
  if (note) segments.push(`note ${note}`);

  const parts: string[] = [who];
  let length = who.length;
  for (const segment of segments) {
    if (length + 3 + segment.length > QR_MAX_CHARS) break;
    parts.push(segment);
    length += 3 + segment.length;
  }
  const payload = asciiOnly(parts.join(' | '), QR_MAX_CHARS);
  // Strip emoji/non-ASCII and collapse " | " runs left by an emptied field.
  return payload.replace(/\s*\|\s*(?=\|)/g, '').trim();
}

/** One row of dark modules: `y` (row) and the runs of dark modules in it. */
export interface QrRun {
  /** Row index within the matrix (0 = top). */
  y: number;
  /** First dark module in the run. */
  x: number;
  /** How many modules the run covers. */
  width: number;
}

/** A rendered QR code: its module count, the raw matrix and its dark runs. */
export interface EmergencyQr {
  /** Modules per side (21 for version 1, up to 177 for version 40). */
  size: number;
  /** Row-major matrix, 1 = dark module, 0 = light. */
  modules: number[];
  /** The dark modules as horizontal runs — what both renderers draw. */
  runs: QrRun[];
  /** How many modules are dark (used to prove the matrix is real output). */
  darkCount: number;
}

/** Whether a module at (x, y) is dark. */
export function qrModule(qr: EmergencyQr, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= qr.size || y >= qr.size) return false;
  return qr.modules[y * qr.size + x] === 1;
}

/**
 * Encode the payload into a matrix. Returns null when the text is empty or the
 * encoder cannot handle it — the card then ships without a QR rather than with
 * a broken one.
 */
export function emergencyQr(payload: string): EmergencyQr | null {
  const text = asciiOnly(payload, QR_MAX_CHARS);
  if (text.length === 0) return null;
  let raw: Uint8Array;
  try {
    raw = toQR(text);
  } catch {
    return null;
  }
  const size = Math.sqrt(raw.length);
  if (!Number.isInteger(size) || size < 21) return null;
  const modules = Array.from(raw, (value) => (value ? 1 : 0));
  const runs: QrRun[] = [];
  let darkCount = 0;
  for (let y = 0; y < size; y += 1) {
    let x = 0;
    while (x < size) {
      if (modules[y * size + x] === 1) {
        let width = 0;
        while (x + width < size && modules[y * size + x + width] === 1) width += 1;
        runs.push({ y, x, width });
        darkCount += width;
        x += width;
      } else {
        x += 1;
      }
    }
  }
  if (darkCount === 0) return null;
  return { size, modules, runs, darkCount };
}
