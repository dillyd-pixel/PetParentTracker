/**
 * Care Pass — the Sitter Mode domain model (Stage 1: the foundation).
 *
 * Sitter Mode lets a pet parent hand a trusted caregiver a "Care Pass" so the
 * sitter can look after the pets while the owner is away. A pass is a plain
 * on-device record: which pets it covers, for which days, what the sitter may
 * do, and which care sections are visible. It never touches a server — the
 * invite travels as a shared file / pass code, exactly like the co-parent
 * share feature (see `src/storage/carePasses.ts`).
 *
 * This stage is deliberately only the foundation. Later stages add care
 * instructions, the Today care dashboard / check-in, the guided wizard and
 * emergency mode. So the shapes below are the contract those stages build on:
 *
 *  - `CARE_PASS_SECTIONS` is the ONE canonical list of section ids. Every
 *    screen, later stage and exported pass draws its section values from it —
 *    never from a locally typed string. Adding a section means adding it here
 *    (and to `CARE_PASS_SECTION_LABELS`), nothing else.
 *  - The stored `status` is a fact the owner set; `carePassStatus()` derives
 *    the status to *show* from `endDate` vs today. Both are kept: a pass is
 *    'expired' once its end date has passed, and 'closed' when the owner ends
 *    it early (a closed pass never reads as expired).
 *  - `source` records where this copy of the pass came from — created on this
 *    device, or received by opening someone else's invite. Later stages use it
 *    to decide whether this device is the owner or the sitter.
 *
 * 100% offline: types and pure helpers only — no storage, no network.
 */
import type { BaseEntity, Species } from './index';
import { todayISOInTimeZone } from '../utils/datetime';

/**
 * The canonical care sections a pass can show. Values are stable, lowercase
 * ids — safe to store, export and compare forever; the human wording lives in
 * `CARE_PASS_SECTION_LABELS`.
 *
 * This list IS the contract: the create form, the pass detail, the invite file
 * and every later Sitter Mode stage read their section values from
 * `CARE_PASS_SECTIONS` below, never from a locally typed string. A pass shows
 * "everything" simply by having every id selected (the create form's default).
 */
export type CarePassSection =
  | 'feeding'
  | 'medications'
  | 'walking'
  | 'bathroom'
  | 'behavior'
  | 'vet'
  | 'emergency'
  | 'allergies'
  | 'house';

/**
 * THE canonical section list — the single source of truth for section ids.
 *
 * Order is the order the create form and the pass detail render them in.
 * Later stages (care instructions, dashboard, wizard, emergency mode) must
 * import this constant instead of listing section ids again.
 */
export const CARE_PASS_SECTIONS: readonly CarePassSection[] = [
  'feeding',
  'medications',
  'walking',
  'bathroom',
  'behavior',
  'vet',
  'emergency',
  'allergies',
  'house',
];

/** Human wording for each canonical section id (1:1 with `CARE_PASS_SECTIONS`). */
export const CARE_PASS_SECTION_LABELS: Record<CarePassSection, string> = {
  feeding: 'Feeding',
  medications: 'Medications',
  walking: 'Walking',
  bathroom: 'Bathroom',
  behavior: 'Behaviour',
  vet: 'Vet',
  emergency: 'Emergency',
  allergies: 'Allergies',
  house: 'House rules',
};

/** Human label for a section id; unknown ids fall back to the raw id. */
export function carePassSectionLabel(section: CarePassSection): string {
  return CARE_PASS_SECTION_LABELS[section] ?? section;
}

/** Whether a value is one of the canonical section ids (used by import). */
export function isCarePassSection(value: unknown): value is CarePassSection {
  return (
    typeof value === 'string' &&
    (CARE_PASS_SECTIONS as readonly string[]).includes(value)
  );
}

/** What the sitter may do with the pass: read it, or also update tasks. */
export type CarePassPermissionLevel = 'view-only' | 'update-tasks';

/** Permission levels, in the order the create form offers them. */
export const CARE_PASS_PERMISSION_LEVELS: readonly CarePassPermissionLevel[] = [
  'view-only',
  'update-tasks',
];

/** Human label for a permission level ("View only" / "Can update tasks"). */
export function carePassPermissionLabel(level: CarePassPermissionLevel): string {
  return level === 'view-only' ? 'View only' : 'Can update tasks';
}

/** A pass's lifecycle status. */
export type CarePassStatus = 'active' | 'closed' | 'expired';

/** Statuses a stored pass can hold, in badge order. */
export const CARE_PASS_STATUSES: readonly CarePassStatus[] = [
  'active',
  'closed',
  'expired',
];

/** Human label for a status badge ("Active" / "Closed" / "Expired"). */
export function carePassStatusLabel(status: CarePassStatus): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'closed':
      return 'Closed';
    case 'expired':
      return 'Expired';
  }
}

/**
 * Where this copy of the pass came from. `'created'` — the owner made it on
 * this device; `'received'` — it was opened here from someone else's invite.
 * Local metadata: it is always `'received'` on import, whatever the file says.
 */
export type CarePassSource = 'created' | 'received';

/**
 * The CarePass entity — stored on-device via AsyncStorage.
 *
 * Dates are ISO calendar days (`YYYY-MM-DD`), the same format the rest of the
 * app stores dates in, so a comparison against today is a plain string
 * comparison and the day never shifts across a time zone.
 */
