import { getField, parseReading } from './fieldMap.js';

export function groupBySerial(submissions) {
  const groups = {};
  for (const sub of submissions) {
    const serial = getField(sub, 'serial');
    if (!serial) continue;
    if (!groups[serial]) groups[serial] = [];
    groups[serial].push(sub);
  }
  for (const serial in groups) {
    groups[serial].sort(
      (a, b) => new Date(a._submission_time).getTime() - new Date(b._submission_time).getTime()
    );
  }
  return groups;
}

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

      if (!Number.isNaN(startR) && !Number.isNaN(endR) && startR !== endR && endR < startR) {
        flags.push({
          type: 'reverse',
          message: `End reading (${endR}) is less than start reading (${startR}) in the same submission`,
        });
      }

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
