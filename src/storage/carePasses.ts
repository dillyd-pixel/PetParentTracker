/**
 * Care Pass on-device storage — Sitter Mode's data layer (Stage 1).
 *
 * Mirrors the app's existing storage patterns (`pets.ts` for the collection
 * repository, `share.ts` for the portable invite document):
 *  - `carePassStore` / `carePassRepository` — CRUD over the `carePasses`
 *    collection in AsyncStorage, plus the Sitter-Mode-specific operations
 *    (`create` mints a collision-checked invite code, `close` ends a pass,
 *    `findByInviteCode` looks one up by its hand-typed code).
 *  - The invite: `buildCarePassInviteFile` / `serializeCarePassInvite` write a
 *    small JSON document holding the pass fields plus the pets it covers;
 *    `parseCarePassInvite` validates it and `importCarePassInvite` stores it on
 *    the sitter's device. Writing the file and opening the system share sheet
 *    happen in the screen (lazy native requires), exactly like the co-parent
 *    share, so the web bundle never evaluates a native module.
 *
 * 100% offline: JSON in memory + AsyncStorage only. No fetch, no URLs, no
 * accounts — the "invite" is a file or a short code the owner hands over.
 */
import { CollectionStore, newId } from './storage';
import {
  CARE_PASS_FILE_KIND,
  CARE_PASS_FILE_VERSION,
  CARE_PASS_SECTIONS,
  carePassStatus,
  isCarePassSection,
  isValidISODate,
} from '../types';
import type {
  CarePass,
  CarePassInput,
  CarePassInviteFile,
  CarePassPermissionLevel,
  CarePassPetSnapshot,
  CarePassSection,
} from '../types';
import type { Pet } from '../types';

/** Persisted collection of care passes. */
export const carePassStore = new CollectionStore<CarePass>('carePasses');

// --- Invite codes ----------------------------------------------------------

/** Length of a generated invite code. */
export const INVITE_CODE_LENGTH = 6;

/** Characters an invite code is built from (A–Z and 0–9). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Tidy a hand-typed code: uppercase, and drop anything that is not A–Z/0–9
 * (spaces, dashes and stray punctuation from a text message). "ab-12 3c"
 * becomes "AB123C", which is what a sitter would have to type to match.
 */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((char) => INVITE_CODE_ALPHABET.includes(char))
    .join('');
}

/** Whether a code looks like a whole invite code (already normalised). */
export function isValidInviteCode(code: string): boolean {
  return normalizeInviteCode(code).length === INVITE_CODE_LENGTH;
}

/**
 * Mint a fresh invite code that collides with none of `existingCodes`.
 *
 * Codes are generated with `Math.random` on the device — never fetched — and
 * checked against every code already stored, so two passes on one device can
 * never share a code. A 36^6 space makes a collision vanishingly unlikely;
 * the loop is bounded anyway so a broken random source can't hang a save.
 */
export function generateInviteCode(existingCodes: readonly string[] = []): string {
  const taken = new Set(existingCodes.map((code) => normalizeInviteCode(code)));
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
      const index = Math.floor(Math.random() * INVITE_CODE_ALPHABET.length);
      // A missing character (impossible in practice) would shorten the code;
      // fall back to the first character so the length is always exact.
      code += INVITE_CODE_ALPHABET[index] ?? INVITE_CODE_ALPHABET[0];
    }
    if (!taken.has(code)) return code;
  }
  // Astronomically unlikely: fall back to a time-based code rather than fail.
  return normalizeInviteCode(`${Date.now().toString(36)}`)
    .padEnd(INVITE_CODE_LENGTH, '0')
    .slice(0, INVITE_CODE_LENGTH);
}

// --- Repository ------------------------------------------------------------

/** Newest first, so the home list shows the most recent pass at the top. */
function byNewest(a: CarePass, b: CarePass): number {
  return b.createdAt.localeCompare(a.createdAt);
}

