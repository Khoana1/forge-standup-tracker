import { BLOCKER_TYPE_LABELS, classifyBlockerType, hasActiveBlocker } from './blockers.js';
import { addDays } from './summary.js';

export const blockerAgeDays = (entryDate, today) =>
  Math.floor(
    (Date.parse(`${today}T12:00:00.000Z`) - Date.parse(`${entryDate}T12:00:00.000Z`)) / 86400000
  );

export const mapActiveBlocker = (entry, today, staleThreshold = 1) => {
  const ageDays = blockerAgeDays(entry.date, today);
  const type = classifyBlockerType(entry.blockers);
  return {
    key: entry.key,
    accountId: entry.accountId,
    displayName: entry.displayName ?? 'Thành viên',
    date: entry.date,
    blockers: entry.blockers,
    linkedIssueKeys: entry.linkedIssueKeys ?? [],
    createdAt: entry.createdAt,
    type,
    typeLabel: BLOCKER_TYPE_LABELS[type] ?? type,
    ageDays,
    isToday: entry.date === today,
    isStale: ageDays > staleThreshold,
  };
};

export const summarizeBlockers = (blockers) => ({
  total: blockers.length,
  today: blockers.filter((b) => b.isToday).length,
  stale: blockers.filter((b) => b.isStale).length,
});

export const buildBlockerAnalytics = (entries, referenceDate = new Date()) => {
  const today = referenceDate.toISOString().slice(0, 10);
  const active = entries.filter((e) => hasActiveBlocker(e.blockers, e.blockerResolved));

  const byMember = new Map();
  for (const entry of active) {
    const name = entry.displayName ?? 'Unknown';
    byMember.set(name, (byMember.get(name) ?? 0) + 1);
  }

  const byType = new Map();
  for (const entry of active) {
    const type = classifyBlockerType(entry.blockers);
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }

  const trend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const count = entries.filter(
      (e) => e.date === date && hasActiveBlocker(e.blockers, e.blockerResolved)
    ).length;
    trend.push({ date, count });
  }

  const resolvedCount = entries.filter(
    (e) => e.blockerResolved && hasActiveBlocker(e.blockers, false)
  ).length;

  const byMemberList = [...byMember.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const byTypeList = [...byType.entries()]
    .map(([type, count]) => ({
      type,
      label: BLOCKER_TYPE_LABELS[type] ?? type,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const maxMemberCount = Math.max(...byMemberList.map((r) => r.count), 1);
  const maxTypeCount = Math.max(...byTypeList.map((r) => r.count), 1);
  const maxTrendCount = Math.max(...trend.map((r) => r.count), 1);

  return {
    byMember: byMemberList.map((row) => ({
      ...row,
      percent: Math.round((row.count / maxMemberCount) * 100),
    })),
    byType: byTypeList.map((row) => ({
      ...row,
      percent: Math.round((row.count / maxTypeCount) * 100),
    })),
    trend: trend.map((row) => ({
      ...row,
      percent: Math.round((row.count / maxTrendCount) * 100),
    })),
    resolvedCount,
    totalActive: active.length,
  };
};

export const listActiveBlockers = (entries, options = {}) => {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const staleThreshold = options.staleThreshold ?? 1;

  return entries
    .filter((e) => hasActiveBlocker(e.blockers, e.blockerResolved))
    .map((e) => mapActiveBlocker(e, today, staleThreshold))
    .sort((a, b) => {
      if (a.isStale !== b.isStale) return Number(b.isStale) - Number(a.isStale);
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (a.displayName ?? '').localeCompare(b.displayName ?? '');
    });
};
