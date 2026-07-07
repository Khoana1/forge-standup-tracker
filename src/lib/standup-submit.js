import { extractPlainText } from './adf-helpers.js';
import { fetchMyDisplayName } from './jira-users.js';
import { notifyProblemIfNeeded } from './problem-notify.js';
import { getGlobalSettings } from './settings.js';
import { getStandupEntry, saveStandupEntry } from './standup-store.js';

export const persistStandupSubmission = async ({ payload, context, validation, entryOverrides = {} }) => {
  const accountId = context?.accountId;
  if (!accountId) throw new Error('User context is required.');

  const { projectKey, date } = validation;
  const existing = await getStandupEntry(projectKey, date, accountId);
  const [displayName, settings] = await Promise.all([fetchMyDisplayName(), getGlobalSettings()]);

  const linkedFromPayload = Array.isArray(payload.linkedIssueKeys)
    ? [...new Set(payload.linkedIssueKeys.map((key) => key.trim().toUpperCase()))]
    : null;

  const entry = {
    accountId,
    displayName,
    projectKey,
    date,
    yesterday: typeof payload.yesterday === 'string' ? payload.yesterday.trim() : '',
    today: typeof payload.today === 'string' ? payload.today.trim() : '',
    blockers: typeof payload.blockers === 'string' ? payload.blockers.trim() : '',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    linkedIssueKeys:
      entryOverrides.linkedIssueKeys ??
      linkedFromPayload ??
      existing?.linkedIssueKeys ??
      [],
    contextIssueKey: entryOverrides.contextIssueKey ?? existing?.contextIssueKey ?? null,
    blockerResolved: existing?.blockerResolved ?? false,
    blockerIssueKey: existing?.blockerIssueKey ?? null,
  };

  const saved = await saveStandupEntry(entry);
  const problemNotification = await notifyProblemIfNeeded({
    entry,
    existingEntry: existing,
    settings,
  });

  return {
    success: true,
    entry: saved,
    problemNotification,
  };
};
