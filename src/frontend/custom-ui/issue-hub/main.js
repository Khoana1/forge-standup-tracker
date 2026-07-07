import { events, invoke } from '@forge/bridge';

const root = document.getElementById('root');

const STATUS_CYCLE = [
  { label: 'To do', dotColor: '#626f86', category: 'new' },
  { label: 'In progress', dotColor: '#378ADD', category: 'indeterminate' },
  { label: 'Done', dotColor: '#639922', category: 'done' },
];

const state = {
  projectKey: '',
  issues: [],
  lockedKeys: [],
  maxIssues: 20,
  enableReorder: false,
  enableStatusChange: false,
  issuesTitle: 'Work item làm việc hôm nay',
  pasteText: '',
  searchQuery: '',
  suggestions: [],
  searching: false,
  pasteError: '',
  dragIndex: null,
  addModalOpen: false,
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getStatusDisplay = (issue) => {
  const category = issue?.statusCategory ?? 'new';
  const found = STATUS_CYCLE.find((item) => item.category === category);
  if (found) return { ...found, label: issue?.status || found.label };
  return {
    label: issue?.status || 'To do',
    dotColor: '#626f86',
    category: 'new',
  };
};

const getNextStatus = (category) => {
  const index = STATUS_CYCLE.findIndex((item) => item.category === category);
  const nextIndex = index < 0 ? 0 : (index + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
};

const parsePaste = (text) => {
  const items = [];
  const seen = new Set();
  const urlRe = /https?:\/\/[^\s>]+\/browse\/([A-Z][A-Z0-9]+-\d+)/gi;
  let match;
  while ((match = urlRe.exec(text)) !== null) {
    const key = match[1].toUpperCase();
    if (!seen.has(key)) {
      seen.add(key);
      items.push({ key, url: match[0] });
    }
  }
  for (const part of text.split(/[\n,]+/)) {
    const trimmed = part.trim();
    const keyMatch = trimmed.match(/^([A-Z][A-Z0-9]+-\d+)$/);
    if (keyMatch && !seen.has(keyMatch[1])) {
      seen.add(keyMatch[1]);
      items.push({ key: keyMatch[1], url: '' });
    }
  }
  return items;
};

const MODAL_MIN_IFRAME_HEIGHT = 580;

const emitResize = () => {
  requestAnimationFrame(() => {
    let height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      120
    );
    if (state.addModalOpen) {
      height = Math.max(height, MODAL_MIN_IFRAME_HEIGHT);
    }
    events.emit('ISSUE_HUB_RESIZE', { height });
  });
};

const scheduleResize = () => {
  emitResize();
  if (state.addModalOpen) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => emitResize());
    });
  }
};

const closeAddModal = () => {
  state.addModalOpen = false;
  state.pasteText = '';
  state.pasteError = '';
  state.searchQuery = '';
  state.suggestions = [];
  state.searching = false;
};

const issueRowHtml = (issue, index) => {
  const status = getStatusDisplay(issue);
  const locked = state.lockedKeys.includes(issue.key);
  const canRemove = !locked;
  const dragAttrs = state.enableReorder
    ? `draggable="true" data-drag-index="${index}"`
    : '';

  return `
    <div class="row-card" data-key="${escapeHtml(issue.key)}" data-index="${index}" role="listitem">
      ${
        state.enableReorder
          ? `<span class="grip" ${dragAttrs} aria-hidden="true" title="Kéo để sắp xếp">⠿</span>`
          : ''
      }
      <a class="issue-key" href="#" data-open="${escapeHtml(issue.key)}">${escapeHtml(issue.key)}</a>
      <span class="issue-summary issue-link" data-open="${escapeHtml(issue.key)}" title="${escapeHtml(issue.summary || '')}">${escapeHtml(issue.summary || '—')}</span>
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
      <button
        type="button"
        class="status-pill"
        data-status="${escapeHtml(issue.key)}"
        ${state.enableStatusChange ? '' : 'disabled'}
      >
        <span class="status-dot" style="background:${status.dotColor}"></span>
        <span>${escapeHtml(status.label)}</span>
      </button>
      ${
        canRemove
          ? `<button type="button" class="btn-issue-remove" data-remove-issue="${escapeHtml(issue.key)}" title="Gỡ work item">
              <span aria-hidden="true">🗑</span> Gỡ
            </button>`
          : ''
      }
    </div>
  `;
};

