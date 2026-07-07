import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('jira-users');

const ALLOWED_PROJECT_ROLE_PATTERNS = [/^(administrator?s?|members?)$/i];
const EXCLUDED_PROJECT_ROLE_PATTERNS = [/addon/i, /service desk/i, /customer/i, /^viewer?s?$/i];

export const isAllowedProjectRoleName = (roleName = '') => {
  const normalized = roleName.trim();
  if (!normalized) return false;
  if (EXCLUDED_PROJECT_ROLE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return ALLOWED_PROJECT_ROLE_PATTERNS.some((pattern) => pattern.test(normalized));
};

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

/**
 * Loads direct user actors from allowed Jira project roles (Member, Administrator).
 * Returns null when the caller lacks access so callers can fall back to standup history.
 */
export const fetchProjectRoleMembers = async (projectKey) => {
  try {
    const rolesRes = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}/role`, {
      headers: { Accept: 'application/json' },
    });
    if (!rolesRes.ok) {
      logger.warn('Could not fetch project roles', { projectKey, status: rolesRes.status });
      return null;
    }

    const roles = await rolesRes.json();
    const roleEntries = Object.entries(roles).filter(
      ([roleName, roleUrl]) => typeof roleUrl === 'string' && isAllowedProjectRoleName(roleName)
    );

    const memberMap = new Map();

    await Promise.all(
      roleEntries.map(async ([roleName, roleUrl]) => {
        const roleId = roleUrl.split('/').pop();
        if (!roleId) return;

        const roleRes = await api.asUser().requestJira(
          route`/rest/api/3/project/${projectKey}/role/${roleId}`,
          { headers: { Accept: 'application/json' } }
        );
        if (!roleRes.ok) {
          logger.warn('Could not fetch project role actors', {
            projectKey,
            roleName,
            status: roleRes.status,
          });
          return;
        }

        const roleData = await roleRes.json();
        for (const actor of roleData.actors ?? []) {
          if (actor.type !== 'atlassian-user-role-actor') continue;
          const accountId = actor.actorUser?.accountId;
          if (!accountId) continue;
          memberMap.set(accountId, {
            accountId,
            displayName: actor.displayName ?? actor.name ?? 'Team member',
          });
        }
      })
    );

    return [...memberMap.values()];
  } catch (err) {
    logger.warn('fetchProjectRoleMembers failed', { projectKey, error: err.message });
    return null;
  }
};

/**
 * Account IDs in the project's Administrator role (not Members).
 * Returns null when roles cannot be read.
 */
export const fetchProjectAdministratorIds = async (projectKey) => {
  try {
    const rolesRes = await api.asUser().requestJira(route`/rest/api/3/project/${projectKey}/role`, {
      headers: { Accept: 'application/json' },
    });
    if (!rolesRes.ok) return null;

    const roles = await rolesRes.json();
    const adminRole = Object.entries(roles).find(([roleName, roleUrl]) =>
      /^(administrator?s?)$/i.test(roleName.trim())
    );
    if (!adminRole?.[1]) return [];

    const roleId = String(adminRole[1]).split('/').pop();
    if (!roleId) return [];

    const roleRes = await api.asUser().requestJira(
      route`/rest/api/3/project/${projectKey}/role/${roleId}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!roleRes.ok) return null;

    const roleData = await roleRes.json();
    return (roleData.actors ?? [])
      .filter((actor) => actor.type === 'atlassian-user-role-actor')
      .map((actor) => actor.actorUser?.accountId)
      .filter(Boolean);
  } catch (err) {
    logger.warn('fetchProjectAdministratorIds failed', { projectKey, error: err.message });
    return null;
  }
};

/** Avatar URL map for account IDs (48x48). Missing users are omitted. */
export const fetchUserAvatars = async (accountIds = []) => {
  const unique = [...new Set((accountIds ?? []).filter(Boolean))];
  if (!unique.length) return {};

  const avatars = {};
  await Promise.all(
    unique.map(async (accountId) => {
      try {
        const res = await api.asUser().requestJira(route`/rest/api/3/user?accountId=${accountId}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        const url = data?.avatarUrls?.['48x48'] ?? data?.avatarUrls?.['32x32'] ?? '';
        if (url) avatars[accountId] = url;
      } catch (err) {
        logger.warn('fetchUserAvatar failed', { accountId, error: err.message });
      }
    })
  );
  return avatars;
};
