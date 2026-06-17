import { fetchActiveSprint } from '../lib/jira-sprint.js';
import { createLogger } from '../lib/logger.js';
import { fetchMyDisplayName, validateProjectExists } from '../lib/jira-users.js';
import {
  getGlobalSettings,
  getTeamConfig,
} from '../lib/settings.js';
import {
  buildWeeklySummary,
  getDefaultWeekStart,
  isProjectEnabled,
} from '../lib/summary.js';
import {
  getStandupEntry,
  queryProjectEntries,
  saveStandupEntry,
} from '../lib/standup-store.js';
import {
  validateHistoryPayload,
  validateSubmitStandupPayload,
  validateWeeklySummaryPayload,
} from '../lib/validators.js';

const logger = createLogger('standup-resolver');

const assertAccount = (context) => {
  const { accountId } = context ?? {};
  if (!accountId) throw new Error('User context is required.');
  return accountId;
};

export const assertProjectAllowed = async (projectKey) => {
  const [settings, teamConfig] = await Promise.all([getGlobalSettings(), getTeamConfig()]);
  if (!isProjectEnabled(projectKey, teamConfig, settings)) {
    throw new Error('Team Sync is not enabled for this project.');
  }
  if (!settings.enabled) {
    throw new Error('Team Sync is disabled by your administrator.');
  }
  return { settings, teamConfig };
};

export const submitStandup = async ({ payload, context }) => {
  const timer = logger.timer('submitStandup');
  const accountId = assertAccount(context);

  const validation = validateSubmitStandupPayload(payload);
  if (!validation.valid) {
    throw new Error(validation.errors[0].message);
  }

  const { projectKey, date } = validation;
  await assertProjectAllowed(projectKey);

  const exists = await validateProjectExists(projectKey);
  if (!exists) throw new Error(`Project ${projectKey} was not found.`);

  const displayName = await fetchMyDisplayName();
  const entry = {
    accountId,
    displayName,
    projectKey,
    date,
    yesterday: payload.yesterday.trim(),
    today: payload.today.trim(),
    blockers: payload.blockers.trim(),
    createdAt: new Date().toISOString(),
    linkedIssueKeys: payload.linkedIssueKeys ?? [],
    contextIssueKey: payload.contextIssueKey ?? null,
    blockerResolved: false,
  };

  const saved = await saveStandupEntry(entry);
  timer.end({ action: 'submitStandup', projectKey, date, accountId });
  return { success: true, entry: saved };
};

export const getMyStandupToday = async ({ payload, context }) => {
  const accountId = assertAccount(context);
  const { projectKey, date = new Date().toISOString().slice(0, 10) } = payload ?? {};

  if (!projectKey) throw new Error('projectKey is required');

  const entry = await getStandupEntry(projectKey, date, accountId);
  return { entry };
};

export const getTeamHistory = async ({ payload }) => {
  const timer = logger.timer('getTeamHistory');
  const validation = validateHistoryPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey, fromDate, toDate } = payload;
  await assertProjectAllowed(projectKey);

  const entries = await queryProjectEntries(
    projectKey,
    fromDate ?? null,
    toDate ?? null
  );

  entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (a.displayName ?? '').localeCompare(b.displayName ?? '');
  });

  timer.end({ action: 'getTeamHistory', projectKey, count: entries.length });
  return { entries, projectKey };
};

export const getWeeklySummary = async ({ payload }) => {
  const timer = logger.timer('getWeeklySummary');
  const validation = validateWeeklySummaryPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey } = payload;
  const weekStartDate = payload.weekStartDate ?? getDefaultWeekStart();

  await assertProjectAllowed(projectKey);

  const weekEnd = new Date(`${weekStartDate}T12:00:00.000Z`);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const toDate = weekEnd.toISOString().slice(0, 10);

  const entries = await queryProjectEntries(projectKey, weekStartDate, toDate);
  const summary = buildWeeklySummary(entries, weekStartDate);

  timer.end({ action: 'getWeeklySummary', projectKey, weekStartDate });
  return summary;
};

export const getAppStatus = async ({ payload }) => {
  const { projectKey } = payload ?? {};
  const [settings, teamConfig, activeSprint] = await Promise.all([
    getGlobalSettings(),
    getTeamConfig(),
    projectKey ? fetchActiveSprint(projectKey) : Promise.resolve(null),
  ]);
  const enabled = projectKey
    ? isProjectEnabled(projectKey, teamConfig, settings)
    : settings.enabled;
  return { settings, teamConfig, projectEnabled: enabled, activeSprint };
};