const renderAddModal = () => {
  const atLimit = state.issues.length >= state.maxIssues;
  const pasteCount = parsePaste(state.pasteText).length;

  return `
    <div class="modal-backdrop" role="presentation">
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="add-work-item-title">
        <div class="modal-header">
          <h4 class="modal-title" id="add-work-item-title">Thêm work item</h4>
          <button type="button" class="modal-close" id="close-add-modal" aria-label="Đóng">×</button>
        </div>
        <div class="modal-body">
          ${
            !atLimit
              ? `
          <div class="panel">
            <label class="panel-label" for="paste-input">Dán link hoặc mã work item</label>
            <textarea id="paste-input" class="paste-input" rows="3" placeholder="https://…/browse/SCRUM-1&#10;SCRUM-2">${escapeHtml(state.pasteText)}</textarea>
            ${state.pasteError ? `<p class="error">${escapeHtml(state.pasteError)}</p>` : ''}
            <button type="button" class="btn btn-primary" id="paste-add" ${!state.pasteText.trim() ? 'disabled' : ''}>
              Thêm ${pasteCount > 1 ? `${pasteCount} work item` : 'work item'}
            </button>
          </div>`
              : `<p class="error">Đã đạt tối đa ${state.maxIssues} work item.</p>`
          }
          ${
            state.projectKey && !atLimit
              ? `
          <div class="panel">
            <label class="panel-label" for="search-input">Tìm work item trong project</label>
            <div class="search-row">
              <input id="search-input" class="search-input" type="text" placeholder="Mã work item hoặc từ khóa…" value="${escapeHtml(state.searchQuery)}" />
              <button type="button" class="btn" id="search-btn" ${state.searching ? 'disabled' : ''}>${state.searching ? '…' : 'Tìm'}</button>
            </div>
            ${
              state.suggestions.length
                ? `<div class="suggestions">${state.suggestions
                    .map(
                      (issue) =>
                        `<button type="button" class="suggestion" data-add="${escapeHtml(issue.key)}" data-summary="${escapeHtml(issue.summary)}" data-status="${escapeHtml(issue.status)}">${escapeHtml(issue.key)} — ${escapeHtml(issue.summary)}</button>`
                    )
                    .join('')}</div>`
                : ''
            }
          </div>`
              : ''
          }
        </div>
        <div class="modal-footer">
          <button type="button" class="btn" id="close-add-modal-footer">Hủy</button>
        </div>
      </div>
    </div>
  `;
};

const render = () => {
  const atLimit = state.issues.length >= state.maxIssues;
  const hasIssues = state.issues.length > 0;

  root.innerHTML = `
    <div class="hub${state.addModalOpen ? ' is-modal-open' : ''}">
      ${
        hasIssues
          ? `
        <h3 class="issues-section-title">${escapeHtml(state.issuesTitle)}</h3>
        <div class="backlog-panel">
          <div class="backlog-header">
            <span class="backlog-title">Backlog</span>
            <span class="backlog-count">${state.issues.length}/${state.maxIssues} việc</span>
          </div>
          <div class="issue-list" role="list">
            ${state.issues.map((issue, index) => issueRowHtml(issue, index)).join('')}
          </div>
        </div>
        ${
          !atLimit
            ? `<div class="issues-section-footer">
                <button type="button" class="btn btn-primary" id="open-add-modal">Thêm work item</button>
              </div>`
            : ''
        }`
          : `
        <div class="issues-empty-actions">
          <button type="button" class="btn btn-primary" id="open-add-modal">Thêm work item</button>
        </div>`
      }
      ${state.addModalOpen ? renderAddModal() : ''}
    </div>
  `;

  scheduleResize();
};

const reorderIssues = (fromIndex, toIndex) => {
  if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
  const next = [...state.issues];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  events.emit('ISSUE_HUB_REORDER', { keys: next.map((issue) => issue.key) });
};

