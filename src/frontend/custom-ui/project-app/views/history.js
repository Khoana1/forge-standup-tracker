import { invoke } from '@forge/bridge';
import { extractPlainText } from '../../../../lib/adf-helpers.js';
import { addDaysIso, isoToDisplay, todayIso } from '../../../../lib/dates.js';
import { STANDUP_TABLE_HEADERS, formatTeamSyncTitle } from '../../../../lib/labels.js';
import { hadBlockerContent, hasActiveBlocker } from '../../../../lib/blockers.js';
import { groupStandupLinkedIssues } from '../../../../lib/standup-issues.js';
import { escapeHtml, formatTime } from '../shared/dom.js';
import { loadAvatars, userAvatarHtml } from '../shared/avatars.js';
import { bindIssueOpen, enrichIssues } from '../shared/issues.js';
import { workItemsSectionsHtml } from '../shared/work-items.js';

const statusCardHtml = (variant, label, text, { resolved = false, resolution = '' } = {}) => {
  if (!text?.trim()) return '';
  const resolvedBadge = resolved
    ? '<span class="resolved-badge" title="Vấn đề đã được đánh dấu xử lý">Đã xử lý</span>'
    : '';
  const resolutionHtml =
    resolved && resolution?.trim()
      ? `<p class="resolution-note"><span class="resolution-label">Phương án:</span> ${escapeHtml(resolution)}</p>`
      : '';
  return `
    <div class="status-card status-card--${variant}${resolved ? ' status-card--problems-resolved' : ''}">
      <span class="status-label">${escapeHtml(label)}${resolvedBadge}</span>
      <p class="status-text">${escapeHtml(text)}</p>
      ${resolutionHtml}
    </div>
  `;
};

const historyEntryHtml = (entry, labels, avatars) => {
  const time = formatTime(entry.createdAt);
  const yesterday = extractPlainText(entry.yesterday);
  const today = extractPlainText(entry.today);
  const blockers = extractPlainText(entry.blockers);
  const hasBlocker = hasActiveBlocker(entry.blockers, entry.blockerResolved);
  const issueGroups = groupStandupLinkedIssues(entry);

  return `
    <article class="entry-card history-entry">
      <header class="entry-header">
        <div class="entry-header-main">
          ${userAvatarHtml(entry.accountId, entry.displayName, avatars[entry.accountId] ?? '', 'entry-avatar')}
          <span class="entry-name">${escapeHtml(entry.displayName)}</span>
        </div>
        <time class="entry-time">${escapeHtml(time || entry.dateDisplay || '')}</time>
      </header>
      <div class="status-panel">
        <div class="status-grid">
          ${yesterday ? statusCardHtml('tasks', labels.tasks, yesterday) : ''}
          ${today ? statusCardHtml('progress', labels.progress, today) : ''}
          ${
            hasBlocker
              ? statusCardHtml('problems', labels.problems, blockers)
              : entry.blockerResolved && hadBlockerContent(entry.blockers)
                ? statusCardHtml('problems', labels.problems, blockers, {
                    resolved: true,
                    resolution: entry.blockerResolution ?? '',
                  })
                : ''
          }
        </div>
      </div>
      <div class="history-issues"
           data-tasks="${escapeHtml(issueGroups.tasks.join(','))}"
           data-progress="${escapeHtml(issueGroups.progress.join(','))}"
           data-problems="${escapeHtml(issueGroups.problems.join(','))}"
           data-blocker-resolved="${entry.blockerResolved ? '1' : '0'}"
           data-blocker-issue-key="${escapeHtml(entry.blockerIssueKey ?? '')}"></div>
    </article>
  `;
};

export async function renderHistory(container, ctx) {
  const { projectKey, sprintName } = ctx;
  if (!ctx.historyFrom) ctx.historyFrom = addDaysIso(todayIso(), -14);
  if (!ctx.historyTo) ctx.historyTo = todayIso();

  container.innerHTML = `
    <div class="page history-page">
      <header class="page-header">
        <div>
          <h2 class="page-title">Lịch sử · ${escapeHtml(formatTeamSyncTitle(sprintName))}</h2>
          <p class="page-subtitle">Xem lại các bản ghi Team Sync theo khoảng ngày.</p>
        </div>
      </header>
      <div class="filter-card">
        <div class="filter-row">
          <label>Từ ngày <input type="date" id="from-date" value="${escapeHtml(ctx.historyFrom)}" /></label>
          <label>Đến ngày <input type="date" id="to-date" value="${escapeHtml(ctx.historyTo)}" /></label>
          <button type="button" class="btn btn-primary" id="apply-history">Áp dụng</button>
        </div>
      </div>
      <div id="history-content"><div class="page-loading">Đang tải lịch sử…</div></div>
    </div>
  `;

  const load = async () => {
    const content = container.querySelector('#history-content');
    if (!content) return;
    content.innerHTML = '<div class="page-loading">Đang tải lịch sử…</div>';
    try {
      const result = await invoke('getTeamHistory', {
        projectKey,
        fromDate: ctx.historyFrom,
        toDate: ctx.historyTo,
      });
      const entries = result?.entries ?? [];
      if (!entries.length) {
        content.innerHTML = `<div class="empty-state"><h4>Chưa có bản ghi</h4><p>Thử chọn khoảng ngày rộng hơn.</p></div>`;
        return;
      }
      const grouped = new Map();
      for (const entry of entries) {
        if (!grouped.has(entry.date)) grouped.set(entry.date, []);
        grouped.get(entry.date).push(entry);
      }
      const labels = STANDUP_TABLE_HEADERS;
      const avatars = await loadAvatars(entries.map((e) => e.accountId));
      content.innerHTML = [...grouped.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(
          ([date, dayEntries]) => `
          <section class="history-day">
            <h3 class="section-title">${escapeHtml(isoToDisplay(date))}</h3>
            <div class="timeline">
              ${dayEntries
                .map((entry) =>
                  historyEntryHtml(
                    { ...entry, dateDisplay: isoToDisplay(entry.date) },
                    labels,
                    avatars
                  )
                )
                .join('')}
            </div>
          </section>`
        )
        .join('');

      bindIssueOpen(content);

      for (const slot of content.querySelectorAll('.history-issues')) {
        const issueGroups = {
          tasks: (slot.dataset.tasks ?? '').split(',').filter(Boolean),
          progress: (slot.dataset.progress ?? '').split(',').filter(Boolean),
          problems: (slot.dataset.problems ?? '').split(',').filter(Boolean),
        };
        const allKeys = [
          ...new Set([...issueGroups.tasks, ...issueGroups.progress, ...issueGroups.problems]),
        ];
        if (!allKeys.length) {
          slot.remove();
          continue;
        }
        const issues = await enrichIssues(allKeys.map((key) => ({ key, url: '' })));
        slot.innerHTML = workItemsSectionsHtml(
          {
            issueGroups,
            issues,
            blockerResolved: slot.dataset.blockerResolved === '1',
            blockerIssueKey: slot.dataset.blockerIssueKey ?? '',
          },
          labels
        );
      }
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${escapeHtml(e?.message ?? 'Không tải được lịch sử.')}</div>`;
    }
  };

  container.querySelector('#apply-history')?.addEventListener('click', () => {
    ctx.historyFrom = container.querySelector('#from-date')?.value ?? ctx.historyFrom;
    ctx.historyTo = container.querySelector('#to-date')?.value ?? ctx.historyTo;
    load();
  });

  await load();
}
