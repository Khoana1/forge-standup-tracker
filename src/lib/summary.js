/** Pure helpers for sprint standup summary — unit-testable without Forge. */

import { STANDUP_LABELS_SHORT } from './labels.js';
import { extractPlainText } from './adf-helpers.js';

export const SPRINT_SUMMARY_WEEKS = 2;
export const SPRINT_SUMMARY_DAYS = SPRINT_SUMMARY_WEEKS * 7;

export const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const getSprintDateRange = (sprintStartDate, days = SPRINT_SUMMARY_DAYS) => {
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    dates.push(addDays(sprintStartDate, i));
  }
  return dates;
};

/** @deprecated Dùng getSprintDateRange */
export const getWeekDateRange = (weekStartDate) => getSprintDateRange(weekStartDate, 7);

export const getDefaultWeekStart = (referenceDate = new Date()) => {
  const d = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

export const getSprintEndDate = (sprintStartDate, days = SPRINT_SUMMARY_DAYS) =>
  addDays(sprintStartDate, days - 1);

/**
 * @param {Array<{ date: string, displayName: string, yesterday: string, today: string, blockers: string }>} entries
 * @param {string} sprintStartDate YYYY-MM-DD
 */
export const buildSprintSummary = (entries, sprintStartDate) => {
  const sprintDates = getSprintDateRange(sprintStartDate);
  const sprintEndDate = getSprintEndDate(sprintStartDate);
  const byDate = new Map();

  for (const entry of entries) {
    if (!sprintDates.includes(entry.date)) continue;
    if (!byDate.has(entry.date)) byDate.set(entry.date, []);
    byDate.get(entry.date).push(entry);
  }

  const lines = [
    `# Tổng kết Team Sync sprint (${SPRINT_SUMMARY_WEEKS} tuần)`,
    `Sprint bắt đầu ${sprintStartDate} · kết thúc ${sprintEndDate}`,
    '',
  ];

  for (const date of sprintDates) {
    const dayEntries = byDate.get(date) ?? [];
    lines.push(`## ${date}`);
    if (dayEntries.length === 0) {
      lines.push('_Chưa có bản ghi Team Sync._');
      lines.push('');
      continue;
    }
    for (const e of dayEntries) {
      lines.push(`### ${e.displayName || 'Team member'}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.tasks}** ${extractPlainText(e.yesterday)}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.progress}** ${extractPlainText(e.today)}`);
      lines.push(`- **${STANDUP_LABELS_SHORT.problems}** ${extractPlainText(e.blockers)}`);
      lines.push('');
    }
  }

  const totalEntries = [...byDate.values()].reduce((sum, arr) => sum + arr.length, 0);
  const blockerCount = entries.filter(
    (e) =>
      sprintDates.includes(e.date) &&
      extractPlainText(e.blockers) &&
      !['none', 'không có', 'khong co'].includes(extractPlainText(e.blockers).toLowerCase())
  ).length;

  lines.push('---');
  lines.push(`**Tổng bản ghi:** ${totalEntries}`);
  lines.push(`**Có vấn đề:** ${blockerCount}`);

  const days = sprintDates.map((date) => ({
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
    sprintStartDate,
    sprintEndDate,
    sprintDates,
    periodDays: SPRINT_SUMMARY_DAYS,
    periodWeeks: SPRINT_SUMMARY_WEEKS,
    weekStartDate: sprintStartDate,
    weekDates: sprintDates,
    days,
    totalEntries,
    blockerCount,
  };
};

/** @deprecated Dùng buildSprintSummary */
export const buildWeeklySummary = buildSprintSummary;

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
