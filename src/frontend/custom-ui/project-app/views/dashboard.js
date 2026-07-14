import { invoke } from '@forge/bridge';
import { extractPlainText } from '../../../../lib/adf-helpers.js';
import { isoToDayMonth, isoToDisplay } from '../../../../lib/dates.js';
import { STANDUP_LABELS_SHORT } from '../../../../lib/labels.js';
import { hadBlockerContent } from '../../../../lib/blockers.js';
import { groupStandupLinkedIssues } from '../../../../lib/standup-issues.js';
import { escapeHtml, formatTime, downloadExcelFromCsv } from '../shared/dom.js';
import { userAvatarHtml } from '../shared/avatars.js';
import { bindIssueOpen, enrichIssues } from '../shared/issues.js';
import { workItemsSectionsHtml } from '../shared/work-items.js';
import { dashboardStatsHtml, progressBarHtml } from '../shared/progress.js';

const ageLabel = (blocker) => {
  if (blocker.isToday) return 'Hôm nay';
  if (blocker.ageDays === 1) return 'Hôm qua';
  return `${blocker.ageDays} ngày trước`;
};

const openBlockerCardHtml = (blocker, canAdminister, avatars) => {
  const text = extractPlainText(blocker.blockers);
  const statusClass = blocker.isStale ? 'is-stale' : blocker.isToday ? 'is-new' : 'is-open';
  const ageBadge = blocker.isStale
    ? '<span class="blocker-badge blocker-badge--stale">Quá hạn</span>'
    : blocker.isToday
      ? '<span class="blocker-badge blocker-badge--new">Mới</span>'
      : `<span class="blocker-badge blocker-badge--age">${escapeHtml(ageLabel(blocker))}</span>`;
  const typeBadge = blocker.typeLabel
    ? `<span class="blocker-badge blocker-badge--type">${escapeHtml(blocker.typeLabel)}</span>`
    : '';

  const issueKeys = (blocker.linkedIssueKeys ?? [])
    .map(
      (key) =>
        `<button type="button" class="issue-pill" data-open="${escapeHtml(key)}">${escapeHtml(key)}</button>`
    )
    .join('');

  return `
    <article class="blocker-card ${statusClass}" data-blocker-key="${escapeHtml(blocker.key)}">
      <div class="blocker-card-accent" aria-hidden="true"></div>
      <div class="blocker-card-body">
        <div class="blocker-card-top">
          <div class="blocker-card-badges">${ageBadge}${typeBadge}</div>
          <p class="blocker-card-text">${escapeHtml(text)}</p>
          ${issueKeys ? `<div class="blocker-card-issues">${issueKeys}</div>` : ''}
        </div>
        <div class="blocker-card-divider" aria-hidden="true"></div>
        <div class="blocker-card-bottom">
          <div class="blocker-card-meta">
            ${userAvatarHtml(blocker.accountId, blocker.displayName, avatars?.[blocker.accountId] ?? '', 'entry-avatar')}
            <div class="blocker-card-meta-text">
              <span class="blocker-card-author">${escapeHtml(blocker.displayName)}</span>
              <span class="blocker-card-date">${escapeHtml(isoToDisplay(blocker.date))} · ${escapeHtml(ageLabel(blocker))}</span>
            </div>
          </div>
          ${
            canAdminister
              ? `<button type="button" class="btn btn-resolve-compact" data-resolve-blocker="${escapeHtml(blocker.key)}">Đánh dấu đã xử lý</button>`
              : ''
          }
        </div>
      </div>
    </article>
  `;
};

const openBlockersSectionHtml = (blockers, summary, canAdminister, avatars) => {
  if (!blockers.length) return '';

  const staleHint =
    (summary?.stale ?? 0) > 0
      ? `<div class="alert alert-warning"><p><strong>Có ${summary.stale} vấn đề quá hạn</strong> — nên thảo luận trong buổi Team Sync hoặc đánh dấu đã xử lý.</p></div>`
      : '';

  return `
    <section class="section open-blockers-section" id="open-blockers">
      <div class="section-header">
        <div>
          <h3 class="section-title">Vấn đề đang mở</h3>
          <p class="section-filter-hint">${blockers.length} vấn đề chưa xử lý${
            summary?.stale ? ` · ${summary.stale} quá hạn` : ''
          }</p>
        </div>
      </div>
      ${staleHint}
      <div class="blocker-list">
        ${blockers.map((b) => openBlockerCardHtml(b, canAdminister, avatars)).join('')}
      </div>
      ${
        !canAdminister
          ? '<p class="section-filter-hint">Chỉ project admin mới đánh dấu vấn đề đã xử lý.</p>'
          : ''
      }
    </section>
  `;
};

