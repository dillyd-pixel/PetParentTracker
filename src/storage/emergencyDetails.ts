/**
 * Emergency card details on-device storage.
 *
 * The app keeps no phone-number field, no microchip field and no allergy field
 * anywhere else, so the card screen has one small form where the owner types —
 * once — the handful of facts only they know: their own number, the co-parent's,
 * the vet's number, an emergency vet, the microchip number, the allergies or
 * conditions in their own words, and a behaviour note for whoever finds the pet.
 *
 * What they type is kept HERE, on this device, under one key of the app's own
 * storage prefix (`@pet-parent-tracker/emergency-details`), so it survives an
 * app restart, rides along with the "delete everything" wipe, and never leaves
 * the phone. Values are trimmed and capped on the way in, and blanks are dropped
 * rather than stored as empty strings — clearing a box genuinely removes it.
 *
 * 100% offline: AsyncStorage only — no fetch, no URLs, no accounts, no server.
 */
import { KeyValueStore } from './storage';
import type { EmergencyCardExtras, EmergencyExtrasByPet } from '../pdf/emergency/document';

/** Every field of the card-details form, in the order the screen shows them. */
export const EMERGENCY_DETAIL_FIELDS: ReadonlyArray<keyof EmergencyCardExtras> = [
  'ownerPhone',
  'coParentName',
  'coParentPhone',
  'vetName',
  'vetPhone',
  'emergencyVetName',
  'emergencyVetPhone',
  'microchip',
  'allergies',
  'behaviorNote',
];

/** How long a single typed value may be (a runaway value can ruin the layout). */
const MAX_LENGTH = 120;

/** The one AsyncStorage key this feature owns. */
const emergencyDetailsStore = new KeyValueStore('emergency-details');

/** Trim, cap and drop blanks — a value the owner cleared is not stored at all. */
export function cleanExtras(raw: EmergencyCardExtras | undefined | null): EmergencyCardExtras {
  const out: EmergencyCardExtras = {};
  if (!raw) return out;
  for (const field of EMERGENCY_DETAIL_FIELDS) {
    const value = raw[field];
    if (typeof value !== 'string') continue;
    const text = value.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH);
    if (text.length > 0) out[field] = text;
  }
  return out;
}

/** Parse the stored JSON into a per-pet map, tolerating anything unreadable. */
export function parseExtrasByPet(json: string | null): EmergencyExtrasByPet {
  if (!json) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: EmergencyExtrasByPet = {};
    for (const [petId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!petId) continue;
      const cleaned = cleanExtras(value as EmergencyCardExtras);
      if (Object.keys(cleaned).length > 0) out[petId] = cleaned;
    }
    return out;
  } catch {
    // Corrupt or hand-edited storage must never break the card screen.
    return {};
  }
}

/** An empty extras object for a pet (used when nothing has been typed yet). */
export function extrasForPet(
  all: EmergencyExtrasByPet,
  petId: string,
): EmergencyCardExtras {
  return all[petId] ?? {};
}

/** The card-details repository the screen (and its hook) use. */
export const emergencyDetailsRepository = {
  /** Every pet's typed card details on this device. */
  async load(): Promise<EmergencyExtrasByPet> {
    return parseExtrasByPet(await emergencyDetailsStore.get());
  },
  /** Replace the whole map (the hook debounces writes through this). */
  async saveAll(all: EmergencyExtrasByPet): Promise<void> {
    const cleaned: EmergencyExtrasByPet = {};
    for (const [petId, value] of Object.entries(all)) {
      const next = cleanExtras(value);
      if (Object.keys(next).length > 0) cleaned[petId] = next;
    }
    if (Object.keys(cleaned).length === 0) {
      await emergencyDetailsStore.remove();
      return;
    }
    await emergencyDetailsStore.set(JSON.stringify(cleaned));
  },
  /** Forget one pet's typed details (the pet-delete cascade can call this). */
  async removeForPet(petId: string): Promise<EmergencyExtrasByPet> {
    const all = await this.load();
    delete all[petId];
    await this.saveAll(all);
    return all;
  },
  /** Forget every pet's typed details. */
  async clear(): Promise<void> {
    await emergencyDetailsStore.remove();
  },
};
