/**
 * Gentle gamification for the Command Center (design Phase C) — care streaks,
 * badges, milestones and the celebration calendar. Pure functions over the
 * app's own records; no storage, no network, no dependency.
 *
 * The three rules this file exists to keep:
 *
 *  1. **Never score medical outcomes, never shame.** There is no penalty, no
 *     "missed" state and no award for a negative. A lapsed streak simply
 *     restarts, an unticked day is silence, and every badge blurb is a friendly
 *     aside. Nothing here reads a diagnosis, a dose or a weight.
 *  2. **Never invent.** Each award's condition is evaluated against records the
 *     owner actually created (check-ins, journal entries, vaccines, vet
 *     records, care-circle members). A brand-new install satisfies almost
 *     nothing, and the ones it does satisfy are derived from the pet's own
 *     profile fields.
 *  3. **Celebrate, don't nag.** A streak counts days that *happened*, and gives
 *     today grace: before you have ticked anything today, the streak you had
 *     yesterday is still the number shown — it is never reset mid-morning just
 *     because the day has only just begun.
 *
 * 100% offline: pure helpers over already-loaded data.
 */
import type { CareCheckInEvent, JournalEntry, Pet, Vaccine, VetRecord } from '../types';
import { isMoodCheckIn } from '../types/checkIn';
import type { AwardKind } from '../storage/awards';
import { todayISOInTimeZone } from './datetime';

const DAY_MS = 86_400_000;

/* ----------------------------------------------------------------- dates -- */

/** Shift an ISO calendar day by whole days, or null when malformed. */
export function shiftISODate(iso: string, days: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const at = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) + days * DAY_MS;
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Does this stored ISO date fall on today's month + day? (A yearly date.) */
export function isTodayAnniversary(iso: string | undefined, todayISO: string): boolean {
  if (!iso) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  return iso.slice(5) === todayISO.slice(5);
}

/* ---------------------------------------------------------------- streak -- */

/**
 * The local calendar days (in the display zone) a pet has a check-in on.
 *
 * Mood observations are skipped: a day where a caregiver only noted how the pet
 * seemed is not a day an act of care was recorded, and the streak's copy
 * ("been cared for") has to stay literally true.
 */
export function checkInDays(
  events: CareCheckInEvent[],
  petId: string,
  zone?: string,
): Set<string> {
  const days = new Set<string>();
  for (const event of events) {
    if (event.petId !== petId) continue;
    if (isMoodCheckIn(event.type)) continue;
    const at = new Date(event.at);
    if (Number.isNaN(at.getTime())) continue;
    days.add(todayISOInTimeZone(at, zone));
  }
  return days;
}

/**
 * Consecutive days ending today (or yesterday, when today has no check-in yet)
 * on which at least one care act was recorded for this pet.
 *
 * The one-day grace is deliberate: a streak is a count of days that already
 * happened, so it is never dragged back to zero by a day that is still going.
 */
export function careStreakDays(
  events: CareCheckInEvent[],
  petId: string,
  todayISO: string,
  zone?: string,
): number {
  const days = checkInDays(events, petId, zone);
  if (days.size === 0) return 0;
  let cursor = days.has(todayISO) ? todayISO : shiftISODate(todayISO, -1);
  let count = 0;
  while (cursor && days.has(cursor)) {
    count += 1;
    cursor = shiftISODate(cursor, -1);
  }
  return count;
}

/** The playful line a streak earns. Never mentions what did *not* happen. */
export function streakCopy(petName: string, days: number): string {
  if (days <= 0) return '';
  if (days === 1) return `${petName} was cared for today. That's 1 day running 🐾`;
  return `${petName}'s been cared for ${days} days running 🔥`;
}

/** Whether a check-in day set already covers today (used for honest copy). */
export function isStreakLive(
  events: CareCheckInEvent[],
  petId: string,
  todayISO: string,
  zone?: string,
): boolean {
  return checkInDays(events, petId, zone).has(todayISO);
}

/* ---------------------------------------------------------------- awards -- */

/** Everything the award conditions read, already gathered for one pet. */
export interface AwardFacts {
  /** The pet the shelf belongs to. */
  pet: Pet;
  /** The check-in log (every pet's is fine — the helpers filter). */
  checkIns: CareCheckInEvent[];
  /** That pet's journal entries. */
  journal: JournalEntry[];
  /** That pet's vaccine records. */
  vaccines: Vaccine[];
  /** That pet's vet records (visits, appointments and documents). */
  vetRecords: VetRecord[];
  /** How many people are in this pet's care circle (co-parents + sitters). */
  careCircleCount: number;
  /** Today, as the owner's chosen display zone sees it. */
  todayISO: string;
  /** The display zone (undefined = this device's own). */
  zone?: string;
}

