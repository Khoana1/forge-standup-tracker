import { events } from '@forge/bridge';

const root = document.getElementById('root');

const AVATAR_COLORS = ['#0c66e4', '#1f845a', '#e56910', '#8270db', '#c9372c', '#5b7f24'];

const state = {
  entries: [],
  labels: { tasks: 'Tasks', progress: 'Progress', problems: 'Problems' },
  canAdminister: false,
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const memberInitials = (name) =>
  (name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const avatarColor = (accountId) => {
  const s = accountId ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
};

const formatTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
};

const STATUS_CYCLE = [
  { label: 'To do', dotColor: '#626f86', category: 'new' },
  { label: 'In progress', dotColor: '#378ADD', category: 'indeterminate' },
  { label: 'Done', dotColor: '#639922', category: 'done' },
];

const getStatusDisplay = (issue) => {
  const category = issue?.statusCategory ?? 'new';
  const found = STATUS_CYCLE.find((item) => item.category === category);
  if (found) return { ...found, label: issue?.status || found.label };
  return { label: issue?.status || 'To do', dotColor: '#626f86', category: 'new' };
};

const issueRowHtml = (issue) => {
  const status = getStatusDisplay(issue);
  return `
    <div class="row-card" data-key="${escapeHtml(issue.key)}" role="listitem">
      <a class="issue-key" href="#" data-open="${escapeHtml(issue.key)}">${escapeHtml(issue.key)}</a>
      <span class="issue-summary" data-open="${escapeHtml(issue.key)}" title="${escapeHtml(issue.summary || '')}">${escapeHtml(issue.summary || '—')}</span>
      ${
        issue.issueType
          ? `<span class="type-badge">
              ${
                issue.issueTypeIconUrl
                  ? `<img class="type-icon" src="${escapeHtml(issue.issueTypeIconUrl)}" alt="" />`
                  : '<span class="type-icon-fallback" aria-hidden="true">☑</span>'
              }
              ${escapeHtml(issue.issueType)}
            </span>`
          : ''
      }
      <span class="status-pill">
        <span class="status-dot" style="background:${status.dotColor}"></span>
        <span>${escapeHtml(status.label)}</span>
      </span>
    </div>
  `;
};

const statusCardHtml = (variant, label, text) => {
  if (!text?.trim()) return '';
  return `
    <div class="status-card status-card--${variant}">
      <span class="status-label">${escapeHtml(label)}</span>
      <p class="status-text">${escapeHtml(text)}</p>
    </div>
  `;
};

const entryCardHtml = (entry) => {
  const time = formatTime(entry.createdAt);
  const statusCards = [
    statusCardHtml('tasks', state.labels.tasks, entry.yesterday),
    statusCardHtml('progress', state.labels.progress, entry.today),
    entry.hasBlocker ? statusCardHtml('problems', state.labels.problems, entry.blockers) : '',
  ].filter(Boolean);

  const issues = entry.issues ?? [];

  return `
    <article class="entry-card" data-account-id="${escapeHtml(entry.accountId)}">
      <header class="entry-header">
        <div class="entry-header-main">
          <span class="entry-avatar" style="background:${avatarColor(entry.accountId)}">${escapeHtml(memberInitials(entry.displayName))}</span>
          <span class="entry-name">${escapeHtml(entry.displayName)}</span>
        </div>
        ${time ? `<time class="entry-time">${escapeHtml(time)}</time>` : ''}
      </header>

      <div class="status-panel">
        ${
          statusCards.length
            ? `<div class="status-grid">${statusCards.join('')}</div>`
            : '<p class="status-empty">Chưa có nội dung.</p>'
        }
      </div>

      ${
        issues.length
          ? `
        <section class="work-items-section">
          <p class="work-items-title">Work item liên kết</p>
          <div class="backlog-panel">
            <div class="issue-list" role="list">
              ${issues.map((issue) => issueRowHtml(issue)).join('')}
            </div>
          </div>
        </section>`
          : ''
      }

      ${
        entry.hasBlocker && state.canAdminister
          ? `<button type="button" class="btn-resolve" data-resolve="${escapeHtml(entry.accountId)}">Đánh dấu đã xử lý vấn đề</button>`
          : ''
      }
    </article>
  `;
};

const emitResize = () => {
  requestAnimationFrame(() => {
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      80
    );
    events.emit('DASHBOARD_TIMELINE_RESIZE', { height });
  });
};

const render = () => {
  if (!root) return;

  root.innerHTML = `
    <div class="timeline" role="list">
      ${state.entries.map((entry) => entryCardHtml(entry)).join('')}
    </div>
  `;

  emitResize();
};

if (root) {
  root.addEventListener('click', (event) => {
    const openEl = event.target.closest('[data-open]');
    if (openEl?.dataset.open) {
      event.preventDefault();
      events.emit('ISSUE_HUB_OPEN', { key: openEl.dataset.open });
      return;
    }

    const resolveBtn = event.target.closest('[data-resolve]');
    if (resolveBtn?.dataset.resolve) {
      events.emit('DASHBOARD_TIMELINE_RESOLVE', { accountId: resolveBtn.dataset.resolve });
    }
  });
}

events.on('DASHBOARD_TIMELINE_SYNC', (payload) => {
  state.entries = payload?.entries ?? [];
  state.labels = payload?.labels ?? state.labels;
  state.canAdminister = Boolean(payload?.canAdminister);
  render();
});

render();
events.emit('DASHBOARD_TIMELINE_READY');
