import { createLogger } from '../lib/logger.js';
import {
  fetchIssuesByKeys,
  searchProjectIssues,
  transitionIssueStatus,
} from '../lib/jira-issues.js';
import { validateProjectExists } from '../lib/jira-users.js';
import { persistStandupSubmission } from '../lib/standup-submit.js';
import { queryProjectEntries } from '../lib/standup-store.js';
import {
  validateIssueHistoryPayload,
  validateIssueSearchPayload,
  validateSubmitStandupPayload,
} from '../lib/validators.js';
import { assertProjectAllowed } from './standup.js';

const logger = createLogger('issue-panel-resolver');

export const searchIssuesForLink = async ({ payload }) => {
  const validation = validateIssueSearchPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey, query } = payload;
  await assertProjectAllowed(projectKey);

  const issues = await searchProjectIssues(projectKey, query);
  return { issues };
};

export const getIssueStandupHistory = async ({ payload }) => {
  const validation = validateIssueHistoryPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey, issueKey } = payload;
  const normalizedKey = issueKey.trim().toUpperCase();
  await assertProjectAllowed(projectKey);

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(`${today}T12:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const from = fromDate.toISOString().slice(0, 10);

  const entries = await queryProjectEntries(projectKey, from, today);
  const related = entries
    .filter(
      (e) =>
        e.contextIssueKey === normalizedKey ||
        (e.linkedIssueKeys ?? []).includes(normalizedKey)
    )
    .sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    })
    .slice(0, 10);

  return { entries: related, issueKey: normalizedKey };
};

export const submitIssueStandup = async ({ payload, context }) => {
  const timer = logger.timer('submitIssueStandup');
  const { accountId } = context ?? {};
  if (!accountId) throw new Error('User context is required.');

  const validation = validateSubmitStandupPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey, date } = validation;
  await assertProjectAllowed(projectKey);

  const exists = await validateProjectExists(projectKey);
  if (!exists) throw new Error(`Project ${projectKey} was not found.`);

  const contextIssueKey = payload.contextIssueKey?.trim().toUpperCase() ?? null;
  const linkedIssueKeys = [
    ...(payload.linkedIssueKeys ?? []).map((k) => k.trim().toUpperCase()),
    ...(contextIssueKey ? [contextIssueKey] : []),
  ];

  const result = await persistStandupSubmission({
    payload,
    context,
    validation,
    entryOverrides: {
      linkedIssueKeys: [...new Set(linkedIssueKeys)],
      contextIssueKey,
    },
  });

  timer.end({ action: 'submitIssueStandup', projectKey, contextIssueKey });
  return result;
};

export const enrichLinkedIssues = async ({ payload }) => {
  const { issueKeys } = payload ?? {};
  const keys = Array.isArray(issueKeys) ? issueKeys : [];
  const issues = await fetchIssuesByKeys(keys);
  return { issues };
};

export const updateIssueStatus = async ({ payload }) => {
  const { issueKey, statusCategory } = payload ?? {};

  if (!issueKey || typeof issueKey !== 'string') {
    throw new Error('issueKey is required.');
  }

  if (!statusCategory || !['new', 'indeterminate', 'done'].includes(statusCategory)) {
    throw new Error('Valid statusCategory is required (new, indeterminate, done).');
  }

  const result = await transitionIssueStatus(issueKey, statusCategory);

  if (!result.success) {
    throw new Error(result.error ?? 'Không thể cập nhật status.');
  }

  return { success: true, statusName: result.transitionName };
};