const adminHintHtml = (permissions) => {
  const canAdmin = permissions?.canAdministerProject;
  const isJiraAdmin = permissions?.isJiraAdmin;
  if (!canAdmin && !isJiraAdmin) return '';
  const parts = [];
  if (canAdmin) {
    parts.push(
      'Quản trị project: đánh dấu xử lý vấn đề tại mục <strong>Vấn đề đang mở</strong>; cấu hình tại <strong>Project settings → Apps → Team Sync</strong>.'
    );
  }
  if (isJiraAdmin) {
    parts.push(
      'Jira admin: cài đặt toàn site và xuất dữ liệu tại <strong>Jira settings → Apps → Team Sync</strong>.'
    );
  }
  return `<div class="alert alert-info admin-hint"><p>${parts.join(' ')}</p></div>`;
};

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

const entryCardHtml = (entry, labels, canAdminister, avatars) => {
  const time = formatTime(entry.createdAt);
  const statusCards = [
    statusCardHtml('tasks', labels.tasks, entry.yesterday),
    statusCardHtml('progress', labels.progress, entry.today),
    entry.hasBlocker
      ? statusCardHtml('problems', labels.problems, entry.blockers)
      : entry.blockerResolved && hadBlockerContent(entry.blockers)
        ? statusCardHtml('problems', labels.problems, entry.blockers, {
            resolved: true,
            resolution: entry.blockerResolution ?? '',
          })
        : '',
  ].filter(Boolean);
  const avatarUrl = avatars?.[entry.accountId] ?? entry.avatarUrl ?? '';
  const workItemsHtml = workItemsSectionsHtml(entry, labels);

  return `
    <article class="entry-card" data-account-id="${escapeHtml(entry.accountId)}">
      <header class="entry-header">
        <div class="entry-header-main">
          ${userAvatarHtml(entry.accountId, entry.displayName, avatarUrl, 'entry-avatar')}
          <span class="entry-name">${escapeHtml(entry.displayName)}</span>
        </div>
        ${time ? `<time class="entry-time">${escapeHtml(time)}</time>` : ''}
      </header>
      <div class="status-panel">
        ${statusCards.length ? `<div class="status-grid">${statusCards.join('')}</div>` : '<p class="status-empty">Chưa có nội dung.</p>'}
      </div>
      ${workItemsHtml}
      ${
        entry.hasBlocker && canAdminister
          ? `<button type="button" class="btn-resolve" data-resolve="${escapeHtml(entry.accountId)}">Đánh dấu đã xử lý vấn đề</button>`
          : ''
      }
    </article>
  `;
};

const resolveModalHtml = (target) => `
  <div class="modal-backdrop" data-resolve-modal role="presentation">
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h4 class="modal-title">Phương án giải quyết vấn đề</h4>
        <button type="button" class="modal-close" data-close-resolve aria-label="Đóng">×</button>
      </div>
      <div class="modal-body">
        <p class="panel-label">Thành viên</p>
        <p class="modal-member">${escapeHtml(target.displayName)}</p>
        <p class="panel-label">Vấn đề</p>
        <p class="modal-blocker">${escapeHtml(extractPlainText(target.blockers))}</p>
        <label class="panel-label" for="resolution-plan">Phương án giải quyết</label>
        <textarea id="resolution-plan" class="paste-input" rows="4" placeholder="Mô tả cách team xử lý khó khăn này…"></textarea>
        <p class="error resolve-error" hidden></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" data-close-resolve>Hủy</button>
        <button type="button" class="btn btn-primary" data-save-resolve>Lưu và đánh dấu đã xử lý</button>
      </div>
    </div>
  </div>
`;