export interface CarePass extends BaseEntity {
  /** The pet parent handing the pass over ("Pass from …"). */
  creatorName: string;
  /** The trusted caregiver the pass is for. */
  caregiverName: string;
  /** The pets this pass covers (ids of the creator's own pets). */
  selectedPetIds: string[];
  /** First day the pass is valid (ISO date YYYY-MM-DD). */
  startDate: string;
  /** Last day the pass is valid (ISO date YYYY-MM-DD). */
  endDate: string;
  /** What the sitter may do. */
  permissionLevel: CarePassPermissionLevel;
  /** Which care sections the sitter sees (ids from `CARE_PASS_SECTIONS`). */
  visibleSections: CarePassSection[];
  /**
   * Short human-readable code generated on this device (6 chars, A–Z/0–9),
   * unique across the passes on the device that created it. It identifies the
   * pass when two copies meet (opening an invite that is already here) and is
   * typed by hand when a sitter opens a pass they already hold. It is NOT a
   * server key — nothing is ever looked up remotely.
   */
  inviteCode: string;
  /** Stored status: 'closed' only ever comes from the owner closing the pass. */
  status: CarePassStatus;
  /** Whether this copy was created here or received from someone else. */
  source: CarePassSource;
  /**
   * The covered pets as they were when the pass was handed over: what a
   * sitter's device renders, because the owner's pets are not pets on the
   * sitter's device and their records never travel with a pass.
   *
   * The owner's own copy leaves this unset — the pass detail reads their live
   * pets through `selectedPetIds`. An imported copy always sets it (from the
   * invite's `pets`), so the pass still shows who it covers after an app
   * restart, with no owner device in sight.
   */
  petSnapshots?: CarePassPetSnapshot[];
}

/** Everything the create form supplies; the store assigns the rest. */
export interface CarePassInput {
  creatorName: string;
  caregiverName: string;
  selectedPetIds: string[];
  startDate: string;
  endDate: string;
  permissionLevel: CarePassPermissionLevel;
  visibleSections: CarePassSection[];
}

/** Fields the pass detail screen / later stages may edit in place. */
export type CarePassUpdate = Partial<CarePassInput>;

/** The stored status to show for a pass, given today's date. */
export function carePassStatus(
  pass: Pick<CarePass, 'endDate' | 'status'>,
  today: string = todayISOInTimeZone(),
): CarePassStatus {
  // The owner's own "closed" always wins: an ended pass is never "expired".
  if (pass.status === 'closed') return 'closed';
  // An ISO calendar day compares correctly as a string.
  if (pass.endDate && pass.endDate < today) return 'expired';
  return 'active';
}

/** Whether a pass has run past its end date (ignores an owner-closed pass). */
export function isCarePassExpired(
  pass: Pick<CarePass, 'endDate' | 'status'>,
  today: string = todayISOInTimeZone(),
): boolean {
  return carePassStatus(pass, today) === 'expired';
}

/** Whether a pass is still usable today (created, not closed, not expired). */
export function isCarePassUsable(
  pass: Pick<CarePass, 'endDate' | 'status'>,
  today: string = todayISOInTimeZone(),
): boolean {
  return carePassStatus(pass, today) === 'active';
}

/** Human date range for a pass, e.g. "12 Sep 2026 → 19 Sep 2026". */
export function carePassDateRange(pass: Pick<CarePass, 'startDate' | 'endDate'>): string {
  return `${pass.startDate} → ${pass.endDate}`;
}

/** How long a pass runs, in whole days (inclusive of both ends); 0 when unknown. */
export function carePassDurationDays(
  pass: Pick<CarePass, 'startDate' | 'endDate'>,
): number {
  const start = Date.parse(`${pass.startDate}T00:00:00Z`);
  const end = Date.parse(`${pass.endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

/**
 * One pet inside an invite file — the slice of a pet profile a sitter's device
 * needs to show who they are looking after, without carrying the owner's
 * records. `photoUri` is a local file path, so it only resolves on the
 * exporting device; imported passes treat it as best-effort (kept, shown when
 * it happens to load).
 */
export interface CarePassPetSnapshot {
  /** The owner's pet id (kept for reference; not a pet on the sitter's device). */
  id: string;
  name: string;
  species: Species;
  /** The pet's own species name when `species` is 'Other' (e.g. "Bunny"). */
  customSpecies?: string;
  photoUri?: string;
}

/** Current care-pass invite format version. Readers accept this or older. */
export const CARE_PASS_FILE_VERSION = 1;

/** Marker identifying a JSON document as a Sitter Mode care-pass invite. */
export const CARE_PASS_FILE_KIND = 'pet-parent-tracker-care-pass';

/**
 * A portable care-pass invite: the pass's own fields plus the pets it covers.
 *
 * It is a plain on-device JSON file the owner hands to their sitter (the same
 * mechanism as the co-parent pet file) — there is no link, no upload and no
 * account anywhere in the flow.
 */
export interface CarePassInviteFile {
  kind: typeof CARE_PASS_FILE_KIND;
  fileVersion: number;
  /** ISO timestamp of when the invite was written. */
  exportedAt: string;
  /** The pass itself, sent whole so the sitter's copy can show every field. */
  pass: CarePass;
  /** The pets the pass covers (id, name, species label, best-effort photo). */
  pets: CarePassPetSnapshot[];
}
