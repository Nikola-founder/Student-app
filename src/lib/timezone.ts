// src/lib/timezone.ts
import { formatInTimeZone } from 'date-fns-tz'

/**
 * Formats a UTC ISO timestamp into a given IANA timezone.
 * Used to show every event in both the student's home-country and
 * host-country local time simultaneously.
 */
export function formatInTz(isoString: string, timeZone: string, fmt = 'h:mm a') {
  return formatInTimeZone(new Date(isoString), timeZone, fmt)
}

export function dualTimeLabel(
  isoString: string,
  homeTz: string,
  hostTz: string
): string {
  const home = formatInTz(isoString, homeTz)
  const host = formatInTz(isoString, hostTz)
  if (home === host) return host // same offset today — no need to show both
  return `${host} host · ${home} home`
}

/** Short, readable timezone abbreviation, e.g. "EST", "KST". */
export function tzAbbreviation(timeZone: string): string {
  return formatInTimeZone(new Date(), timeZone, 'zzz')
}