/** All CRUD + Care Pass operations for the `carePasses` collection. */
export const carePassRepository = {
  /** Every pass on this device, newest first. */
  async list(): Promise<CarePass[]> {
    const passes = await carePassStore.getAll();
    return passes.sort(byNewest);
  },

  get(id: string): Promise<CarePass | null> {
    return carePassStore.findById(id);
  },

  /** Find a pass by its invite code (case- and punctuation-insensitive). */
  async findByInviteCode(code: string): Promise<CarePass | null> {
    const wanted = normalizeInviteCode(code);
    if (!wanted) return null;
    const passes = await carePassStore.getAll();
    return (
      passes.find((pass) => normalizeInviteCode(pass.inviteCode) === wanted) ?? null
    );
  },

  /**
   * Persist a new pass, minting its invite code and setting its status from
   * the end date (a pass created with an end date in the past is 'expired').
   */
  async create(input: CarePassInput): Promise<CarePass> {
    const existing = await carePassStore.getAll();
    const inviteCode = generateInviteCode(existing.map((pass) => pass.inviteCode));
    const draft: CarePass = {
      id: newId(),
      createdAt: new Date().toISOString(),
      creatorName: input.creatorName.trim(),
      caregiverName: input.caregiverName.trim(),
      selectedPetIds: [...input.selectedPetIds],
      startDate: input.startDate,
      endDate: input.endDate,
      permissionLevel: input.permissionLevel,
      visibleSections: [...input.visibleSections],
      inviteCode,
      status: 'active',
      source: 'created',
    };
    // Both, as designed: the owner-set status above and the derived one here.
    const pass: CarePass = { ...draft, status: carePassStatus(draft) };
    return carePassStore.create(pass);
  },

  /** Update selected fields; the derived status is refreshed on the way out. */
  async update(
    id: string,
    changes: Partial<Omit<CarePass, 'id' | 'createdAt'>>,
  ): Promise<CarePass | null> {
    const current = await carePassStore.findById(id);
    if (!current) return null;
    const next: CarePass = { ...current, ...changes };
    const updated = await carePassStore.update(id, {
      ...changes,
      status: next.status === 'closed' ? 'closed' : carePassStatus(next),
    });
    return updated;
  },

  /**
   * End a pass early (the owner's "Close pass"). The stored status stays
   * 'closed' forever — a closed pass never reads as merely expired.
   */
  async close(id: string): Promise<CarePass | null> {
    return carePassRepository.update(id, { status: 'closed' });
  },

  remove(id: string): Promise<boolean> {
    return carePassStore.remove(id);
  },
};

// --- Invite file: export ---------------------------------------------------

/** The slice of one pet that travels in an invite (id, name, species, photo). */
export function petSnapshotFor(pet: Pet): CarePassPetSnapshot {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    customSpecies: pet.customSpecies?.trim() || undefined,
    // A local file path: it only resolves on the device that exported it, so
    // the sitter's copy shows the species glyph when the photo isn't there.
    photoUri: pet.photoUri,
  };
}

/** The snapshots of the pets a pass covers, in the pass's own selection order. */
export function petsForCarePass(
  pass: Pick<CarePass, 'selectedPetIds'>,
  pets: readonly Pet[],
): CarePassPetSnapshot[] {
  const byId = new Map(pets.map((pet) => [pet.id, pet]));
  const snapshots: CarePassPetSnapshot[] = [];
  for (const petId of pass.selectedPetIds) {
    const pet = byId.get(petId);
    if (pet) snapshots.push(petSnapshotFor(pet));
  }
  return snapshots;
}

/**
 * The pets to render for a pass: the live pets on this device when the ids
 * resolve (the owner's own copy), otherwise the snapshots that arrived with an
 * imported pass. Ids that resolve to neither are dropped — the pet is gone
 * here and was not in the invite.
 */
export function resolveCarePassPets(
  pass: Pick<CarePass, 'selectedPetIds' | 'petSnapshots'>,
  pets: readonly Pet[],
): CarePassPetSnapshot[] {
  const live = petsForCarePass(pass, pets);
  const fromLive = new Set(live.map((pet) => pet.id));
  const snapshots = pass.petSnapshots ?? [];
  const missing = snapshots.filter((pet) => !fromLive.has(pet.id));
  return live.length > 0 ? [...live, ...missing] : [...snapshots];
}

/** Build the portable invite document for a pass (pure — no I/O). */
export function buildCarePassInviteFile(
  pass: CarePass,
  pets: readonly CarePassPetSnapshot[],
): CarePassInviteFile {
  return {
    kind: CARE_PASS_FILE_KIND,
    fileVersion: CARE_PASS_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    pass,
    pets: [...pets],
  };
}

/**
 * Serialize a pass's invite to the share-file JSON string. The pets come from
 * `resolveCarePassPets`, so the owner's live pets travel — and a pass that was
 * itself received can be handed on again with the pets it still shows.
 */
