import { extractJiraIssueKeys, parseStandupFieldParts } from './adf-helpers.js';

const normalizeKey = (key) => String(key ?? '').trim().toUpperCase();

/** Gom work item theo cột Tasks / Progress / Problems (và task vấn đề tự tạo). */
export const groupStandupLinkedIssues = (entry) => {
  const tasks = new Set();
  const progress = new Set();
  const problems = new Set();

  const addFromField = (field, target) => {
    const value = entry?.[field];
    for (const key of extractJiraIssueKeys(value)) target.add(normalizeKey(key));
    for (const issue of parseStandupFieldParts(value).issues) {
      target.add(normalizeKey(issue.key));
    }
  };

  addFromField('yesterday', tasks);
  addFromField('today', progress);
  addFromField('blockers', problems);

  const blockerIssueKey = normalizeKey(entry?.blockerIssueKey);
  if (blockerIssueKey) problems.add(blockerIssueKey);

  const linkedKeys = (entry?.linkedIssueKeys ?? []).map(normalizeKey).filter(Boolean);

  for (const key of linkedKeys) {
    if (problems.has(key)) continue;
    if (tasks.has(key)) continue;
    if (progress.has(key)) continue;
    tasks.add(key);
  }

  for (const key of problems) {
    tasks.delete(key);
    progress.delete(key);
  }

  return {
    tasks: [...tasks],
    progress: [...progress],
    problems: [...problems],
  };
};

export const allGroupedIssueKeys = (groups) => [
  ...new Set([...(groups.tasks ?? []), ...(groups.progress ?? []), ...(groups.problems ?? [])]),
];
