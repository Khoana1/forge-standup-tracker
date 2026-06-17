import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('permissions');

/**
 * Check whether the calling user has a Jira permission in a project.
 * Uses api.asUser() so Jira evaluates the real user's roles — not app defaults.
 */
export const userHasProjectPermission = async (projectKey, permissionKey) => {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/mypermissions?projectKey=${projectKey}&permissions=${permissionKey}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      logger.warn('mypermissions request failed', {
        status: res.status,
        projectKey,
        permissionKey,
      });
      return false;
    }
    const data = await res.json();
    return Boolean(data.permissions?.[permissionKey]?.havePermission);
  } catch (err) {
    logger.warn('userHasProjectPermission error', { error: err.message, projectKey });
    return false;
  }
};

export const assertJiraAdmin = async () => {
  const allowed = await userHasGlobalPermission('ADMINISTER');
  if (!allowed) {
    throw new Error('Chỉ Jira admin mới được thực hiện thao tác này.');
  }
};

export const userHasGlobalPermission = async (permissionKey) => {
  try {
    const res = await api.asUser().requestJira(
      route`/rest/api/3/mypermissions?permissions=${permissionKey}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      logger.warn('global mypermissions failed', { status: res.status, permissionKey });
      return false;
    }
    const data = await res.json();
    return Boolean(data.permissions?.[permissionKey]?.havePermission);
  } catch (err) {
    logger.warn('userHasGlobalPermission error', { error: err.message });
    return false;
  }
};

export const assertProjectAdmin = async (projectKey) => {
  const allowed = await userHasProjectPermission(projectKey, 'ADMINISTER_PROJECTS');
  if (!allowed) {
    throw new Error('Bạn không có quyền thực hiện thao tác này trên project.');
  }
};

export const getMyProjectPermissions = async (projectKey) => {
  const [canAdministerProject, canBrowseProject] = await Promise.all([
    userHasProjectPermission(projectKey, 'ADMINISTER_PROJECTS'),
    userHasProjectPermission(projectKey, 'BROWSE_PROJECTS'),
  ]);
  return { canAdministerProject, canBrowseProject };
};