export function serializeCarePassInvite(
  pass: CarePass,
  pets: readonly Pet[],
): string {
  return JSON.stringify(buildCarePassInviteFile(pass, resolveCarePassPets(pass, pets)));
}

/** Suggested local filename for an exported invite (safe characters only). */
export function carePassFileName(pass: Pick<CarePass, 'caregiverName' | 'inviteCode'>): string {
  const safe = pass.caregiverName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const code = normalizeInviteCode(pass.inviteCode).toLowerCase() || 'pass';
  return `care-pass-${safe || 'sitter'}-${code}.json`;
}

// --- Invite file: validation (import path) --------------------------------

/** Why a candidate document is not an importable care-pass invite. */
export type CarePassFileProblem =
  | 'not-json'
  | 'not-a-care-pass'
  | 'unsupported-version'
  | 'missing-pass'
  | 'no-pets';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const PERMISSION_LEVELS: readonly CarePassPermissionLevel[] = [
  'view-only',
  'update-tasks',
];
const SPECIES_VALUES: readonly string[] = ['Dog', 'Cat', 'Other'];

/** Keep only canonical section ids, in canonical order (unknown ones drop). */
export function cleanSections(value: unknown): CarePassSection[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isCarePassSection)) return null;
  const chosen = new Set(value as CarePassSection[]);
  return CARE_PASS_SECTIONS.filter((section) => chosen.has(section));
}

function cleanPetSnapshot(value: unknown): CarePassPetSnapshot | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (value.name.trim() === '') return null;
  if (typeof value.species !== 'string' || !SPECIES_VALUES.includes(value.species)) {
    return null;
  }
  // Only an 'Other' pet may carry a species name, and blank folds away.
  const custom =
    value.species === 'Other' && typeof value.customSpecies === 'string'
      ? value.customSpecies.trim() || undefined
      : undefined;
  return {
    id: value.id,
    name: value.name.trim(),
    species: value.species as CarePassPetSnapshot['species'],
    customSpecies: custom,
    photoUri: typeof value.photoUri === 'string' ? value.photoUri : undefined,
  };
}

/**
 * Parse + validate a candidate invite JSON string. Returns the validated
 * document or the reason it cannot be opened. Unknown extra fields are
 * ignored; a malformed pass or pet list rejects the whole file rather than
 * opening half a pass.
 */
export function parseCarePassInvite(
  raw: string,
): { ok: true; file: CarePassInviteFile } | { ok: false; problem: CarePassFileProblem } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, problem: 'not-json' };
  }
  if (!isObject(parsed) || parsed.kind !== CARE_PASS_FILE_KIND) {
    return { ok: false, problem: 'not-a-care-pass' };
  }
  const fileVersion = parsed.fileVersion;
  if (typeof fileVersion !== 'number' || fileVersion < 1) {
    return { ok: false, problem: 'not-a-care-pass' };
  }
  if (fileVersion > CARE_PASS_FILE_VERSION) {
    return { ok: false, problem: 'unsupported-version' };
  }
  const passRaw = parsed.pass;
  if (!isObject(passRaw)) return { ok: false, problem: 'missing-pass' };
  // Read each field into a local so the checks below narrow its type: after
  // this block every value is known to be the shape the CarePass model wants.
  const { creatorName, caregiverName, inviteCode, selectedPetIds, startDate, endDate } =
    passRaw;
  const permissionLevel = passRaw.permissionLevel;
  const exportedAt = parsed.exportedAt;
  const sections = cleanSections(passRaw.visibleSections);
  if (
    typeof creatorName !== 'string' ||
    creatorName.trim() === '' ||
    typeof caregiverName !== 'string' ||
    caregiverName.trim() === '' ||
    typeof inviteCode !== 'string' ||
    normalizeInviteCode(inviteCode).length === 0 ||
    !isStringArray(selectedPetIds) ||
    typeof startDate !== 'string' ||
    !isValidISODate(startDate) ||
    typeof endDate !== 'string' ||
    !isValidISODate(endDate) ||
    typeof permissionLevel !== 'string' ||
    !PERMISSION_LEVELS.includes(permissionLevel as CarePassPermissionLevel) ||
    sections === null
  ) {
    return { ok: false, problem: 'missing-pass' };
  }
  if (!Array.isArray(parsed.pets)) return { ok: false, problem: 'not-a-care-pass' };
  const pets: CarePassPetSnapshot[] = [];
  for (const pet of parsed.pets) {
    const clean = cleanPetSnapshot(pet);
    if (!clean) return { ok: false, problem: 'not-a-care-pass' };
    pets.push(clean);
  }
  if (pets.length === 0) return { ok: false, problem: 'no-pets' };

  const pass: CarePass = {
    id: typeof passRaw.id === 'string' && passRaw.id ? passRaw.id : newId(),
    createdAt:
      typeof passRaw.createdAt === 'string' ? passRaw.createdAt : new Date().toISOString(),
    creatorName: creatorName.trim(),
    caregiverName: caregiverName.trim(),
    selectedPetIds: [...selectedPetIds],
    startDate,
    endDate,
    permissionLevel: permissionLevel as CarePassPermissionLevel,
    visibleSections: sections,
    inviteCode: normalizeInviteCode(inviteCode),
    // The file may say 'closed'; the derived value is applied on import.
    status: passRaw.status === 'closed' ? 'closed' : 'active',
    source: 'received',
  };
  return {
    ok: true,
    file: {
      kind: CARE_PASS_FILE_KIND,
      fileVersion,
      exportedAt:
        typeof exportedAt === 'string' ? exportedAt : new Date().toISOString(),
      pass,
      pets,
    },
  };
}

