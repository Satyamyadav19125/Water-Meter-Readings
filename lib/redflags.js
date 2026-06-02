// =====================================================================
// Red flag detection
// A water meter is a counter — it can ONLY go up. If a later reading
// is smaller than the previous reading for the same serial number,
// the user almost certainly typed the wrong number.
// =====================================================================

import { getField, parseReading } from './fieldMap.js';

/**
 * Group submissions by meter serial number, sorted oldest-first.
 */
export function groupBySerial(submissions) {
  const groups = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    if (!groups[serial]) groups[serial] = [];
    groups[serial].push(sub);
  }
  // Sort each group by Kobo's _submission_time (most reliable timestamp)
  for (const serial in groups) {
    groups[serial].sort(
      (a, b) =>
        new Date(a._submission_time).getTime() -
        new Date(b._submission_time).getTime()
    );
  }
  return groups;
}

/**
 * Compute red flags across all submissions.
 *
 * Flag types:
 *   - rollback: end reading is less than the previous end reading
 *               (meter physically can't go backwards)
 *   - reverse:  within one submission, end reading < start reading
 *   - huge_jump: end reading more than 100,000 above previous
 *               (configurable; usually indicates a typo with extra digit)
 *
 * Returns: { [submissionId]: { flags: [...], previousReading, currentReading } }
 */
export function detectRedFlags(submissions, options = {}) {
  const { hugeJumpThreshold = 100000 } = options;
  const groups = groupBySerial(submissions);
  const flagged = {};

  for (const serial in groups) {
    const list = groups[serial];
    for (let i = 0; i < list.length; i++) {
      const sub = list[i];
      const id = sub._id;
      const startR = parseReading(getField(sub, 'startReading'));
      const endR = parseReading(getField(sub, 'endReading'));
      const flags = [];

      // 1. Within-submission reverse
      if (!Number.isNaN(startR) && !Number.isNaN(endR) && endR < startR) {
        flags.push({
          type: 'reverse',
          message: `End reading (${endR}) is less than start reading (${startR}) in the same submission`,
        });
      }

      // 2. Rollback compared to last submission for this meter
      if (i > 0) {
        const prev = list[i - 1];
        const prevEnd = parseReading(getField(prev, 'endReading'));
        if (!Number.isNaN(prevEnd) && !Number.isNaN(endR)) {
          if (endR < prevEnd) {
            flags.push({
              type: 'rollback',
              message: `Reading (${endR}) is LESS than last reading (${prevEnd}) for meter ${serial}. Meter cannot go backwards.`,
              previousReading: prevEnd,
              previousSubmissionId: prev._id,
              previousDate: prev._submission_time,
            });
          } else if (endR - prevEnd > hugeJumpThreshold) {
            flags.push({
              type: 'huge_jump',
              message: `Reading jumped by ${endR - prevEnd} (${prevEnd} → ${endR}) — possible typo.`,
              previousReading: prevEnd,
              previousSubmissionId: prev._id,
            });
          }
        }
      }

      if (flags.length > 0) {
        flagged[id] = { flags, serial };
      }
    }
  }

  return flagged;
}
