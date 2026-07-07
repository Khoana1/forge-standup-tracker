import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('jira-issues');

const mapIssueSummary = (issue) => ({
  key: issue.key,
  summary: issue.fields?.summary ?? '',
  status: issue.fields?.status?.name ?? '',
  statusCategory: issue.fields?.status?.statusCategory?.key ?? 'new',
  issueType: issue.fields?.issuetype?.name ?? '',
  issueTypeIconUrl: issue.fields?.issuetype?.iconUrl ?? '',
});

const escapeJqlString = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Latest issue in project — used as anchor for Jira email notify API. */
export const findLatestProjectIssueKey = async (projectKey) => {
  const jql = `project = "${escapeJqlString(projectKey)}" ORDER BY updated DESC`;
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql,
        maxResults: 1,
        fields: ['summary'],
      }),
    });

    if (!res.ok) {
      logger.warn('findLatestProjectIssueKey failed', { projectKey, status: res.status });
      return null;
    }

    const data = await res.json();
    return data.issues?.[0]?.key ?? null;
  } catch (err) {
    logger.warn('findLatestProjectIssueKey error', { projectKey, error: err.message });
    return null;
  }
};

export const searchProjectIssues = async (projectKey, query, maxResults = 8) => {
  const trimmed = (query ?? '').trim();
  if (!trimmed) return [];

  const upper = trimmed.toUpperCase();
  let jql = `project = "${escapeJqlString(projectKey)}" AND (`;
  if (/^[A-Z][A-Z0-9]+-\d+$/.test(upper)) {
    jql += `key = "${escapeJqlString(upper)}" OR `;
  }
  jql += `summary ~ "${escapeJqlString(trimmed)}" OR text ~ "${escapeJqlString(trimmed)}") ORDER BY updated DESC`;

  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql,
        maxResults,
        fields: ['summary', 'status', 'issuetype'],
      }),
    });

    if (!res.ok) {
      logger.warn('Issue search failed', { status: res.status, projectKey });
      return [];
    }

    const data = await res.json();
    return (data.issues ?? []).map(mapIssueSummary);
  } catch (err) {
    logger.warn('searchProjectIssues error', { error: err.message });
    return [];
  }
};

export const fetchIssuesByKeys = async (keys) => {
  const unique = [...new Set((keys ?? []).map((k) => String(k).trim().toUpperCase()).filter(Boolean))];
  if (!unique.length) return [];

  const jql = `key in (${unique.map((k) => `"${escapeJqlString(k)}"`).join(', ')})`;
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jql,
        maxResults: unique.length,
        fields: ['summary', 'status', 'issuetype'],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.issues ?? []).map(mapIssueSummary);
  } catch {
    return [];
  }
};

const STATUS_CATEGORY_TO_NAME = {
  new: ['To Do', 'To do', 'Backlog', 'Open'],
  indeterminate: ['In Progress', 'In progress', 'In Development', 'Doing'],
  done: ['Done', 'Closed', 'Resolved', 'Complete'],
};

export const transitionIssueStatus = async (issueKey, targetStatusCategory) => {
  try {
    // Get available transitions
    const transitionsRes = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/transitions`,
      {
        headers: { Accept: 'application/json' },
      }
    );

    if (!transitionsRes.ok) {
      logger.warn('Failed to get transitions', { issueKey, status: transitionsRes.status });
      return { success: false, error: 'Không lấy được transitions có sẵn.' };
    }

    const transitionsData = await transitionsRes.json();
    const transitions = transitionsData.transitions ?? [];

    // Find transition matching target category
    const possibleNames = STATUS_CATEGORY_TO_NAME[targetStatusCategory] ?? [];
    const targetTransition = transitions.find(
      (t) =>
        t.to?.statusCategory?.key === targetStatusCategory ||
        possibleNames.some((name) => t.to?.name === name || t.name === name)
    );

    if (!targetTransition) {
      logger.info('No matching transition found', {
        issueKey,
        targetStatusCategory,
        availableTransitions: transitions.map((t) => t.name),
      });
      return {
        success: false,
        error: `Không tìm thấy transition phù hợp cho status "${targetStatusCategory}".`,
      };
    }

    // Perform transition
    const transitionRes = await api.asUser().requestJira(
      route`/rest/api/3/issue/${issueKey}/transitions`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transition: { id: targetTransition.id },
        }),
      }
    );

    if (!transitionRes.ok) {
      const errorBody = await transitionRes.text().catch(() => '');
      logger.warn('Transition failed', {
        issueKey,
        status: transitionRes.status,
        body: errorBody.slice(0, 240),
      });
      return { success: false, error: 'Không thể chuyển đổi status.' };
    }

    return { success: true, transitionName: targetTransition.to?.name ?? targetTransition.name };
  } catch (err) {
    logger.error('transitionIssueStatus error', { issueKey, error: err.message });
    return { success: false, error: err.message };
  }
};
