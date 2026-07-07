import api, { route } from '@forge/api';
import { extractPlainText } from './adf-helpers.js';
import { hasActiveBlocker } from './blockers.js';
import { findLatestProjectIssueKey } from './jira-issues.js';
import { fetchProjectAdministratorIds } from './jira-users.js';
import { createLogger } from './logger.js';

const logger = createLogger('problem-notify');

/** Notify when a new problem appears or the problem text changes while still active. */
export const shouldNotifyProjectAdminsOnProblem = ({ entry, existingEntry }) => {
  if (!hasActiveBlocker(entry.blockers, entry.blockerResolved)) return false;

  const prevText = extractPlainText(existingEntry?.blockers ?? '').trim();
  const nextText = extractPlainText(entry.blockers).trim();
  const hadPrev = hasActiveBlocker(existingEntry?.blockers, existingEntry?.blockerResolved);

  if (!hadPrev) return true;
  return prevText !== nextText;
};

const buildNotificationBodies = ({
  projectKey,
  reporterName,
  standupDate,
  problemText,
  tasks,
  progress,
}) => {
  const lines = [
    'Team Sync — có vấn đề (Problems) mới cần quan tâm.',
    '',
    `Project: ${projectKey}`,
    `Ngày: ${standupDate}`,
    `Thành viên: ${reporterName}`,
    '',
    'Problems:',
    problemText,
    '',
    'Tasks:',
    tasks || '—',
    '',
    'Progress:',
    progress || '—',
    '',
    'Xử lý và đánh dấu đã xử lý trong Team Sync → Tổng quan team.',
  ];

  const textBody = lines.join('\n');
  const htmlBody = lines.map((line) => (line ? escapeHtml(line) : '<br/>')).join('<br/>');
  const subject = `[Team Sync] Vấn đề mới — ${projectKey} (${standupDate})`;

  return { subject, textBody, htmlBody };
};

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Sends Jira email notifications to project Administrators via issue notify API.
 * Requires at least one issue in the project as a delivery anchor.
 */
export const notifyProjectAdminsAboutProblem = async ({
  projectKey,
  reporterName,
  reporterAccountId,
  standupDate,
  problemText,
  tasks,
  progress,
}) => {
  const adminIds = (await fetchProjectAdministratorIds(projectKey)) ?? [];
  const recipients = [...new Set(adminIds.filter(Boolean))];

  if (!recipients.length) {
    logger.info('notify skipped: no project administrators', { projectKey });
    return { sent: 0, skipped: 'no_recipients' };
  }

  const issueKey = await findLatestProjectIssueKey(projectKey);
  if (!issueKey) {
    logger.warn('notify skipped: no reference issue in project', { projectKey });
    return { sent: 0, skipped: 'no_issue' };
  }

  const { subject, textBody, htmlBody } = buildNotificationBodies({
    projectKey,
    reporterName,
    standupDate,
    problemText,
    tasks,
    progress,
  });

  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/notify`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        textBody,
        htmlBody,
        to: {
          users: recipients.map((accountId) => ({ accountId })),
        },
      }),
    });

    if (res.status !== 204 && !res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn('problem notify failed', {
        projectKey,
        issueKey,
        status: res.status,
        body: body.slice(0, 240),
        reporterAccountId,
      });
      return { sent: 0, skipped: 'notify_failed' };
    }

    logger.info('problem notify queued', {
      projectKey,
      issueKey,
      recipientCount: recipients.length,
    });
    return { sent: recipients.length, issueKey };
  } catch (err) {
    logger.warn('notifyProjectAdminsAboutProblem error', {
      projectKey,
      error: err.message,
    });
    return { sent: 0, skipped: 'notify_error' };
  }
};

export const notifyProblemIfNeeded = async ({ entry, existingEntry, settings }) => {
  if (!settings?.notifyProjectAdminsOnProblem) {
    return { sent: 0, skipped: 'disabled' };
  }

  if (!shouldNotifyProjectAdminsOnProblem({ entry, existingEntry })) {
    return { sent: 0, skipped: 'not_needed' };
  }

  return notifyProjectAdminsAboutProblem({
    projectKey: entry.projectKey,
    reporterName: entry.displayName,
    reporterAccountId: entry.accountId,
    standupDate: entry.date,
    problemText: extractPlainText(entry.blockers),
    tasks: extractPlainText(entry.yesterday),
    progress: extractPlainText(entry.today),
  });
};
