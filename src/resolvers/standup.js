import { fetchActiveSprint } from '../lib/jira-sprint.js';
import { createLogger } from '../lib/logger.js';
import { validateProjectExists } from '../lib/jira-users.js';
import {
  getGlobalSettings,
  getTeamConfig,
} from '../lib/settings.js';
import { persistStandupSubmission } from '../lib/standup-submit.js';
import {
  buildSprintSummary,
  getDefaultWeekStart,
  getSprintEndDate,
  isProjectEnabled,
} from '../lib/summary.js';
import {
  getStandupEntry,
  queryProjectEntries,
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

  const result = await persistStandupSubmission({ payload, context, validation });
  timer.end({ action: 'submitStandup', projectKey, date, accountId });
  return result;
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
  await assertProjectAllowed(projectKey);

  const sprintStartDate =
    payload.sprintStartDate ??
    payload.weekStartDate ??
    (await fetchActiveSprint(projectKey))?.startDate?.slice(0, 10) ??
    getDefaultWeekStart();
  const toDate = getSprintEndDate(sprintStartDate);

  const entries = await queryProjectEntries(projectKey, sprintStartDate, toDate);
  const summary = buildSprintSummary(entries, sprintStartDate);

  timer.end({ action: 'getWeeklySummary', projectKey, sprintStartDate });
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