/** The shared summary every condition reads — computed once per pet. */
export interface AwardSummary {
  streak: number;
  checkIns: number;
  walks: number;
  hasPhoto: boolean;
  hasVaccine: boolean;
  hasVisit: boolean;
  hasAppointment: boolean;
  hasJournal: boolean;
  birthdayToday: boolean;
}

/** Reduce a pet's records to the handful of facts the catalogue asks about. */
export function awardSummary(ctx: AwardFacts): AwardSummary {
  const own = ctx.checkIns.filter((event) => event.petId === ctx.pet.id);
  return {
    streak: careStreakDays(ctx.checkIns, ctx.pet.id, ctx.todayISO, ctx.zone),
    checkIns: own.length,
    walks: own.filter((event) => event.type === 'exercise').length,
    hasPhoto:
      !!ctx.pet.photoUri ||
      ctx.journal.some((entry) => !!entry.photoUri || !!entry.photoEmoji),
    hasVaccine: ctx.vaccines.length > 0,
    hasVisit: ctx.vetRecords.some((record) => (record.kind ?? 'visit') === 'visit'),
    hasAppointment: ctx.vetRecords.some((record) => record.kind === 'appointment'),
    hasJournal: ctx.journal.length > 0,
    birthdayToday: isTodayAnniversary(ctx.pet.birthdate, ctx.todayISO),
  };
}

/** One catalogue entry: a badge or a milestone, and the real condition behind it. */
export interface AwardDef {
  id: string;
  kind: AwardKind;
  emoji: string;
  title: string;
  /** The friendly line under the title — where the award came from. */
  blurb: string;
  /**
   * Is it earned? `summary` is the shared facts; `ctx` carries the rarer
   * evidence. Nothing here is ever true for an empty install.
   */
  earnedBy: (summary: AwardSummary, ctx: AwardFacts) => boolean;
}

/** The badge shelf — marker awards, in the order they tend to arrive. */
export const BADGES: AwardDef[] = [
  {
    id: 'first-photo',
    kind: 'badge',
    emoji: '📷',
    title: 'First Photo',
    blurb: 'A face to put to the name. The pet page is officially theirs.',
    earnedBy: (facts) => facts.hasPhoto,
  },
  {
    id: 'vaccine-hero',
    kind: 'badge',
    emoji: '💉',
    title: 'Vaccine Hero',
    blurb: 'First vaccine record filed — the paperwork is under control.',
    earnedBy: (facts) => facts.hasVaccine,
  },
  {
    id: 'care-circle-founder',
    kind: 'badge',
    emoji: '🤝',
    title: 'Care Circle Founder',
    blurb: 'Someone else now knows how this pet likes things. Smart.',
    earnedBy: (_facts, ctx) => ctx.careCircleCount > 0,
  },
  {
    id: 'streak-7',
    kind: 'badge',
    emoji: '🔥',
    title: '7-Day Streak',
    blurb: 'A full week of care recorded, one tap at a time.',
    earnedBy: (facts) => facts.streak >= 7,
  },
  {
    id: 'streak-30',
    kind: 'badge',
    emoji: '🌟',
    title: '30-Day Streak',
    blurb: 'A month of showing up. Somebody has a routine.',
    earnedBy: (facts) => facts.streak >= 30,
  },
  {
    id: 'birthday-buddy',
    kind: 'badge',
    emoji: '🎂',
    title: 'Birthday Buddy',
    blurb: 'You were here on the big day. Cake was involved, presumably.',
    earnedBy: (facts) => facts.birthdayToday,
  },
];

