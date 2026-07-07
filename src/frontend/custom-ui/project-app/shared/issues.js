import { invoke, router } from '@forge/bridge';
import { escapeHtml } from './dom.js';

export const STATUS_CYCLE = [
  { label: 'To do', dotColor: '#626f86', category: 'new' },
  { label: 'In progress', dotColor: '#378ADD', category: 'indeterminate' },
  { label: 'Done', dotColor: '#639922', category: 'done' },
];

export const getStatusDisplay = (issue) => {
  const category = issue?.statusCategory ?? 'new';
  const found = STATUS_CYCLE.find((item) => item.category === category);
  if (found) return { ...found, label: issue?.status || found.label };
  return { label: issue?.status || 'To do', dotColor: '#626f86', category: 'new' };
};

export const getNextStatus = (category) => {
  const index = STATUS_CYCLE.findIndex((item) => item.category === category);
  const nextIndex = index < 0 ? 0 : (index + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIndex];
};

export const enrichIssues = async (issues) => {
  if (!issues?.length) return [];
  const keys = issues.map((issue) => issue.key);
  try {
    const result = await invoke('enrichLinkedIssues', { issueKeys: keys });
    const byKey = Object.fromEntries((result?.issues ?? []).map((issue) => [issue.key, issue]));
    return issues.map((issue) => ({
      ...issue,
      summary: byKey[issue.key]?.summary ?? issue.summary ?? '',
      status: byKey[issue.key]?.status ?? issue.status ?? '',
      statusCategory: byKey[issue.key]?.statusCategory ?? issue.statusCategory ?? 'new',
      issueType: byKey[issue.key]?.issueType ?? issue.issueType ?? '',
      issueTypeIconUrl: byKey[issue.key]?.issueTypeIconUrl ?? issue.issueTypeIconUrl ?? '',
    }));
  } catch {
    return issues;
  }
};

export const parsePaste = (text) => {
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

export const issueRowHtml = (issue, options = {}) => {
  const {
    readonly = false,
    index = 0,
    lockedKeys = [],
    enableReorder = false,
    enableStatusChange = false,
    problemResolved = false,
  } = options;
  const status = getStatusDisplay(issue);
  const locked = lockedKeys.includes(issue.key);
  const canRemove = !readonly && !locked;
  const dragAttrs = enableReorder ? `draggable="true" data-drag-index="${index}"` : '';

  return `
    <div class="row-card${problemResolved ? ' row-card--resolved' : ''}" data-key="${escapeHtml(issue.key)}" data-index="${index}" role="listitem">
      ${
        enableReorder
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
      ${
        readonly
          ? `<span class="status-pill${problemResolved ? ' status-pill--resolved' : ''}">
              ${
                problemResolved
                  ? '<span class="resolved-dot" aria-hidden="true">✓</span><span>Đã xử lý</span>'
                  : `<span class="status-dot" style="background:${status.dotColor}"></span>
              <span>${escapeHtml(status.label)}</span>`
              }
            </span>`
          : `<button type="button" class="status-pill" data-status="${escapeHtml(issue.key)}" ${enableStatusChange ? '' : 'disabled'}>
              <span class="status-dot" style="background:${status.dotColor}"></span>
              <span>${escapeHtml(status.label)}</span>
            </button>`
      }
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

export const bindIssueOpen = (root) => {
  root.addEventListener('click', (event) => {
    const openEl = event.target.closest('[data-open]');
    if (openEl?.dataset.open) {
      event.preventDefault();
      router.open(`/browse/${openEl.dataset.open}`);
    }
  });
};
