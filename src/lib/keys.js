export const SETTINGS_KEY = 'app-settings:global';
export const TEAM_CONFIG_KEY = 'app-settings:teams';

/** Entity key: standup:{projectKey}:{date}:{accountId} */
export const standupEntryKey = (projectKey, date, accountId) =>
  `standup:${projectKey}:${date}:${accountId}`;

export const isValidProjectKey = (value) =>
  typeof value === 'string' && /^[A-Z][A-Z0-9]+$/.test(value.trim());

export const isValidDateKey = (value) =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
