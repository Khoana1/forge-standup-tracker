import api, { route } from '@forge/api';
import { createLogger } from './logger.js';

const logger = createLogger('jira-issues');

const escapeJqlString = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

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
        fields: ['summary', 'status'],
      }),
    });

    if (!res.ok) {
      logger.warn('Issue search failed', { status: res.status, projectKey });
      return [];
    }

    const data = await res.json();
    return (data.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      status: issue.fields?.status?.name ?? '',
    }));
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
        fields: ['summary', 'status'],
      }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.issues ?? []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary ?? '',
      status: issue.fields?.status?.name ?? '',
    }));
  } catch {
    return [];
  }
};