/** The milestone shelf — the firsts and the round numbers. */
export const MILESTONES: AwardDef[] = [
  {
    id: 'first-check-in',
    kind: 'milestone',
    emoji: '🐾',
    title: 'First check-in',
    blurb: 'The first care act recorded for this pet. The log starts here.',
    earnedBy: (facts) => facts.checkIns >= 1,
  },
  {
    id: 'first-walk',
    kind: 'milestone',
    emoji: '🚶',
    title: 'First walk',
    blurb: 'First exercise check-in — out the door, both of you.',
    earnedBy: (facts) => facts.walks >= 1,
  },
  {
    id: 'first-memory',
    kind: 'milestone',
    emoji: '📖',
    title: 'First memory',
    blurb: 'Something written down that a future you will be glad to find.',
    earnedBy: (facts) => facts.hasJournal,
  },
  {
    id: 'first-vet-visit',
    kind: 'milestone',
    emoji: '🩺',
    title: 'First vet visit',
    blurb: 'The first clinic visit in the file.',
    earnedBy: (facts) => facts.hasVisit,
  },
  {
    id: 'first-appointment',
    kind: 'milestone',
    emoji: '📅',
    title: 'First appointment booked',
    blurb: 'A date in the diary, before it became a scramble.',
    earnedBy: (facts) => facts.hasAppointment,
  },
  {
    id: 'check-ins-100',
    kind: 'milestone',
    emoji: '💯',
    title: '100 check-ins',
    blurb: 'One hundred recorded care acts. Quietly remarkable.',
    earnedBy: (facts) => facts.checkIns >= 100,
  },
];

/** Every catalogue entry, badges then milestones. */
export const ALL_AWARDS: AwardDef[] = [...BADGES, ...MILESTONES];

/** The catalogue entry for an id, or undefined for an award we no longer ship. */
export function awardById(id: string): AwardDef | undefined {
  return ALL_AWARDS.find((award) => award.id === id);
}

/** Everything this pet's real records satisfy right now. */
export function derivedAwards(ctx: AwardFacts): AwardDef[] {
  const summary = awardSummary(ctx);
  return ALL_AWARDS.filter((award) => award.earnedBy(summary, ctx));
}

/* ----------------------------------------------------------- celebration -- */

/** A pet's birthday or gotcha day, when it lands today. */
export interface PetCelebration {
  id: string;
  petId: string;
  petName: string;
  kind: 'birthday' | 'adoption';
  emoji: string;
  title: string;
  message: string;
}

/** Whole years between a stored date's year and today's, or null when unknown. */
function yearsTogether(iso: string, todayISO: string): number | null {
  const start = Number(iso.slice(0, 4));
  const now = Number(todayISO.slice(0, 4));
  if (!Number.isFinite(start) || !Number.isFinite(now)) return null;
  const years = now - start;
  return years > 0 ? years : null;
}

/**
 * Today's celebrations across the household: any pet whose stored birthday or
 * adoption day is today. Both can land on the same day (they do), and both are
 * shown — a pet with neither stored date contributes nothing at all.
 */
export function celebrationsToday(pets: Pet[], todayISO: string): PetCelebration[] {
  const out: PetCelebration[] = [];
  for (const pet of pets) {
    if (isTodayAnniversary(pet.birthdate, todayISO)) {
      const years = yearsTogether(pet.birthdate as string, todayISO);
      out.push({
        id: `birthday-${pet.id}`,
        petId: pet.id,
        petName: pet.name,
        kind: 'birthday',
        emoji: '🎂',
        title: `${pet.name}'s birthday`,
        message: years
          ? `Turning ${years} today. Extra treats are, frankly, mandatory.`
          : 'It’s their birthday today. Cake is tradition — a small slice is theirs.',
      });
    }
    if (isTodayAnniversary(pet.adoptionDate, todayISO)) {
      const years = yearsTogether(pet.adoptionDate as string, todayISO);
      out.push({
        id: `adoption-${pet.id}`,
        petId: pet.id,
        petName: pet.name,
        kind: 'adoption',
        emoji: '🏡',
        title: `${pet.name}'s gotcha day`,
        message: years
          ? `${years} year${years === 1 ? '' : 's'} together today. Still the best decision.`
          : 'The day they came home. Happy gotcha day.',
      });
    }
  }
  return out;
}

/** The playful line a newly-earned award earns on the day it lands. */
export function awardCelebrationCopy(award: AwardDef): string {
  return award.kind === 'badge'
    ? `New badge: ${award.emoji} ${award.title} — ${award.blurb}`
    : `New milestone: ${award.emoji} ${award.title} — ${award.blurb}`;
}

/** Was this award earned on the given local day? (For "just earned" copy.) */
export function awardEarnedOn(
  earnedAt: string,
  dayKey: string,
  zone?: string,
): boolean {
  const at = new Date(earnedAt);
  if (Number.isNaN(at.getTime())) return false;
  return todayISOInTimeZone(at, zone) === dayKey;
}
