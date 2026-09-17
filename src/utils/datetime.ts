/**
 * Date/time display in the pet parent's chosen time zone.
 *
 * The Settings screen lets the owner pick an IANA time zone (or keep the
 * device's own, `AUTO_TIME_ZONE`). Everything the app *stores* is untouched by
 * that choice — ISO strings are saved exactly as entered. This module only
 * changes how a Date is *rendered*, via `Intl.DateTimeFormat`'s `timeZone`
 * option, which is built into Hermes (React Native) and every browser, so it
 * needs no new dependency and no network.
 *
 * Two kinds of value live in the app, and they are deliberately treated
 * differently:
 *  - Instants (`new Date()`, an ISO timestamp such as a trial end) genuinely
 *    belong to a moment in time, so the chosen zone shifts what you read.
 *  - Calendar values typed by the owner ("2026-05-14" for a visit date, or a
 *    wall-clock "09:30" appointment) are date/time-of-day facts with no zone
 *    of their own. They are formatted through the chosen zone too, anchored at
 *    midday so a zone can never push them onto the neighbouring day — the date
 *    the owner typed is the date they see.
 *
 * Every entry point is wrapped in try/catch: an unknown/typo'd zone, or a
 * runtime without full Intl data, falls back to the device's own local time
 * rather than throwing. 100% offline — pure local formatting, no network.
 */

/** The stored value meaning "use this device's own time zone". */
export const AUTO_TIME_ZONE = 'auto';

/** Fallback zone when the runtime reports nothing usable. */
const FALLBACK_TIME_ZONE = 'UTC';

/** A pickable time zone: the IANA id plus how the picker names it. */
export interface TimeZoneChoice {
  /** IANA zone id, or `AUTO_TIME_ZONE` for the device's own zone. */
  zone: string;
  /** Short name shown in the row, e.g. "Tokyo". */
  label: string;
  /** Where it is / who it covers, e.g. "Japan · Asia/Tokyo". */
  detail: string;
}

/**
 * The curated zone list offered in Settings. Deliberately a fixed, readable
 * list (not the runtime's full tz database, which varies by platform): one
 * entry per zone a pet parent is likely to live in, ordered west → east so the
 * list reads like a clock face.
 */
