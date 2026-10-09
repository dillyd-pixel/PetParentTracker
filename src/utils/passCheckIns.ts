/**
 * Care pass ↔ check-in association — the pure half of "how did the sit go?".
 *
 * Two questions, both answered from records already on this device and neither
 * of which changes anything:
 *
 *  1. **Which pass is this act part of?** While a pass is active and today is
 *     inside its window and the pet is on it, an act recorded on the caregiver
 *     check-in screen is filed under that pass (`passIdToTag`). The next
 *     newest active pass wins when several overlap, so a tag never depends on
 *     list order.
 *  2. **What did that pass see?** The owner's pass detail lists the records
 *     filed under it, newest first (`passCheckInEntries`). Events that carry
 *     the pass id are the truth; a pass with none — everything recorded before
 *     passes were tagged, or acts logged from the ring — falls back to the
 *     records of the pets on the pass whose local day sits inside the pass's
 *     own date window. The fallback is labelled as such on screen, so the
 *     owner always knows which of the two they are reading.
 *
 * Deliberately read-only, and deliberately not the ring's business: nothing
 * here can make a tile read as done, and an event with no pass is simply an
 * event with no pass. No score, no "missed", no comparison between passes.
 *
 * 100% offline: pure functions over in-memory records — no storage, no network.
 */
import { careCheckInPassId } from '../types/checkIn';
import type { CareCheckInEvent } from '../types/checkIn';
import { carePassStatus } from '../types/carePass';
import type { CarePass } from '../types/carePass';
import { careLogDayKey, careLogLine } from './caregiverCheckIn';
import { formatDateOnlyInTimeZone } from './datetime';

/** Is `dayKey` inside the pass's own window (both ends inclusive)? */
export function passCoversDay(
  pass: Pick<CarePass, 'startDate' | 'endDate'>,
  dayKey: string,
): boolean {
  if (!dayKey) return false;
  return pass.startDate <= dayKey && dayKey <= pass.endDate;
}

/** Does this pass name this pet? (Ids only — never a fuzzy name match.) */
export function passCoversPet(pass: Pick<CarePass, 'selectedPetIds'>, petId: string): boolean {
  return pass.selectedPetIds.includes(petId);
}

/** Is this pass active today AND running today AND on this pet? */
export function passAppliesToPetToday(
  pass: CarePass,
  petId: string,
  dayKey: string,
): boolean {
  return (
    carePassStatus(pass, dayKey) === 'active' &&
    passCoversDay(pass, dayKey) &&
    passCoversPet(pass, petId)
  );
}

/**
 * The pass an act recorded now should be filed under, or null when none
 * applies. `passes` comes from the app's own list (newest first), so the most
 * recently created covering pass wins a tie.
 */
export function passIdToTag(
  passes: readonly CarePass[],
  petId: string,
  dayKey: string,
): string | null {
  const match = passes.find((pass) => passAppliesToPetToday(pass, petId, dayKey));
  return match ? match.id : null;
}

/** Every pass on this device that applies to a pet today (newest first). */
export function activePassesForPetToday(
  passes: readonly CarePass[],
  petId: string,
  dayKey: string,
): CarePass[] {
  return passes.filter((pass) => passAppliesToPetToday(pass, petId, dayKey));
}

/** The line the sitter sees, e.g. "Logged for the pass for 2026-09-20 → 2026-09-27". */
export function passTagLabel(pass: Pick<CarePass, 'startDate' | 'endDate'>): string {
  return `Logged for the pass for ${pass.startDate} → ${pass.endDate}`;
}

/** One record shown on a pass, already said out loud. */
export interface PassCheckInEntry {
  id: string;
  /** The event this line came from. */
  event: CareCheckInEvent;
  /** The pet's name on the device, or '' when it cannot be resolved. */
  petName: string;
  /** "Fed by Sarah — 8:03 AM" — the same wording every log in the app uses. */
  text: string;
  /** "Bella — Fed by Sarah — 8:03 AM", or just the text for a single pet. */
  line: string;
  /** True when the record itself carried this pass's id. */
  tagged: boolean;
  /** The local day it happened on ('' when the timestamp is unusable). */
  dayKey: string;
}

/** What one pet on a pass is called (the owner's pets, then the pass's own snapshots). */
function petNameLookup(
  pass: Pick<CarePass, 'petSnapshots' | 'selectedPetIds'>,
  petNames: Record<string, string>,
): (petId: string) => string {
  const fromSnapshots = new Map(
    (pass.petSnapshots ?? []).map((snap) => [snap.id, snap.name] as const),
  );
  return (petId: string) => petNames[petId] ?? fromSnapshots.get(petId) ?? '';
}

/**
 * The records a pass owns, newest first.
 *
 * Preference order, stated plainly because the screen says which one it used:
 *  1. events whose `passId` is this pass — the real thing;
 *  2. when there are none, the events of this pass's pets that fall inside the
 *     pass's date window and were not filed under a different pass.
 *
 * `petNames` maps pet ids to names (the owner's live pets). A pet that is gone
 * still gets its name from the pass's own snapshots; an unresolvable pet id
 * contributes a line with no name rather than dropping the record.
 */
export function passCheckInEntries(
  events: readonly CareCheckInEvent[],
  pass: Pick<CarePass, 'id' | 'startDate' | 'endDate' | 'selectedPetIds' | 'petSnapshots'>,
  options: { petNames?: Record<string, string>; zone?: string } = {},
): PassCheckInEntry[] {
  const nameFor = petNameLookup(pass, options.petNames ?? {});
  const singlePet = pass.selectedPetIds.length === 1;

  const tagged = events.filter((event) => careCheckInPassId(event) === pass.id);
  const untaggedFallback = events.filter((event) => {
    const other = careCheckInPassId(event);
    if (other !== null) return false; // filed under another pass — not ours
    if (!passCoversPet(pass, event.petId)) return false;
    return passCoversDay(pass, careLogDayKey(event.at, options.zone));
  });
  const source = tagged.length > 0 ? tagged : untaggedFallback;

  return [...source]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((event) => {
      const petName = nameFor(event.petId);
      const text = careLogLine(event, options.zone);
      return {
        id: event.id,
        event,
        petName,
        text,
        line: petName && !singlePet ? `${petName} — ${text}` : text,
        tagged: careCheckInPassId(event) === pass.id,
        dayKey: careLogDayKey(event.at, options.zone),
      };
    });
}

/** How many records a pass owns (the same rule as `passCheckInEntries`). */
export function passCheckInCount(
  events: readonly CareCheckInEvent[],
  pass: Pick<CarePass, 'id' | 'startDate' | 'endDate' | 'selectedPetIds' | 'petSnapshots'>,
  options: { zone?: string } = {},
): number {
  return passCheckInEntries(events, pass, options).length;
}

/** One line naming the pass's window in the owner's own calendar, e.g. "20 Sep 2026 → 27 Sep 2026". */
export function passWindowLabel(
  pass: Pick<CarePass, 'startDate' | 'endDate'>,
  zone?: string,
): string {
  const from = formatDateOnlyInTimeZone(pass.startDate, zone) || pass.startDate;
  const to = formatDateOnlyInTimeZone(pass.endDate, zone) || pass.endDate;
  return `${from} → ${to}`;
}
