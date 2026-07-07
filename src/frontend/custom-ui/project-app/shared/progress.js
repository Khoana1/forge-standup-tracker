import { escapeHtml } from './dom.js';

const clampPercent = (value) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

export const progressBarHtml = (value, { variant = 'plan', size = '' } = {}) => {
  const pct = clampPercent(value);
  const sizeClass = size ? ` progress-bar--${size}` : '';
  return `
    <div class="progress-bar${sizeClass}" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
      <div class="progress-bar-fill progress-bar-fill--${variant}" style="width:${pct}%"></div>
    </div>
  `;
};

export const progressStatCardHtml = ({ label, value, sub, variant = 'plan' }) => {
  const pct = clampPercent(value);
  return `
    <article class="stat-card">
      <div class="stat-card-header">
        <span class="stat-label">${escapeHtml(label)}</span>
        <span class="stat-value">${pct}%</span>
      </div>
      ${progressBarHtml(pct, { variant })}
      ${sub ? `<p class="stat-sub">${escapeHtml(sub)}</p>` : ''}
    </article>
  `;
};

export const metricStatCardHtml = ({ label, value, sub, danger = false }) => `
  <article class="stat-card stat-card--metric">
    <span class="stat-label">${escapeHtml(label)}</span>
    <span class="stat-metric${danger ? ' stat-metric--danger' : ''}">${escapeHtml(String(value))}</span>
    ${sub ? `<p class="stat-sub">${escapeHtml(sub)}</p>` : ''}
  </article>
`;

export const dashboardStatsHtml = (stats) => {
  const today = stats?.completionToday ?? { logged: 0, total: 0, pending: 0 };
  const todayPct = today.total ? (today.logged / today.total) * 100 : 0;
  const sprintPct = stats?.sprintCompletion ?? 0;
  const blockers = stats?.activeBlockers ?? 0;
  const stale = stats?.staleBlockers ?? 0;

  const todayVariant = todayPct >= 100 ? 'success' : todayPct >= 50 ? 'plan' : 'neutral';
  const sprintVariant = sprintPct >= 80 ? 'success' : sprintPct >= 50 ? 'plan' : 'neutral';

  return `
    <section class="section dashboard-stats">
      <div class="stats-grid">
        ${progressStatCardHtml({
          label: 'Team Sync hôm nay',
          value: todayPct,
          sub:
            today.total > 0
              ? `${today.logged}/${today.total} thành viên đã ghi${today.pending ? ` · còn ${today.pending}` : ''}`
              : 'Chưa có thành viên trong team',
          variant: todayVariant,
        })}
        ${progressStatCardHtml({
          label: 'Tiến độ sprint (2 tuần)',
          value: sprintPct,
          sub: 'Tỷ lệ ghi Team Sync các ngày làm việc',
          variant: sprintVariant,
        })}
        ${metricStatCardHtml({
          label: 'Vấn đề đang mở',
          value: blockers,
          sub: stale > 0 ? `${stale} quá hạn cần xử lý` : 'Không có vấn đề quá hạn',
          danger: blockers > 0,
        })}
      </div>
    </section>
  `;
};
