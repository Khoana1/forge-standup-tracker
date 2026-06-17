import { assertJiraAdmin } from '../lib/permissions.js';
import { createLogger } from '../lib/logger.js';
import { validateProjectExists } from '../lib/jira-users.js';
import {
  getGlobalSettings,
  getTeamConfig,
  saveGlobalSettings,
  saveTeamConfig,
} from '../lib/settings.js';
import {
  purgeAllStandupEntries,
  queryAllEntries,
} from '../lib/standup-store.js';
import {
  validatePurgePayload,
  validateSettingsPayload,
  validateTeamConfigPayload,
} from '../lib/validators.js';

const logger = createLogger('admin-resolver');

export const getSettings = async () => {
  const settings = await getGlobalSettings();
  return { settings };
};

export const saveSettings = async ({ payload }) => {
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
  };

  await saveGlobalSettings(settings);
  timer.end({ action: 'saveSettings' });
  return { success: true, settings };
};

export const getTeamConfiguration = async () => {
  const teamConfig = await getTeamConfig();
  return { teamConfig };
};

export const saveTeamConfiguration = async ({ payload }) => {
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

export const exportStandupData = async () => {
  const timer = logger.timer('exportStandupData');
  await assertJiraAdmin();

  const [entries, settings, teamConfig] = await Promise.all([
    queryAllEntries(),
    getGlobalSettings(),
    getTeamConfig(),
  ]);

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    settings,
    teamConfig,
    entryCount: entries.length,
    entries: entries.map(({ key, ...rest }) => ({ id: key, ...rest })),
  };

  timer.end({ action: 'exportStandupData', entryCount: entries.length });
  return exportPayload;
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
