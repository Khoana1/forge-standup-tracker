import { assertJiraAdmin, assertProjectAdmin } from '../lib/permissions.js';
import { createLogger } from '../lib/logger.js';
import { fetchUserAvatars, validateProjectExists } from '../lib/jira-users.js';
import {
  getGlobalSettings,
  getTeamConfig,
  saveGlobalSettings,
  saveTeamConfig,
} from '../lib/settings.js';
import {
  deleteEntriesByAccountId,
  purgeAllStandupEntries,
  queryAllEntries,
  summarizeStandupMembers,
} from '../lib/standup-store.js';
import { buildStandupCsv, standupExportFilename } from '../lib/export-csv.js';
import {
  validatePurgeMemberPayload,
  validatePurgePayload,
  validateSettingsPayload,
  validateTeamConfigPayload,
} from '../lib/validators.js';

const logger = createLogger('admin-resolver');

const assertTeamConfigAccess = async (context) => {
  const projectKey = context?.extension?.project?.key;
  if (projectKey) {
    await assertProjectAdmin(projectKey, context?.accountId);
    return;
  }
  await assertJiraAdmin();
};

export const getSettings = async () => {
  await assertJiraAdmin();
  const settings = await getGlobalSettings();
  return { settings };
};

export const saveSettings = async ({ payload }) => {
  await assertJiraAdmin();
  const timer = logger.timer('saveSettings');
  const validation = validateSettingsPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const settings = {
    enabled: payload.enabled,
    retentionDays: payload.retentionDays,
    timezone: payload.timezone.trim(),
    standupWindowTime: payload.standupWindowTime?.trim() ?? '09:00',
    skipWeekends: Boolean(payload.skipWeekends),
    weeklySummaryAuto: Boolean(payload.weeklySummaryAuto),
    blockerAlertDays: Number(payload.blockerAlertDays ?? 1),
    notifyProjectAdminsOnProblem: Boolean(payload.notifyProjectAdminsOnProblem),
  };

  await saveGlobalSettings(settings);
  timer.end({ action: 'saveSettings' });
  return { success: true, settings };
};

export const getTeamConfiguration = async ({ context } = {}) => {
  await assertTeamConfigAccess(context);
  const teamConfig = await getTeamConfig();
  return { teamConfig };
};

export const saveTeamConfiguration = async ({ payload, context }) => {
  await assertTeamConfigAccess(context);
  const timer = logger.timer('saveTeamConfiguration');
  const validation = validateTeamConfigPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const enabledProjects = [
    ...new Set(payload.enabledProjects.map((k) => String(k).trim().toUpperCase())),
  ];

  for (const projectKey of enabledProjects) {
    const exists = await validateProjectExists(projectKey);
    if (!exists) throw new Error(`Project ${projectKey} was not found.`);
  }

  const teamConfig = { enabledProjects };
  await saveTeamConfig(teamConfig);
  timer.end({ action: 'saveTeamConfiguration', count: enabledProjects.length });
  return { success: true, teamConfig };
};

export const getStandupDataMembers = async () => {
  const timer = logger.timer('getStandupDataMembers');
  await assertJiraAdmin();

  const entries = await queryAllEntries();
  const members = summarizeStandupMembers(entries);
  const avatars = await fetchUserAvatars(members.map((member) => member.accountId));

  timer.end({ action: 'getStandupDataMembers', count: members.length });
  return {
    members: members.map((member) => ({
      ...member,
      avatarUrl: avatars[member.accountId] ?? '',
    })),
  };
};

export const purgeMemberStandupData = async ({ payload }) => {
  const timer = logger.timer('purgeMemberStandupData');
  await assertJiraAdmin();
  const validation = validatePurgeMemberPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const result = await deleteEntriesByAccountId(payload.accountId);
  timer.end({ action: 'purgeMemberStandupData', accountId: payload.accountId, deleted: result.deleted });
  return { success: true, ...result };
};

export const exportStandupData = async () => {
  const timer = logger.timer('exportStandupData');
  await assertJiraAdmin();

  const [entries, settings, teamConfig] = await Promise.all([
    queryAllEntries(),
    getGlobalSettings(),
    getTeamConfig(),
  ]);

  const exportedAt = new Date().toISOString();
  const csv = buildStandupCsv(entries);
  const filename = standupExportFilename(exportedAt);

  timer.end({ action: 'exportStandupData', entryCount: entries.length });
  return {
    exportedAt,
    entryCount: entries.length,
    filename,
    csv,
    format: 'xlsx',
    settings,
    teamConfig,
  };
};

export const purgeStandupData = async ({ payload }) => {
  const timer = logger.timer('purgeStandupData');
  await assertJiraAdmin();
  const validation = validatePurgePayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const result = await purgeAllStandupEntries();
  timer.end({ action: 'purgeStandupData', deleted: result.deleted });
  return { success: true, ...result };
};
