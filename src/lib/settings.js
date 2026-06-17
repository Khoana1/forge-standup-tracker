import { kvs } from '@forge/kvs';
import { SETTINGS_KEY, TEAM_CONFIG_KEY } from './keys.js';

export const DEFAULT_SETTINGS = {
  enabled: true,
  retentionDays: 90,
  timezone: 'UTC',
  standupWindowTime: '09:00',
  skipWeekends: true,
  weeklySummaryAuto: false,
  blockerAlertDays: 1,
};

export const DEFAULT_TEAM_CONFIG = {
  enabledProjects: [],
};

const mergeSettings = (stored) => ({
  enabled: typeof stored?.enabled === 'boolean' ? stored.enabled : DEFAULT_SETTINGS.enabled,
  retentionDays:
    Number.isInteger(stored?.retentionDays) && stored.retentionDays >= 7
      ? stored.retentionDays
      : DEFAULT_SETTINGS.retentionDays,
  timezone:
    typeof stored?.timezone === 'string' && stored.timezone.trim()
      ? stored.timezone.trim()
      : DEFAULT_SETTINGS.timezone,
  standupWindowTime:
    typeof stored?.standupWindowTime === 'string' && stored.standupWindowTime.trim()
      ? stored.standupWindowTime.trim()
      : DEFAULT_SETTINGS.standupWindowTime,
  skipWeekends:
    typeof stored?.skipWeekends === 'boolean' ? stored.skipWeekends : DEFAULT_SETTINGS.skipWeekends,
  weeklySummaryAuto:
    typeof stored?.weeklySummaryAuto === 'boolean'
      ? stored.weeklySummaryAuto
      : DEFAULT_SETTINGS.weeklySummaryAuto,
  blockerAlertDays:
    Number.isInteger(stored?.blockerAlertDays) &&
    stored.blockerAlertDays >= 0 &&
    stored.blockerAlertDays <= 14
      ? stored.blockerAlertDays
      : DEFAULT_SETTINGS.blockerAlertDays,
});

export const getGlobalSettings = async () => {
  const stored = await kvs.get(SETTINGS_KEY);
  if (!stored) return { ...DEFAULT_SETTINGS };
  return mergeSettings(stored);
};

export const saveGlobalSettings = async (settings) => {
  await kvs.set(SETTINGS_KEY, settings);
  return settings;
};

export const getTeamConfig = async () => {
  const stored = await kvs.get(TEAM_CONFIG_KEY);
  if (!stored) return { ...DEFAULT_TEAM_CONFIG };
  const list = Array.isArray(stored.enabledProjects) ? stored.enabledProjects : [];
  return { enabledProjects: [...new Set(list.map((k) => String(k).trim().toUpperCase()))] };
};

export const saveTeamConfig = async (config) => {
  await kvs.set(TEAM_CONFIG_KEY, config);
  return config;
};

export const retentionCutoffDate = (retentionDays, referenceDate = new Date()) => {
  const d = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - retentionDays);
  return d.toISOString().slice(0, 10);
};
