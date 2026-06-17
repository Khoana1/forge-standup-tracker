import { addDays } from './summary.js';

export const deriveTeamMembers = (entries, lookbackDays = 14, referenceDate = new Date()) => {
  const today = referenceDate.toISOString().slice(0, 10);
  const fromDate = addDays(today, -lookbackDays);
  const memberMap = new Map();

  for (const entry of entries) {
    if (entry.date < fromDate) continue;
    if (!entry.accountId) continue;
    if (!memberMap.has(entry.accountId)) {
      memberMap.set(entry.accountId, {
        accountId: entry.accountId,
        displayName: entry.displayName ?? 'Team member',
      });
    }
  }

  return [...memberMap.values()].sort((a, b) =>
    (a.displayName ?? '').localeCompare(b.displayName ?? '')
  );
};

export const computeSprintCompletionRate = (entries, members, referenceDate = new Date()) => {
  const today = referenceDate.toISOString().slice(0, 10);
  const memberCount = Math.max(members.length, 1);
  let expectedLogs = 0;
  let actualLogs = 0;

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(today, -i);
    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (day === 0 || day === 6) continue;
    expectedLogs += memberCount;
    actualLogs += entries.filter((e) => e.date === date).length;
  }

  if (expectedLogs === 0) return { rate: 0 };
  return { rate: Math.round((actualLogs / expectedLogs) * 100) };
};
