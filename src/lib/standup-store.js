import { kvs, WhereConditions } from '@forge/kvs';
import { standupEntryKey } from './keys.js';
import { filterEntriesByDateRange } from './summary.js';

const KEY_PREFIX = 'standup:';
const QUERY_LIMIT = 99;

const standupKeyPrefix = (projectKey) => `${KEY_PREFIX}${projectKey}:`;

const normalizeIssueKeys = (keys) =>
  [...new Set((keys ?? []).map((k) => String(k).trim().toUpperCase()).filter(Boolean))].slice(0, 10);

export const saveStandupEntry = async (entry) => {
  const key = standupEntryKey(entry.projectKey, entry.date, entry.accountId);
  const existing = await kvs.get(key);
  const value = {
    accountId: entry.accountId,
    displayName: entry.displayName,
    projectKey: entry.projectKey,
    date: entry.date,
    yesterday: entry.yesterday,
    today: entry.today,
    blockers: entry.blockers,
    createdAt: entry.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    linkedIssueKeys: normalizeIssueKeys(entry.linkedIssueKeys ?? existing?.linkedIssueKeys),
    contextIssueKey: entry.contextIssueKey ?? existing?.contextIssueKey ?? null,
    blockerResolved:
      typeof entry.blockerResolved === 'boolean'
        ? entry.blockerResolved
        : (existing?.blockerResolved ?? false),
  };
  await kvs.set(key, value);
  return { key, ...value };
};

export const updateBlockerResolved = async (
  projectKey,
  date,
  accountId,
  { resolved = true, resolutionPlan, resolvedBy } = {}
) => {
  const key = standupEntryKey(projectKey, date, accountId);
  const existing = await kvs.get(key);
  if (!existing) return null;
  const value = {
    ...existing,
    blockerResolved: Boolean(resolved),
    ...(resolved && resolutionPlan
      ? {
          blockerResolution: String(resolutionPlan).trim(),
          blockerResolvedAt: new Date().toISOString(),
          blockerResolvedBy: resolvedBy ?? null,
        }
      : {}),
  };
  await kvs.set(key, value);
  return { key, ...value };
};

export const getStandupEntry = async (projectKey, date, accountId) => {
  const key = standupEntryKey(projectKey, date, accountId);
  return kvs.get(key);
};

const queryKeysByPrefix = async (prefix) => {
  const { results } = await kvs
    .query()
    .where('key', WhereConditions.beginsWith(prefix))
    .limit(QUERY_LIMIT)
    .getMany();
  return (results ?? []).map((r) => r.key);
};

const loadEntriesByPrefix = async (prefix) => {
  const keys = await queryKeysByPrefix(prefix);
  const rows = await Promise.all(
    keys.map(async (key) => {
      const value = await kvs.get(key);
      if (!value) return null;
      return { key, ...value };
    })
  );
  return rows.filter(Boolean);
};

export const queryProjectEntries = async (projectKey, fromDate, toDate) => {
  const entries = await loadEntriesByPrefix(standupKeyPrefix(projectKey));
  return filterEntriesByDateRange(entries, fromDate, toDate);
};

export const queryAllEntries = async () => loadEntriesByPrefix(KEY_PREFIX);

export const deleteEntriesOlderThan = async (cutoffDate) => {
  const all = await queryAllEntries();
  const stale = all.filter((e) => e.date < cutoffDate);
  for (const entry of stale) {
    await kvs.delete(entry.key);
  }
  return { deleted: stale.length, cutoffDate };
};

export const purgeAllStandupEntries = async () => {
  const all = await queryAllEntries();
  for (const entry of all) {
    await kvs.delete(entry.key);
  }
  return { deleted: all.length };
};