export async function renderDashboard(container, ctx) {
  const { projectKey, memberFilter, onNavigateLog } = ctx;
  container.innerHTML = `<div class="page-loading">Đang tải tổng quan team…</div>`;

  let data;
  try {
    data = await invoke('getProjectDashboard', {
      projectKey,
      memberAccountId: memberFilter || null,
    });
  } catch (e) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(e?.message ?? 'Không tải được tổng quan team.')}</div>`;
    return;
  }

  const timeline = data?.timeline ?? [];
  const members = data?.members ?? [];
  const canAdminister = data?.permissions?.canAdministerProject ?? false;
  const canExport = data?.permissions?.isJiraAdmin ?? false;
  const todayLabel = isoToDayMonth(data?.today);
  const labels = STANDUP_LABELS_SHORT;
  const avatars = {
    ...(data?.avatars ?? {}),
    ...Object.fromEntries((data?.members ?? []).map((m) => [m.accountId, m.avatarUrl ?? ''])),
  };

  const enrichedTimeline = await Promise.all(
    timeline.map(async (entry) => {
      const issueGroups = groupStandupLinkedIssues(entry);
      const allKeys = [
        ...new Set([...issueGroups.tasks, ...issueGroups.progress, ...issueGroups.problems]),
      ];
      const normalized = {
        ...entry,
        yesterday: extractPlainText(entry.yesterday),
        today: extractPlainText(entry.today),
        blockers: extractPlainText(entry.blockers),
        issueGroups,
      };
      if (!allKeys.length) return { ...normalized, issues: [] };
      const issues = await enrichIssues(allKeys.map((key) => ({ key, url: '' })));
      return { ...normalized, issues };
    })
  );

  const filteredMember = members.find((m) => m.accountId === ctx.memberFilter);
  const activeBlockers = (data?.activeBlockers ?? [])
    .filter((b) => !ctx.memberFilter || b.accountId === ctx.memberFilter)
    .map((b) => ({
      ...b,
      blockers: extractPlainText(b.blockers),
    }));
  const blockerSummary = {
    total: activeBlockers.length,
    today: activeBlockers.filter((b) => b.isToday).length,
    stale: activeBlockers.filter((b) => b.isStale).length,
  };

  container.innerHTML = `
    <div class="page dashboard-page">
      <header class="page-header">
        <div>
          <h2 class="page-title">${escapeHtml(ctx.pageTitle)}</h2>
          <p class="page-subtitle">Team ${escapeHtml(projectKey)} · ${escapeHtml(ctx.teamSyncSubtitle)}</p>
        </div>
        <div class="page-actions">
          ${canExport ? '<button type="button" class="btn" id="export-data">Tải file Excel</button>' : ''}
          <button type="button" class="btn btn-primary" id="go-log">Ghi Team Sync của tôi</button>
        </div>
      </header>

      ${adminHintHtml(data?.permissions)}

      ${dashboardStatsHtml(data?.stats)}

      ${openBlockersSectionHtml(activeBlockers, blockerSummary, canAdminister, avatars)}

      ${
        members.length
          ? `<section class="section">
              <div class="section-header">
                <div>
                  <h3 class="section-title">Thành viên team</h3>
                  ${
                    filteredMember
                      ? `<p class="section-filter-hint">Đang lọc: <strong>${escapeHtml(filteredMember.displayName)}</strong></p>`
                      : ''
                  }
                </div>
                ${
                  ctx.memberFilter
                    ? '<button type="button" class="btn" id="clear-member-filter">Xóa bộ lọc</button>'
                    : ''
                }
              </div>
              <div class="member-grid">
                ${members
                  .map((m) => {
                    const isMe = data?.accountId && m.accountId === data.accountId;
                    return `
                  <button type="button" class="member-card${ctx.memberFilter === m.accountId ? ' is-selected' : ''}${isMe ? ' is-me' : ''}" data-member="${escapeHtml(m.accountId)}">
                    ${userAvatarHtml(m.accountId, m.displayName, m.avatarUrl ?? avatars[m.accountId] ?? '', 'member-card-avatar')}
                    <span class="member-card-name">${escapeHtml(m.displayName)}${isMe ? ' <span class="member-you-badge">Bạn</span>' : ''}</span>
                    <div class="member-sync-progress">
                      ${progressBarHtml(m.loggedToday ? 100 : 0, {
                        variant: m.loggedToday ? 'success' : 'neutral',
                        size: 'sm',
                      })}
                      <span class="member-card-status${m.loggedToday ? ' is-done' : ' is-pending'}">${m.loggedToday ? 'Đã ghi hôm nay' : 'Chưa ghi'}</span>
                    </div>
                  </button>`;
                  })
                  .join('')}
              </div>
            </section>`
          : ''
      }

      <section class="section">
        <div class="section-header">
          <h3 class="section-title">Team Sync hôm nay${todayLabel ? ` · ${escapeHtml(todayLabel)}` : ''}</h3>
          ${
            ctx.memberFilter
              ? '<button type="button" class="btn" id="clear-member-filter-timeline">Xóa bộ lọc</button>'
              : ''
          }
        </div>
        ${
          enrichedTimeline.length === 0
            ? `<div class="empty-state">
                <h4>Chưa có ai ghi Team Sync hôm nay</h4>
                <p>Bắt đầu buổi sync bằng cách ghi Tasks, Progress và Problems — mất khoảng 2 phút.</p>
                <button type="button" class="btn btn-primary" id="go-log-empty">Ghi Team Sync của tôi</button>
              </div>`
            : `<div class="timeline">${enrichedTimeline.map((entry) => entryCardHtml(entry, labels, canAdminister, avatars)).join('')}</div>`
        }
      </section>
      <div id="resolve-modal-slot"></div>
    </div>
  `;

  bindIssueOpen(container);

  container.querySelector('#go-log')?.addEventListener('click', onNavigateLog);
  container.querySelector('#go-log-empty')?.addEventListener('click', onNavigateLog);

  container.querySelector('#export-data')?.addEventListener('click', async () => {
    try {
      const payload = await invoke('exportStandupData');
      await downloadExcelFromCsv(payload.filename ?? 'team-sync-export.xlsx', payload.csv ?? '');
    } catch (e) {
      alert(e?.message ?? 'Không xuất được file Excel.');
    }
  });

  container.querySelectorAll('[data-member]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.member;
      ctx.setMemberFilter(ctx.memberFilter === id ? '' : id);
    });
  });

  const clearFilter = () => ctx.setMemberFilter('');
  container.querySelector('#clear-member-filter')?.addEventListener('click', clearFilter);
  container.querySelector('#clear-member-filter-timeline')?.addEventListener('click', clearFilter);

  const modalSlot = container.querySelector('#resolve-modal-slot');

  const openResolveModal = (target) => {
    if (!target || !modalSlot) return;
    modalSlot.innerHTML = resolveModalHtml(target);

    const close = () => {
      modalSlot.innerHTML = '';
    };

    modalSlot.querySelectorAll('[data-close-resolve]').forEach((el) => {
      el.addEventListener('click', close);
    });

    modalSlot.querySelector('[data-save-resolve]')?.addEventListener('click', async () => {
      const plan = modalSlot.querySelector('#resolution-plan')?.value?.trim() ?? '';
      const errEl = modalSlot.querySelector('.resolve-error');
      if (plan.length < 3) {
        if (errEl) {
          errEl.textContent = 'Phương án giải quyết phải có ít nhất 3 ký tự.';
          errEl.hidden = false;
        }
        return;
      }
      try {
        await invoke('resolveBlocker', {
          projectKey,
          date: target.date,
          accountId: target.accountId,
          resolutionPlan: plan,
        });
        close();
        await renderDashboard(container, ctx);
      } catch (e) {
        if (errEl) {
          errEl.textContent = e?.message ?? 'Không lưu được phương án giải quyết.';
          errEl.hidden = false;
        }
      }
    });
  };

  container.querySelectorAll('[data-resolve]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = enrichedTimeline.find((e) => e.accountId === btn.dataset.resolve);
      if (!entry) return;
      openResolveModal({
        accountId: entry.accountId,
        displayName: entry.displayName,
        blockers: entry.blockers,
        date: data.today,
      });
    });
  });

  container.querySelectorAll('[data-resolve-blocker]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const blocker = activeBlockers.find((b) => b.key === btn.dataset.resolveBlocker);
      if (!blocker) return;
      openResolveModal({
        accountId: blocker.accountId,
        displayName: blocker.displayName,
        blockers: blocker.blockers,
        date: blocker.date,
      });
    });
  });
}
