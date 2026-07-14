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

/** Enrich Jira project members with standup display names — never add users outside project roles. */
export const mergeTeamMembers = (
  projectMembers,
  entries,
  lookbackDays = 14,
  referenceDate = new Date()
) => {
  const entryMembers = deriveTeamMembers(entries, lookbackDays, referenceDate);
  const entryNameByAccountId = new Map(
    entryMembers.map((member) => [member.accountId, member.displayName])
  );

  return (projectMembers ?? [])
    .filter((member) => member?.accountId)
    .map((member) => {
      const entryName = entryNameByAccountId.get(member.accountId);
      const displayName =
        entryName && entryName !== 'Team member'
          ? entryName
          : member.displayName ?? 'Team member';
      return { accountId: member.accountId, displayName };
    })
    .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));
};

/**
 * Always include the current viewer so they can see their own loggedToday status,
 * even when they are only in a project role via group membership (role actors API
 * only returns direct user actors).
 */
export const ensureViewerInMembers = (members, viewer) => {
  const accountId = viewer?.accountId;
  if (!accountId) return members ?? [];

  const list = [...(members ?? [])];
  const existing = list.find((member) => member.accountId === accountId);
  if (existing) {
    if (viewer.displayName && existing.displayName === 'Team member') {
      existing.displayName = viewer.displayName;
    }
    return list;
  }

  list.push({
    accountId,
    displayName: viewer.displayName?.trim() || 'Bạn',
  });
  return list.sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? ''));
};

export const filterEntriesToMembers = (entries, members) => {
  const allowed = new Set((members ?? []).map((member) => member.accountId).filter(Boolean));
  if (!allowed.size) return entries;
  return entries.filter((entry) => allowed.has(entry.accountId));
};

export const computeSprintCompletionRate = (entries, members, referenceDate = new Date()) => {
  const today = referenceDate.toISOString().slice(0, 10);
  const memberCount = Math.max(members.length, 1);
  let expectedLogs = 0;
  let actualLogs = 0;

  for (let i = 0; i < 14; i += 1) {
    const date = addDays(today, -i);
    const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    if (day === 0 || day === 6) continue;
    expectedLogs += memberCount;
    actualLogs += entries.filter((e) => e.date === date).length;
  }

  if (expectedLogs === 0) return { rate: 0 };
  return { rate: Math.round((actualLogs / expectedLogs) * 100) };
};