/** Human-friendly explanation of why an invite could not be opened. */
export function carePassFileProblemMessage(problem: CarePassFileProblem): string {
  switch (problem) {
    case 'not-json':
      return 'That text isn’t a care pass — it doesn’t look like the file the app can read.';
    case 'not-a-care-pass':
      return 'That wasn’t a Sitter Mode care pass. Ask the pet parent to use “Share pass file” on the pass.';
    case 'unsupported-version':
      return 'That care pass was made by a newer version of the app. Update Pet Parent Tracker on this device and try again.';
    case 'missing-pass':
      return 'That care pass is missing its details (caregiver, dates, pets or sections), so it can’t be opened.';
    case 'no-pets':
      return 'That care pass doesn’t name any pets, so there’s nothing to look after.';
  }
}

// --- Invite file: import (store it on the sitter's device) ------------------

/** What opening an invite produced. */
export type CarePassImportOutcome =
  | {
      ok: true;
      /** The pass as it now lives on this device. */
      pass: CarePass;
      /** True when a pass with the same invite code was replaced. */
      replaced: boolean;
    }
  | {
      ok: false;
      /** A pass with this invite code is already on this device. */
      reason: 'conflict';
    };

/**
 * Store a validated invite on this device (the sitter's side).
 *
 * The pass keeps its **owner-assigned invite code** — that is what identifies
 * the same pass on both devices — but gets a fresh local `id`, so a sitter's
 * copy can never collide with a pass the owner has themselves. `source` is
 * always 'received' here, whatever the file said.
 *
 * When a pass with that code is already on this device the caller has to say
 * `overwrite: true` (the screens ask the sitter first); without it the import
 * reports a `conflict` and changes nothing. Overwriting keeps the local id and
 * picks up the owner's latest fields; a pass the sitter already closed stays
 * closed, so re-opening a file never resurrects an ended pass.
 */
export async function importCarePassInvite(
  file: CarePassInviteFile,
  options: { overwrite?: boolean } = {},
): Promise<CarePassImportOutcome> {
  const existing = await carePassRepository.findByInviteCode(file.pass.inviteCode);
  if (existing && !options.overwrite) {
    return { ok: false, reason: 'conflict' };
  }

  const incoming: CarePass = {
    ...file.pass,
    inviteCode: normalizeInviteCode(file.pass.inviteCode),
    visibleSections: [...file.pass.visibleSections],
    selectedPetIds: [...file.pass.selectedPetIds],
    source: 'received',
    // The owner's pets are not pets on this device — keep the snapshots that
    // came with the invite so the pass still shows who it covers after a
    // restart.
    petSnapshots: file.pets.map((pet) => ({ ...pet })),
  };

  if (existing) {
    const keepClosed = existing.status === 'closed';
    const next: CarePass = {
      ...incoming,
      id: existing.id,
      createdAt: existing.createdAt,
      status: keepClosed ? 'closed' : carePassStatus(incoming),
    };
    const stored = await carePassStore.update(existing.id, next);
    return { ok: true, pass: stored ?? next, replaced: true };
  }

  const created = await carePassStore.create({
    ...incoming,
    id: newId(),
    createdAt: new Date().toISOString(),
    status: carePassStatus(incoming),
  });
  return { ok: true, pass: created, replaced: false };
}