export const TIME_ZONE_CHOICES: TimeZoneChoice[] = [
  { zone: AUTO_TIME_ZONE, label: 'Device time zone (auto)', detail: 'Follow this device’s clock and zone' },
  { zone: 'UTC', label: 'UTC', detail: 'Coordinated Universal Time' },
  { zone: 'Pacific/Honolulu', label: 'Honolulu', detail: 'Hawaii · Pacific/Honolulu' },
  { zone: 'America/Anchorage', label: 'Anchorage', detail: 'Alaska · America/Anchorage' },
  { zone: 'America/Los_Angeles', label: 'Los Angeles', detail: 'US Pacific · America/Los_Angeles' },
  { zone: 'America/Denver', label: 'Denver', detail: 'US Mountain · America/Denver' },
  { zone: 'America/Phoenix', label: 'Phoenix', detail: 'US Arizona · America/Phoenix' },
  { zone: 'America/Chicago', label: 'Chicago', detail: 'US Central · America/Chicago' },
  { zone: 'America/New_York', label: 'New York', detail: 'US Eastern · America/New_York' },
  { zone: 'America/Toronto', label: 'Toronto', detail: 'Canada Eastern · America/Toronto' },
  { zone: 'America/Mexico_City', label: 'Mexico City', detail: 'Mexico · America/Mexico_City' },
  { zone: 'America/Bogota', label: 'Bogotá', detail: 'Colombia · America/Bogota' },
  { zone: 'America/Sao_Paulo', label: 'São Paulo', detail: 'Brazil · America/Sao_Paulo' },
  { zone: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', detail: 'Argentina · America/Argentina/Buenos_Aires' },
  { zone: 'Atlantic/Reykjavik', label: 'Reykjavík', detail: 'Iceland · Atlantic/Reykjavik' },
  { zone: 'Europe/London', label: 'London', detail: 'UK · Europe/London' },
  { zone: 'Europe/Dublin', label: 'Dublin', detail: 'Ireland · Europe/Dublin' },
  { zone: 'Europe/Lisbon', label: 'Lisbon', detail: 'Portugal · Europe/Lisbon' },
  { zone: 'Europe/Madrid', label: 'Madrid', detail: 'Spain · Europe/Madrid' },
  { zone: 'Europe/Paris', label: 'Paris', detail: 'France · Europe/Paris' },
  { zone: 'Europe/Berlin', label: 'Berlin', detail: 'Germany · Europe/Berlin' },
  { zone: 'Europe/Amsterdam', label: 'Amsterdam', detail: 'Netherlands · Europe/Amsterdam' },
  { zone: 'Europe/Rome', label: 'Rome', detail: 'Italy · Europe/Rome' },
  { zone: 'Europe/Stockholm', label: 'Stockholm', detail: 'Sweden · Europe/Stockholm' },
  { zone: 'Europe/Athens', label: 'Athens', detail: 'Greece · Europe/Athens' },
  { zone: 'Europe/Istanbul', label: 'Istanbul', detail: 'Türkiye · Europe/Istanbul' },
  { zone: 'Europe/Moscow', label: 'Moscow', detail: 'Russia · Europe/Moscow' },
  { zone: 'Africa/Lagos', label: 'Lagos', detail: 'Nigeria · Africa/Lagos' },
  { zone: 'Africa/Cairo', label: 'Cairo', detail: 'Egypt · Africa/Cairo' },
  { zone: 'Africa/Johannesburg', label: 'Johannesburg', detail: 'South Africa · Africa/Johannesburg' },
  { zone: 'Africa/Nairobi', label: 'Nairobi', detail: 'Kenya · Africa/Nairobi' },
  { zone: 'Asia/Jerusalem', label: 'Jerusalem', detail: 'Israel · Asia/Jerusalem' },
  { zone: 'Asia/Dubai', label: 'Dubai', detail: 'UAE · Asia/Dubai' },
  { zone: 'Asia/Karachi', label: 'Karachi', detail: 'Pakistan · Asia/Karachi' },
  { zone: 'Asia/Kolkata', label: 'Kolkata', detail: 'India · Asia/Kolkata' },
  { zone: 'Asia/Bangkok', label: 'Bangkok', detail: 'Thailand · Asia/Bangkok' },
  { zone: 'Asia/Jakarta', label: 'Jakarta', detail: 'Indonesia · Asia/Jakarta' },
  { zone: 'Asia/Singapore', label: 'Singapore', detail: 'Singapore · Asia/Singapore' },
  { zone: 'Asia/Hong_Kong', label: 'Hong Kong', detail: 'Hong Kong · Asia/Hong_Kong' },
  { zone: 'Asia/Shanghai', label: 'Shanghai', detail: 'China · Asia/Shanghai' },
  { zone: 'Asia/Tokyo', label: 'Tokyo', detail: 'Japan · Asia/Tokyo' },
  { zone: 'Asia/Seoul', label: 'Seoul', detail: 'South Korea · Asia/Seoul' },
  { zone: 'Australia/Perth', label: 'Perth', detail: 'Australia West · Australia/Perth' },
  { zone: 'Australia/Brisbane', label: 'Brisbane', detail: 'Australia East · Australia/Brisbane' },
  { zone: 'Australia/Adelaide', label: 'Adelaide', detail: 'South Australia · Australia/Adelaide' },
  { zone: 'Australia/Sydney', label: 'Sydney', detail: 'Australia East · Australia/Sydney' },
  { zone: 'Pacific/Auckland', label: 'Auckland', detail: 'New Zealand · Pacific/Auckland' },
];

/** This device's own IANA zone, or `UTC` when the runtime won't say. */
export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && zone.length > 0 ? zone : FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/** True when `zone` is a zone `Intl` actually understands (never `auto`). */
export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone === AUTO_TIME_ZONE) return false;
  try {
    // Constructing the formatter is what validates the id.
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone to hand `Intl`: the chosen id when it is real, otherwise `undefined`
 * so the runtime uses the device's own zone. Never throws.
 */
export function resolveTimeZone(zone?: string): string | undefined {
  if (!zone || zone === AUTO_TIME_ZONE) return undefined;
  return isValidTimeZone(zone) ? zone : undefined;
}

/** The human name for a stored zone value, for summaries and captions. */
export function timeZoneLabel(zone?: string): string {
  if (!zone || zone === AUTO_TIME_ZONE) return 'Device time zone (auto)';
  const known = TIME_ZONE_CHOICES.find((choice) => choice.zone === zone);
  return known ? `${known.label} · ${zone}` : zone;
}

/**
 * Format a Date in the chosen zone. The one helper every other formatter here
 * goes through, so the try/catch fallback lives in a single place: if the zone
 * is unusable we drop it and format in local time instead of crashing.
 */
export function formatInTimeZone(
  date: Date,
  zone: string | undefined,
  options: Intl.DateTimeFormatOptions,
  locale?: string,
): string {
  const resolved = resolveTimeZone(zone);
  try {
    return new Intl.DateTimeFormat(locale, {
      ...options,
      ...(resolved ? { timeZone: resolved } : {}),
    }).format(date);
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch {
      return '';
    }
  }
}

/** The clock as 24-hour "HH:MM" in the chosen zone (matches the app's times). */
export function formatClock(date: Date, zone?: string): string {
  const formatted = formatInTimeZone(date, zone, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return formatted || deviceClock(date);
}

/** Last-resort "HH:MM" straight off the Date's own local fields. */
function deviceClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** The weekday + date line, e.g. "Wednesday, September 17", in the zone. */
export function formatWeekdayDate(date: Date, zone?: string): string {
  const formatted = formatInTimeZone(date, zone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  return formatted || date.toDateString();
}

/** "Today as the chosen zone sees it", as an ISO "YYYY-MM-DD" calendar day. */
export function todayISOInTimeZone(date: Date = new Date(), zone?: string): string {
  const parts = formatInTimeZone(date, zone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-US-style parts are "MM/DD/YYYY" — but be tolerant of any order/separator.
  const numbers = parts.match(/\d+/g);
  if (numbers && numbers.length >= 3) {
    const [a, b, c] = numbers;
    // A 4-digit field is the year, wherever the runtime put it.
    if (a.length === 4) return `${a}-${b}-${c}`;
    if (c.length === 4) return `${c}-${a}-${b}`;
  }
  // Fall back to the device's own calendar day.
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A calendar date the owner typed ("YYYY-MM-DD") rendered in the chosen zone.
 * Anchored at midday so no zone can shift it onto the neighbouring day; returns
 * an empty string when the input isn't a plain ISO date (callers keep their own
 * fallback) — see `shortDate` in utils/petDisplay, which uses this.
 */
export function formatDateOnlyInTimeZone(iso: string, zone?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const [, year, month, day] = match;
  const anchored = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
  );
  if (Number.isNaN(anchored.getTime())) return '';
  return formatInTimeZone(anchored, zone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * A real timestamp (ISO with time and zone) rendered as a date in the chosen
 * zone, e.g. "18 Sep 2026". Empty string when the value is unusable.
 */
export function formatTimestampInTimeZone(iso: string | undefined, zone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return formatInTimeZone(date, zone, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The zone's current offset as a short label, e.g. "GMT+9" — used beside each
 * row of the picker so the effect of a choice is visible before picking it.
 * Empty string when the runtime can't express it (we never guess).
 */
export function timeZoneOffsetLabel(zone: string, date: Date = new Date()): string {
  if (!zone || zone === AUTO_TIME_ZONE) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(date);
    const name = parts.find((part) => part.type === 'timeZoneName')?.value;
    return name ?? '';
  } catch {
    return '';
  }
}
