import { invoke, router } from '@forge/bridge';
import {
  STANDUP_LINKED_WORK_ITEMS_TITLE,
  STANDUP_PLACEHOLDER,
  STANDUP_TABLE_HEADERS,
} from '../../../../lib/labels.js';
import { parseJiraLinkPaste, stripJiraLinkPasteContent } from '../../../../lib/adf-helpers.js';
import { escapeHtml } from '../shared/dom.js';
import {
  enrichIssues,
  getNextStatus,
  issueRowHtml,
  parsePaste,
} from '../shared/issues.js';

const syncRowHeights = (rowEl) => {
  if (!rowEl) return;
  const textareas = rowEl.querySelectorAll('textarea.cell-input');
  let maxHeight = 0;
  textareas.forEach((ta) => {
    ta.style.height = 'auto';
    maxHeight = Math.max(maxHeight, ta.scrollHeight);
  });
  textareas.forEach((ta) => {
    ta.style.height = `${maxHeight}px`;
  });
};

export class LogFormController {
  constructor({ projectKey, onRowsChange }) {
    this.projectKey = projectKey;
    this.onRowsChange = onRowsChange;
    this.container = null;
    this.bound = false;

    this.state = {
      rows: [],
      placeholders: { ...STANDUP_PLACEHOLDER },
      headers: { ...STANDUP_TABLE_HEADERS },
      minRows: 1,
      maxRows: 20,
      issuesTitle: STANDUP_LINKED_WORK_ITEMS_TITLE,
      issues: [],
      lockedKeys: [],
      maxIssues: 20,
      enableReorder: true,
      enableStatusChange: true,
      pasteText: '',
      searchQuery: '',
      suggestions: [],
      searching: false,
      pasteError: '',
      dragIndex: null,
      addModalOpen: false,
    };
  }

  setRows(rows) {
    this.state.rows = (rows ?? []).map((row) => ({
      id: row.id,
      tasks: row.tasks ?? '',
      progress: row.progress ?? '',
      problems: row.problems ?? '',
    }));
    this.render();
  }

  getRows() {
    return this.state.rows.map((row) => ({ ...row }));
  }

  setIssues(issues) {
    this.state.issues = issues ?? [];
    this.render();
  }

  getIssues() {
    return this.state.issues;
  }

  getLinkedIssueKeys() {
    return this.state.issues.map((issue) => issue.key);
  }

  mount(container) {
    if (this.container !== container) {
      this.container = container;
      this.bound = false;
    }
    if (!this.bound) {
      this.bindEvents();
      this.bound = true;
    }
    this.render();
  }

  unmount() {
    if (this.container) this.container.innerHTML = '';
  }

  rowHtml(row, index) {
    const canRemove = this.state.rows.length > this.state.minRows;
    return `
      <tr data-row-id="${escapeHtml(row.id)}">
        <td class="cell-index">${index + 1}</td>
        <td class="cell-content">
          <textarea class="cell-input cell-input-tasks" data-row-id="${escapeHtml(row.id)}" data-field="tasks" rows="1" placeholder="${escapeHtml(this.state.placeholders.tasks)}">${escapeHtml(row.tasks ?? '')}</textarea>
        </td>
        <td class="cell-content">
          <input type="text" class="cell-input cell-input-progress" data-row-id="${escapeHtml(row.id)}" data-field="progress" value="${escapeHtml(row.progress ?? '')}" placeholder="${escapeHtml(this.state.placeholders.progress)}" title="${escapeHtml(row.progress ?? '')}" />
        </td>
        <td class="cell-content">
          <textarea class="cell-input cell-input-problems" data-row-id="${escapeHtml(row.id)}" data-field="problems" rows="1" placeholder="${escapeHtml(this.state.placeholders.problems)}">${escapeHtml(row.problems ?? '')}</textarea>
        </td>
        <td class="cell-actions">
          <button type="button" class="btn-row-remove" data-remove-row="${escapeHtml(row.id)}" title="Xóa hàng" ${canRemove ? '' : 'disabled'}>×</button>
        </td>
      </tr>
    `;
  }

