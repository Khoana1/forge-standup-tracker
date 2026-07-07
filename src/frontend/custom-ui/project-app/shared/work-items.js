import { STANDUP_LABELS_SHORT } from '../../../../lib/labels.js';
import { escapeHtml } from './dom.js';
import { issueRowHtml } from './issues.js';

export const workItemsSectionsHtml = (entry, labels = STANDUP_LABELS_SHORT) => {
  const groups = entry.issueGroups ?? { tasks: [], progress: [], problems: [] };
  const byKey = Object.fromEntries((entry.issues ?? []).map((issue) => [issue.key, issue]));
  const blockerIssueKey = String(entry.blockerIssueKey ?? '')
    .trim()
    .toUpperCase();
  const problemResolved = Boolean(entry.blockerResolved);

  const section = (variant, labelText, keys) => {
    if (!keys?.length) return '';
    const issues = keys.map((key) => byKey[key]).filter(Boolean);
    if (!issues.length) return '';
    const resolvedNote =
      variant === 'problems' && problemResolved
        ? '<p class="work-items-resolved-note">Vấn đề đã được đánh dấu xử lý</p>'
        : '';
    const titleHtml = `<p class="work-items-title">Work item — <span class="work-items-label work-items-label--${variant}">${escapeHtml(labelText)}</span>${variant === 'problems' && problemResolved ? ' <span class="resolved-badge">Đã xử lý</span>' : ''}</p>`;
    const headerHtml =
      variant === 'problems'
        ? `<div class="work-items-header-card work-items-header-card--problems${problemResolved ? ' work-items-header-card--resolved' : ''}">${titleHtml}${resolvedNote}</div>`
        : `${titleHtml}${resolvedNote}`;
    return `
      <section class="work-items-section work-items-section--${variant}${variant === 'problems' && problemResolved ? ' work-items-section--resolved' : ''}">
        ${headerHtml}
        <div class="backlog-panel">
          <div class="issue-list" role="list">
            ${issues
              .map((issue) =>
                issueRowHtml(issue, {
                  readonly: true,
                  problemResolved:
                    variant === 'problems' &&
                    problemResolved &&
                    (issue.key.toUpperCase() === blockerIssueKey || !blockerIssueKey),
                })
              )
              .join('')}
          </div>
        </div>
      </section>
    `;
  };

  return [
    section('tasks', labels.tasks, groups.tasks),
    section('progress', labels.progress, groups.progress),
    section('problems', labels.problems, groups.problems),
  ].join('');
};