if (root) {
  root.addEventListener('input', (event) => {
    if (event.target.id === 'paste-input') {
      state.pasteText = event.target.value;
      state.pasteError = '';
      const addBtn = root.querySelector('#paste-add');
      const count = parsePaste(state.pasteText).length;
      if (addBtn) {
        addBtn.disabled = !state.pasteText.trim() || state.issues.length >= state.maxIssues;
        addBtn.textContent = count > 1 ? `Thêm ${count} work item` : 'Thêm work item';
      }
    }
    if (event.target.id === 'search-input') {
      state.searchQuery = event.target.value;
    }
  });

  root.addEventListener('click', async (event) => {
    const openEl = event.target.closest('[data-open]');
    if (openEl?.dataset.open) {
      event.preventDefault();
      events.emit('ISSUE_HUB_OPEN', { key: openEl.dataset.open });
      return;
    }

    if (event.target.classList?.contains('modal-backdrop')) {
      closeAddModal();
      render();
      return;
    }

    const target = event.target.closest('button');
    if (!target) return;

    if (target.id === 'open-add-modal') {
      if (state.issues.length >= state.maxIssues) return;
      state.addModalOpen = true;
      render();
      return;
    }

    if (target.id === 'close-add-modal' || target.id === 'close-add-modal-footer') {
      closeAddModal();
      render();
      return;
    }

    if (target.id === 'paste-add') {
      const found = parsePaste(state.pasteText);
      if (!found.length) {
        state.pasteError = 'Chưa nhận diện được link Jira hoặc mã work item.';
        render();
        return;
      }
      const room = state.maxIssues - state.issues.length;
      if (room <= 0) {
        state.pasteError = `Đã đạt tối đa ${state.maxIssues} work item.`;
        render();
        return;
      }
      events.emit('ISSUE_HUB_ADD', { items: found.slice(0, room) });
      closeAddModal();
      render();
      return;
    }

    if (target.id === 'search-btn') {
      const query = state.searchQuery.trim();
      if (!query || !state.projectKey) return;
      const pasted = parsePaste(query);
      if (pasted.length === 1) {
        events.emit('ISSUE_HUB_ADD', { items: pasted.slice(0, 1) });
        closeAddModal();
        render();
        return;
      }
      state.searching = true;
      render();
      try {
        const result = await invoke('searchIssuesForLink', { projectKey: state.projectKey, query });
        state.suggestions = result?.issues ?? [];
      } catch {
        state.suggestions = [];
      } finally {
        state.searching = false;
        render();
      }
      return;
    }

    if (target.dataset.removeIssue) {
      const row = target.closest('.row-card');
      if (row) row.classList.add('is-removing');
      setTimeout(() => events.emit('ISSUE_HUB_REMOVE', { key: target.dataset.removeIssue }), 200);
      return;
    }

    if (target.dataset.status && state.enableStatusChange) {
      const issue = state.issues.find((item) => item.key === target.dataset.status);
      if (!issue) return;
      const next = getNextStatus(issue.statusCategory ?? 'new');
      events.emit('ISSUE_HUB_STATUS_CHANGE', { issueKey: issue.key, nextStatus: next });
      return;
    }

    if (target.dataset.add) {
      if (state.issues.some((issue) => issue.key === target.dataset.add)) return;
      events.emit('ISSUE_HUB_ADD', {
        items: [
          {
            key: target.dataset.add,
            url: '',
            summary: target.dataset.summary ?? '',
            status: target.dataset.status ?? '',
          },
        ],
      });
      closeAddModal();
      render();
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.addModalOpen) {
      closeAddModal();
      render();
    }
  });

  root.addEventListener('dragstart', (event) => {
    const grip = event.target.closest('[data-drag-index]');
    if (!grip) return;
    state.dragIndex = Number(grip.dataset.dragIndex);
    event.dataTransfer.effectAllowed = 'move';
  });

  root.addEventListener('dragover', (event) => {
    if (state.dragIndex == null) return;
    event.preventDefault();
    const row = event.target.closest('.row-card');
    root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (row) row.classList.add('is-drag-over');
  });

  root.addEventListener('drop', (event) => {
    event.preventDefault();
    const row = event.target.closest('.row-card');
    root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (row && state.dragIndex != null) {
      reorderIssues(state.dragIndex, Number(row.dataset.index));
    }
    state.dragIndex = null;
  });

  root.addEventListener('dragend', () => {
    state.dragIndex = null;
    root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
  });
}

events.on('ISSUE_HUB_SYNC', (payload) => {
  state.projectKey = payload?.projectKey ?? '';
  state.issues = payload?.issues ?? [];
  state.lockedKeys = payload?.lockedKeys ?? [];
  state.maxIssues = payload?.maxIssues ?? 20;
  state.enableReorder = Boolean(payload?.enableReorder);
  state.enableStatusChange = Boolean(payload?.enableStatusChange);
  state.issuesTitle = payload?.title ?? 'Work item làm việc hôm nay';
  render();
});

render();
events.emit('ISSUE_HUB_READY');
