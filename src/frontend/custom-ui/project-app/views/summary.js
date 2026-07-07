import { invoke } from '@forge/bridge';
import { extractPlainText } from '../../../../lib/adf-helpers.js';
import { isoToDisplay, mondayOfWeekIso } from '../../../../lib/dates.js';
import { STANDUP_TABLE_HEADERS, formatTeamSyncTitle } from '../../../../lib/labels.js';
import { SPRINT_SUMMARY_WEEKS } from '../../../../lib/summary.js';
import { escapeHtml } from '../shared/dom.js';
import { loadAvatars, userAvatarHtml } from '../shared/avatars.js';

const hasRealBlocker = (text) => {
  const lower = extractPlainText(text).toLowerCase();
  return lower.length > 0 && !['none', 'không có', 'khong co', 'n/a'].includes(lower);
};

const summaryEntryHtml = (entry, labels, avatars) => {
  const yesterday = extractPlainText(entry.yesterday);
  const today = extractPlainText(entry.today);
  const blockers = extractPlainText(entry.blockers);
  const hasBlocker = hasRealBlocker(entry.blockers);
  return `
    <article class="entry-card summary-entry">
      <header class="entry-header">
        <div class="entry-header-main">
          ${userAvatarHtml(entry.accountId, entry.displayName, avatars[entry.accountId] ?? '', 'entry-avatar')}
          <span class="entry-name">${escapeHtml(entry.displayName)}</span>
        </div>
      </header>
      <div class="status-panel">
        <div class="status-grid">
          ${yesterday ? `<div class="status-card status-card--tasks"><span class="status-label">${escapeHtml(labels.tasks)}</span><p class="status-text">${escapeHtml(yesterday)}</p></div>` : ''}
          ${today ? `<div class="status-card status-card--progress"><span class="status-label">${escapeHtml(labels.progress)}</span><p class="status-text">${escapeHtml(today)}</p></div>` : ''}
          ${hasBlocker ? `<div class="status-card status-card--problems"><span class="status-label">${escapeHtml(labels.problems)}</span><p class="status-text">${escapeHtml(blockers)}</p></div>` : ''}
        </div>
      </div>
    </article>
  `;
};

const defaultSprintStart = (ctx) =>
  ctx.sprintStart ?? ctx.activeSprintStart ?? mondayOfWeekIso();

export async function renderSummary(container, ctx) {
  const { projectKey, sprintName } = ctx;
  if (!ctx.sprintStart) ctx.sprintStart = defaultSprintStart(ctx);

  container.innerHTML = `
    <div class="page summary-page">
      <header class="page-header">
        <div>
          <h2 class="page-title">Tổng kết sprint · ${escapeHtml(formatTeamSyncTitle(sprintName))}</h2>
          <p class="page-subtitle">Tổng hợp Team Sync trong ${SPRINT_SUMMARY_WEEKS} tuần. Chọn ngày bắt đầu sprint, rồi bấm «Xem tổng kết».</p>
        </div>
      </header>
      <div class="filter-card">
        <label>Ngày bắt đầu sprint
          <input type="date" id="sprint-start" value="${escapeHtml(ctx.sprintStart)}" />
        </label>
        <button type="button" class="btn btn-primary" id="generate-summary">Xem tổng kết</button>
      </div>
      <div id="summary-content"></div>
    </div>
  `;

  const renderResult = async (summary) => {
    const content = container.querySelector('#summary-content');
    if (!content || !summary) return;
    const labels = STANDUP_TABLE_HEADERS;
    const allEntries = (summary.days ?? []).flatMap((day) => day.entries ?? []);
    const avatars = await loadAvatars(allEntries.map((e) => e.accountId));
    const startDate = summary.sprintStartDate ?? summary.weekStartDate;
    const endDate = summary.sprintEndDate ?? startDate;
    content.innerHTML = `
      <div class="alert alert-info">
        Sprint ${escapeHtml(isoToDisplay(startDate))} – ${escapeHtml(isoToDisplay(endDate))} · ${SPRINT_SUMMARY_WEEKS} tuần · ${summary.totalEntries} bản ghi · ${summary.blockerCount} có vấn đề
      </div>
      ${(summary.days ?? [])
        .map(
          (day) => `
        <section class="history-day">
          <h3 class="section-title">${escapeHtml(isoToDisplay(day.date))}</h3>
          ${
            day.entries.length === 0
              ? '<p class="status-empty">Chưa có bản ghi Team Sync.</p>'
              : `<div class="timeline">${day.entries.map((entry) => summaryEntryHtml(entry, labels, avatars)).join('')}</div>`
          }
        </section>`
        )
        .join('')}
    `;
  };

  const generate = async () => {
    const content = container.querySelector('#summary-content');
    if (!content) return;
    content.innerHTML = '<div class="page-loading">Đang tạo tổng kết…</div>';
    ctx.sprintStart = container.querySelector('#sprint-start')?.value ?? ctx.sprintStart;
    try {
      const summary = await invoke('getWeeklySummary', {
        projectKey,
        sprintStartDate: ctx.sprintStart,
      });
      ctx.summary = summary;
      await renderResult(summary);
    } catch (e) {
      content.innerHTML = `<div class="alert alert-error">${escapeHtml(e?.message ?? 'Không tạo được tổng kết sprint.')}</div>`;
    }
  };

  container.querySelector('#generate-summary')?.addEventListener('click', generate);

  if (!ctx.summary) {
    container.querySelector('#summary-content').innerHTML = `
      <div class="empty-state">
        <h4>Chưa có tổng kết</h4>
        <p>Chọn ngày bắt đầu sprint (${SPRINT_SUMMARY_WEEKS} tuần) và bấm «Xem tổng kết».</p>
      </div>`;
  } else {
    await renderResult(ctx.summary);
  }
}
