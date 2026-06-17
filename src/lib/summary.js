/** Pure helpers for weekly standup summary — unit-testable without Forge. */

import { STANDUP_LABELS_SHORT } from './labels.js';

export const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const getWeekDateRange = (weekStartDate) => {
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    dates.push(addDays(weekStartDate, i));
  }
  return dates;
};

export const getDefaultWeekStart = (referenceDate = new Date()) => {
  const d = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

/**
 * @param {Array<{ date: string, displayName: string, yesterday: string, today: string, blockers: string }>} entries
 * @param {string} weekStartDate YYYY-MM-DD (Monday)
 */
export const buildWeeklySummary = (entries, weekStartDate) => {
  const weekDates = getWeekDateRange(weekStartDate);
  const byDate = new Map();

  for (const entry of entries) {
    if (!weekDates.includes(entry.date)) continue;
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  const lines = [`# Tổng kết Team Sync tuần`, `Tuần bắt đầu ${weekStartDate}`, ''];

  for (const date of weekDates) {
    const dayEntries = byDate.get(date) ?? [];
    lines.push(`## ${date}`);
    if (dayEntries.length === 0) {
      lines.push('_Chưa có bản ghi Team Sync._');
      lines.push('');
      continue;
    }
    for (const e of dayEntries) {
      lines.push(`### ${e.displayName || 'Team member'}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.tasks}** ${e.yesterday}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.progress}** ${e.today}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.problems}** ${e.blockers}`);
      lines.push('');
    }
  }

  const totalEntries = [...byDate.values()].reduce((sum, arr) => sum + arr.length, 0);
  const blockerCount = entries.filter(
    (e) =>
      weekDates.includes(e.date) &&
      e.blockers &&
      !['none', 'không có', 'khong co'].includes(e.blockers.trim().toLowerCase())
  ).length;

  lines.push('---');
  lines.push(`**Tổng bản ghi:** ${totalEntries}`);
  lines.push(`**Có vấn đề:** ${blockerCount}`);

  const days = weekDates.map((date) => ({
    date,
    entries: (byDate.get(date) ?? []).map((e) => ({
      accountId: e.accountId,
      displayName: e.displayName || 'Team member',
      yesterday: e.yesterday,
      today: e.today,
      blockers: e.blockers,
    })),
  }));

  return {
    text: lines.join('\n'),
    weekStartDate,
    weekDates,
    days,
    totalEntries,
    blockerCount,
  };
};

export const filterEntriesByDateRange = (entries, fromDate, toDate) =>
  entries.filter((e) => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    return true;
  });

export const isProjectEnabled = (projectKey, teamConfig, settings) => {
  if (settings?.enabled === false) return false;
  const list = teamConfig?.enabledProjects;
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.includes(projectKey);
};
