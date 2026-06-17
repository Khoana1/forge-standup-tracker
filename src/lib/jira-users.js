import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('jira-users');

export const fetchMyDisplayName = async () => {
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/myself`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      logger.warn('Could not fetch display name', { status: res.status });
      return 'Unknown user';
    }
    const data = await res.json();
    return data.displayName ?? 'Unknown user';
  } catch (err) {
    logger.warn('fetchMyDisplayName failed', { error: err.message });
    return 'Unknown user';
  }
};

export const validateProjectExists = async (projectKey) => {
  const res = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}`, {
    headers: { Accept: 'application/json' },
  });
  if (res.status === 404) return false;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Project validation failed: HTTP ${res.status} — ${body.slice(0, 120)}`);
  }
  return true;
};
