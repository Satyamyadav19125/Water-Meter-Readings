// Shared assembly of everything detectRedFlags needs, so all pages call it the
// same way: settings toggles, GPS limits, review window, and disabled-farm/meter
// exclusion. Keeps the callers consistent.
import { getSettings } from './db.js';
import { excludeDisabled } from './filter.js';
import { detectRedFlags } from './redflags.js';

export async function buildFlagOptions(settings) {
  const s = settings || (await getSettings());
  // "Stale — no reading" should mean "not read within the CURRENT reading
  // period", so it tracks the admin's period setting instead of a hardcoded
  // number. With the default 7-day period this is unchanged.
  const periodDays = Math.max(1, Number(s?.reading?.periodDays) || 7);
  // How far a single reading may sit from the centre of all readings before it
  // is flagged as an obvious GPS mistake. Admin-tunable; default 100 km. An
  // explicitly-cleared box ('') disables the check; a never-configured value
  // falls back to the default.
  const maxLocationKm = s?.meter?.maxLocationKm == null ? 100 : s.meter.maxLocationKm;
  // Only red-flag readings from the last N days (blank/0 = flag everything).
  const flagWindowDays = s?.redFlags?.flagWindowDays ?? s?.meter?.flagWindowDays ?? null;
  const hugeJumpThreshold = Number(s?.meter?.hugeJumpThreshold) || 100000;
  return {
    enabled: s?.redFlags,
    staleDays: periodDays,
    maxLocationKm,
    flagWindowDays,
    hugeJumpThreshold,
  };
}

// Run red flags on the submissions that are NOT on a disabled farm/meter.
// Disabled units never flag and never count as missed.
export async function detectFlagsScoped(submissions, settings) {
  const active = await excludeDisabled(submissions);
  const opts = await buildFlagOptions(settings);
  return detectRedFlags(active, opts);
}