  tableHtml() {
    const atMax = this.state.rows.length >= this.state.maxRows;
    return `
      <div class="daily-table-wrap">
        <table class="daily-table" role="grid">
          <colgroup>
            <col class="col-index" /><col class="col-tasks" /><col class="col-progress" /><col class="col-problems" /><col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">${escapeHtml(this.state.headers.tasks)}</th>
              <th scope="col">${escapeHtml(this.state.headers.progress)}</th>
              <th scope="col">${escapeHtml(this.state.headers.problems)}</th>
              <th scope="col" aria-label="Thao tác"></th>
            </tr>
          </thead>
          <tbody>
            ${this.state.rows.map((row, index) => this.rowHtml(row, index)).join('')}
          </tbody>
        </table>
        <div class="daily-table-footer">
          <button type="button" class="btn-add-row" id="add-row" ${atMax ? 'disabled' : ''}>Thêm hàng</button>
          ${atMax ? `<p class="footer-hint">Tối đa ${this.state.maxRows} hàng.</p>` : ''}
        </div>
      </div>
    `;
  }

  addModalHtml() {
    const atLimit = this.state.issues.length >= this.state.maxIssues;
    const pasteCount = parsePaste(this.state.pasteText).length;
    return `
      <div class="modal-backdrop" data-modal-backdrop role="presentation">
        <div class="modal-dialog" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h4 class="modal-title">Thêm work item</h4>
            <button type="button" class="modal-close" id="close-add-modal" aria-label="Đóng">×</button>
          </div>
          <div class="modal-body">
            ${
              !atLimit
                ? `<div class="panel">
                    <label class="panel-label" for="paste-input">Dán link hoặc mã work item</label>
                    <textarea id="paste-input" class="paste-input" rows="3">${escapeHtml(this.state.pasteText)}</textarea>
                    ${this.state.pasteError ? `<p class="error">${escapeHtml(this.state.pasteError)}</p>` : ''}
                    <button type="button" class="btn btn-primary" id="paste-add" ${!this.state.pasteText.trim() ? 'disabled' : ''}>
                      Thêm ${pasteCount > 1 ? `${pasteCount} work item` : 'work item'}
                    </button>
                  </div>`
                : `<p class="error">Đã đạt tối đa ${this.state.maxIssues} work item.</p>`
            }
            ${
              this.projectKey && !atLimit
                ? `<div class="panel">
                    <label class="panel-label" for="search-input">Tìm work item trong project</label>
                    <div class="search-row">
                      <input id="search-input" class="search-input" type="text" placeholder="Mã work item hoặc từ khóa…" value="${escapeHtml(this.state.searchQuery)}" />
                      <button type="button" class="btn" id="search-btn" ${this.state.searching ? 'disabled' : ''}>${this.state.searching ? '…' : 'Tìm'}</button>
                    </div>
                    ${
                      this.state.suggestions.length
                        ? `<div class="suggestions">${this.state.suggestions
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
  }

  issuesHtml() {
    const atLimit = this.state.issues.length >= this.state.maxIssues;
    const hasIssues = this.state.issues.length > 0;
    return `
      <section class="issues-section">
        ${
          hasIssues
            ? `<h3 class="issues-section-title">${escapeHtml(this.state.issuesTitle)}</h3>
               <div class="backlog-panel">
                 <div class="backlog-header">
                   <span class="backlog-title">Backlog</span>
                   <span class="backlog-count">${this.state.issues.length}/${this.state.maxIssues} việc</span>
                 </div>
                 <div class="issue-list" role="list">
                   ${this.state.issues
                     .map((issue, index) =>
                       issueRowHtml(issue, {
                         index,
                         lockedKeys: this.state.lockedKeys,
                         enableReorder: this.state.enableReorder,
                         enableStatusChange: this.state.enableStatusChange,
                       })
                     )
                     .join('')}
                 </div>
               </div>
               ${!atLimit ? `<div class="issues-section-footer"><button type="button" class="btn btn-primary" id="open-add-modal">Thêm work item</button></div>` : ''}`
            : `<div class="issues-empty-actions"><button type="button" class="btn btn-primary" id="open-add-modal">Thêm work item</button></div>`
        }
      </section>
    `;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="log-form${this.state.addModalOpen ? ' is-modal-open' : ''}">
        ${this.tableHtml()}
        ${this.issuesHtml()}
        ${this.state.addModalOpen ? this.addModalHtml() : ''}
      </div>
    `;
    this.container.querySelectorAll('tr[data-row-id]').forEach(syncRowHeights);
  }

  notifyRowsChange() {
    this.onRowsChange?.(this.getRows());
  }

  updateField(rowId, field, value) {
    const row = this.state.rows.find((item) => item.id === rowId);
    if (!row || !field) return;
    row[field] = value;
    this.notifyRowsChange();
  }

  closeAddModal() {
    this.state.addModalOpen = false;
    this.state.pasteText = '';
    this.state.pasteError = '';
    this.state.searchQuery = '';
    this.state.suggestions = [];
    this.state.searching = false;
  }

  async addIssues(items) {
    if (!items?.length) return;
    const merged = [...this.state.issues];
    for (const item of items) {
      if (!merged.some((issue) => issue.key === item.key)) merged.push(item);
    }
    const capped = merged.slice(0, this.state.maxIssues);
    this.state.issues = await enrichIssues(capped);
    this.render();
  }

  removeIssue(key) {
    this.state.issues = this.state.issues.filter((issue) => issue.key !== key);
    this.render();
  }

  reorderIssues(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    const next = [...this.state.issues];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    this.state.issues = next;
    this.render();
  }

  async handleCellBlur(rowId, field, value) {
    const found = parseJiraLinkPaste(value);
    if (!found.length) return;
    const stripped = stripJiraLinkPasteContent(value);
    this.updateField(rowId, field, stripped);
    await this.addIssues(found);
    this.render();
  }

  bindEvents() {
    const root = this.container;
    if (!root) return;

    root.addEventListener('input', (event) => {
      const target = event.target;
      if (target.id === 'paste-input') {
        this.state.pasteText = target.value;
        this.state.pasteError = '';
        this.render();
        return;
      }
      if (target.id === 'search-input') {
        this.state.searchQuery = target.value;
        return;
      }
      if (!target.dataset?.rowId || !target.dataset?.field) return;
      this.updateField(target.dataset.rowId, target.dataset.field, target.value);
      if (target.dataset.field === 'progress') target.title = target.value;
      if (target.tagName === 'TEXTAREA') syncRowHeights(target.closest('tr'));
    });

    root.addEventListener(
      'blur',
      (event) => {
        const target = event.target;
        if (!target.dataset?.rowId || !target.dataset?.field) return;
        this.handleCellBlur(target.dataset.rowId, target.dataset.field, target.value ?? '');
      },
      true
    );

    root.addEventListener('click', async (event) => {
      const openEl = event.target.closest('[data-open]');
      if (openEl?.dataset.open) {
        event.preventDefault();
        router.open(`/browse/${openEl.dataset.open}`);
        return;
      }
      if (event.target.classList?.contains('modal-backdrop')) {
        this.closeAddModal();
        this.render();
        return;
      }
      const target = event.target.closest('button');
      if (!target) return;

      if (target.id === 'open-add-modal') {
        if (this.state.issues.length >= this.state.maxIssues) return;
        this.state.addModalOpen = true;
        this.render();
        return;
      }
      if (target.id === 'close-add-modal' || target.id === 'close-add-modal-footer') {
        this.closeAddModal();
        this.render();
        return;
      }
      if (target.id === 'add-row') {
        if (this.state.rows.length >= this.state.maxRows) return;
        this.state.rows.push({
          id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tasks: '',
          progress: '',
          problems: '',
        });
        this.notifyRowsChange();
        this.render();
        return;
      }
      if (target.dataset.removeRow) {
        if (this.state.rows.length <= this.state.minRows) return;
        this.state.rows = this.state.rows.filter((row) => row.id !== target.dataset.removeRow);
        this.notifyRowsChange();
        this.render();
        return;
      }
      if (target.id === 'paste-add') {
        const found = parsePaste(this.state.pasteText);
        if (!found.length) {
          this.state.pasteError = 'Chưa nhận diện được link Jira hoặc mã work item.';
          this.render();
          return;
        }
        const room = this.state.maxIssues - this.state.issues.length;
        if (room <= 0) {
          this.state.pasteError = `Đã đạt tối đa ${this.state.maxIssues} work item.`;
          this.render();
          return;
        }
        await this.addIssues(found.slice(0, room));
        this.closeAddModal();
        this.render();
        return;
      }
      if (target.id === 'search-btn') {
        const query = this.state.searchQuery.trim();
        if (!query || !this.projectKey) return;
        const pasted = parsePaste(query);
        if (pasted.length === 1) {
          await this.addIssues(pasted.slice(0, 1));
          this.closeAddModal();
          this.render();
          return;
        }
        this.state.searching = true;
        this.render();
        try {
          const result = await invoke('searchIssuesForLink', { projectKey: this.projectKey, query });
          this.state.suggestions = result?.issues ?? [];
        } catch {
          this.state.suggestions = [];
        } finally {
          this.state.searching = false;
          this.render();
        }
        return;
      }
      if (target.dataset.removeIssue) {
        const row = target.closest('.row-card');
        if (row) row.classList.add('is-removing');
        setTimeout(() => this.removeIssue(target.dataset.removeIssue), 200);
        return;
      }
      if (target.dataset.status && this.state.enableStatusChange) {
        const issue = this.state.issues.find((item) => item.key === target.dataset.status);
        if (!issue) return;
        const next = getNextStatus(issue.statusCategory ?? 'new');
        try {
          await invoke('updateIssueStatus', { issueKey: issue.key, statusCategory: next.category });
          issue.status = next.label;
          issue.statusCategory = next.category;
          this.render();
        } catch (e) {
          console.error(e);
        }
        return;
      }
      if (target.dataset.add) {
        if (this.state.issues.some((issue) => issue.key === target.dataset.add)) return;
        await this.addIssues([
          {
            key: target.dataset.add,
            url: '',
            summary: target.dataset.summary ?? '',
            status: target.dataset.status ?? '',
          },
        ]);
        this.closeAddModal();
        this.render();
      }
    });

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.state.addModalOpen) {
        this.closeAddModal();
        this.render();
      }
    });

    root.addEventListener('dragstart', (event) => {
      const grip = event.target.closest('[data-drag-index]');
      if (!grip) return;
      this.state.dragIndex = Number(grip.dataset.dragIndex);
      event.dataTransfer.effectAllowed = 'move';
    });

    root.addEventListener('dragover', (event) => {
      if (this.state.dragIndex == null) return;
      event.preventDefault();
      const row = event.target.closest('.row-card');
      root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      if (row) row.classList.add('is-drag-over');
    });

    root.addEventListener('drop', (event) => {
      event.preventDefault();
      const row = event.target.closest('.row-card');
      root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      if (row && this.state.dragIndex != null) {
        this.reorderIssues(this.state.dragIndex, Number(row.dataset.index));
      }
      this.state.dragIndex = null;
    });

    root.addEventListener('dragend', () => {
      this.state.dragIndex = null;
      root.querySelectorAll('.row-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    });
  }
}
