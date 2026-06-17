import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('jira-sprint');

export const fetchActiveSprint = async (projectKey) => {
  if (!projectKey) return null;

  try {
    const boardsRes = await api.asUser().requestJira(
      route`/rest/agile/1.0/board?projectKeyOrId=${projectKey}`
    );
    if (!boardsRes.ok) {
      logger.warn('Board lookup failed', { status: boardsRes.status, projectKey });
      return null;
    }

    const boardsData = await boardsRes.json();
    const board = boardsData.values?.[0];
    if (!board?.id) return null;

    const sprintRes = await api.asUser().requestJira(
      route`/rest/agile/1.0/board/${board.id}/sprint?state=active`
    );
    if (!sprintRes.ok) {
      logger.warn('Active sprint lookup failed', { status: sprintRes.status, projectKey });
      return null;
    }

    const sprintData = await sprintRes.json();
    const sprint = sprintData.values?.[0];
    if (!sprint?.name) return null;

    return {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      startDate: sprint.startDate ?? null,
      endDate: sprint.endDate ?? null,
    };
  } catch (err) {
    logger.warn('fetchActiveSprint error', { error: err.message, projectKey });
    return null;
  }
};
