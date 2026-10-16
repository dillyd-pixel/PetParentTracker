/**
 * Vet Mode's on-device storage (HANDOFF, unit 2 of 3).
 *
 * A prepared visit is a plain local record — the pet, the day, the reason, the
 * questions and the recheck date — held in the app's own AsyncStorage collection
 * under the app prefix (`@pet-parent-tracker/vetVisits`), exactly like pets,
 * passes, trips and check-ins. So it is covered by Settings' one-sweep wipe
 * (`wipeAllAppData` removes every key below the prefix) and it never leaves the
 * device: no account, no sync, no server.
 *
 * Two rules worth stating plainly:
 *
 *  - **Storage is not trusted.** Anything read back goes through
 *    `vetDraftFromStored`, which drops records with no usable id or pet, flattens
 *    and caps every string, keeps only real question strings and only real ISO
 *    days. Nothing downstream can print "undefined" or "NaN", and a hand-edited
 *    store cannot break the screen.
 *  - **A prepared visit is NOT a vet record.** Nothing has happened yet, so this
 *    store holds the owner's own prep. The one thing that becomes a record is the
 *    visit itself (and its recheck), written through the app's own vet store —
 *    there is no second vet-records table anywhere, by design.
 *
 * 100% offline: JSON in memory + AsyncStorage. No fetch, no URLs, no accounts.
 */
import { CollectionStore, newId } from './storage';
import type { VetVisitDraft, VetVisitDraftInput } from '../utils/vetMode';
import { vetDraftFromStored, vetDraftToInput } from '../utils/vetMode';

/** Persisted collection of the owner's prepared visits. */
export const vetVisitStore = new CollectionStore<VetVisitDraft>('vetVisits');

/** The AsyncStorage key this feature owns (for the wipe + harness checks). */
export const VET_VISITS_KEY = '@pet-parent-tracker/vetVisits';

/** Newest first, so the prep most recently written sits at the top. */
function byNewest(a: VetVisitDraft, b: VetVisitDraft): number {
  return b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
}

/**
 * The whole collection, as a list — whatever the key actually holds.
 *
 * `CollectionStore.getAll()` JSON-parses the key inside a try/catch, so junk that
 * is not JSON at all already reads as empty. A value that *is* valid JSON but not
 * an array (a hand-edited `{"nope":true}`, or a bare `42`) still comes back as
 * that value, and both `for…of` and `.find()` would throw on it. So the feature
 * reads through here: anything that is not an array is treated as "nothing
 * stored", and the key is repaired to an empty list so the next write is a real
 * array again. A storage failure on the repair is not fatal — the caller gets an
 * honest empty list either way.
 */
async function readAll(): Promise<VetVisitDraft[]> {
  let raw: unknown;
  try {
    raw = await vetVisitStore.getAll();
  } catch {
    return [];
  }
  if (Array.isArray(raw)) return raw;
  try {
    await vetVisitStore.setAll([]);
  } catch {
    // Read-only trouble is the screen's business to report, not a reason to throw
    // out of a read.
  }
  return [];
}

/** All CRUD for the `vetVisits` collection, with the reads cleaned. */
export const vetVisitRepository = {
  /** Every prepared visit on this device, newest first, every field made safe. */
  async list(): Promise<VetVisitDraft[]> {
    const raw = await readAll();
    const drafts: VetVisitDraft[] = [];
    for (const item of raw) {
      const clean = vetDraftFromStored(item);
      // No id means it can never be opened or removed — dropped rather than
      // rendered as a row that does nothing.
      if (clean && clean.id.length > 0) drafts.push(clean);
    }
    return drafts.sort(byNewest);
  },

  /** One prepared visit by id, cleaned, or null. */
  async get(id: string): Promise<VetVisitDraft | null> {
    const wanted = typeof id === 'string' ? id : '';
    if (wanted === '') return null;
    const rows = await readAll();
    const found = rows.find((item) => item != null && item.id === wanted);
    const clean = vetDraftFromStored(found ?? null);
    return clean && clean.id.length > 0 ? clean : null;
  },

  /**
   * Save a prepared visit: update the record when `id` is given and still
   * exists, otherwise create a new one. The stored record is cleaned first, so
   * what comes back is exactly what a later read will see.
   */
  async save(input: VetVisitDraftInput, id?: string): Promise<VetVisitDraft> {
    const fields = vetDraftToInput({ id: 'pending', createdAt: '', ...input });
    const wanted = typeof id === 'string' ? id.trim() : '';
    const rows = await readAll();
    if (wanted !== '') {
      const existing = rows.find((item) => item != null && item.id === wanted);
      if (existing) {
        const updated = await vetVisitStore.update(wanted, fields);
        return (
          vetDraftFromStored(updated) ?? {
            id: wanted,
            createdAt: existing.createdAt ?? '',
            ...fields,
          }
        );
      }
    }
    return vetVisitStore.create({
      id: newId(),
      createdAt: new Date().toISOString(),
      ...fields,
    });
  },

  /** Remove a prepared visit. Returns true when a record was actually removed. */
  async remove(id: string): Promise<boolean> {
    const wanted = typeof id === 'string' ? id : '';
    if (wanted === '') return false;
    return vetVisitStore.remove(wanted);
  },
};
