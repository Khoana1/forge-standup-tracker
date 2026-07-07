import { invoke } from '@forge/bridge';
import {
  extractJiraIssueKeys,
  extractPlainText,
  isStandupFieldEmpty,
  parseStandupFieldParts,
  serializeStandupText,
} from '../../../../lib/adf-helpers.js';
import { todayIso } from '../../../../lib/dates.js';
import { STANDUP_PLACEHOLDER, UI_COPY, formatTeamSyncTitle } from '../../../../lib/labels.js';
import {
  createDefaultRows,
  fieldsToRows,
  rowsToFields,
} from '../../../../lib/standup-rows.js';
import { LogFormController } from '../modules/log-form.js';
import { enrichIssues } from '../shared/issues.js';
import { escapeHtml } from '../shared/dom.js';

const collectStoredIssueKeys = (entry) => {
  const keys = new Set(entry?.linkedIssueKeys ?? []);
  for (const field of ['yesterday', 'today', 'blockers']) {
    for (const key of extractJiraIssueKeys(entry?.[field])) keys.add(key);
    for (const issue of parseStandupFieldParts(entry?.[field]).issues) keys.add(issue.key);
  }
  return [...keys];
};

export async function renderLog(container, ctx) {
  const { projectKey, sprintName } = ctx;

  if (!ctx.logForm) {
    ctx.logForm = new LogFormController({ projectKey });
    ctx.logForm.setRows(createDefaultRows());
  }

  const form = ctx.logForm;
  let alreadyLogged = false;
  let message = '';
  let error = '';

  const refreshSubmitState = () => {
    const fields = rowsToFields(form.getRows(), STANDUP_PLACEHOLDER.problems);
    const canSubmit = ['yesterday', 'today', 'blockers'].every(
      (name) => !isStandupFieldEmpty(fields[name], [])
    );
    const btn = container.querySelector('#submit-standup');
    if (btn) btn.disabled = !canSubmit;
  };

  form.onRowsChange = refreshSubmitState;

  const renderShell = () => {
    container.innerHTML = `
      <div class="page log-page">
        <header class="page-header">
          <div>
            <h2 class="page-title">${escapeHtml(formatTeamSyncTitle(sprintName))}</h2>
            <p class="page-subtitle">${escapeHtml(UI_COPY.teamSyncSubtitle)}</p>
          </div>
        </header>

        ${
          alreadyLogged
            ? '<div class="alert alert-success"><strong>Đã ghi hôm nay</strong><p>Bạn có thể chỉnh sửa và gửi lại bất cứ lúc nào trong ngày.</p></div>'
            : '<div class="alert alert-info"><strong>Bắt đầu nhanh</strong><p>Điền bảng Tasks / Progress / Problems — mỗi hàng là một mục công việc. Work item Jira gom ở mục «Work item làm việc hôm nay».</p></div>'
        }

        ${error ? `<div class="alert alert-error">${escapeHtml(error)}</div>` : ''}
        ${message ? `<div class="alert alert-info">${escapeHtml(message)}</div>` : ''}

        <div id="log-form-host"></div>

        <div class="form-footer">
          <button type="button" class="btn btn-primary" id="submit-standup" disabled>
            ${alreadyLogged ? 'Cập nhật Team Sync' : 'Gửi Team Sync hôm nay'}
          </button>
        </div>
      </div>
    `;

    const host = container.querySelector('#log-form-host');
    form.mount(host);
    refreshSubmitState();

    container.querySelector('#submit-standup')?.addEventListener('click', async () => {
      const btn = container.querySelector('#submit-standup');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Đang lưu…';
      }
      error = '';
      message = '';
      const data = rowsToFields(form.getRows(), STANDUP_PLACEHOLDER.problems);
      try {
        const result = await invoke('submitStandup', {
          projectKey,
          yesterday: serializeStandupText(data.yesterday),
          today: serializeStandupText(data.today),
          blockers: serializeStandupText(data.blockers),
          linkedIssueKeys: form.getLinkedIssueKeys(),
          date: todayIso(),
        });
        alreadyLogged = true;
        message =
          result?.problemNotification?.sent > 0
            ? 'Đã lưu Team Sync. Đã gửi email thông báo cho quản trị project.'
            : 'Đã lưu Team Sync. Cảm ơn bạn!';
      } catch (e) {
        error = e?.message ?? 'Không lưu được Team Sync.';
      }
      renderShell();
    });
  };

  try {
    const { entry } = await invoke('getMyStandupToday', { projectKey, date: todayIso() });
    if (entry) {
      alreadyLogged = true;
      message = 'Bạn đã ghi Team Sync hôm nay. Gửi lại nếu muốn cập nhật nội dung.';
      form.setRows(
        fieldsToRows(
          {
            yesterday: extractPlainText(entry.yesterday),
            today: extractPlainText(entry.today),
            blockers: extractPlainText(entry.blockers),
          },
          { defaultRowCount: createDefaultRows().length }
        )
      );
      const keys = collectStoredIssueKeys(entry);
      if (keys.length) {
        form.setIssues(await enrichIssues(keys.map((key) => ({ key, url: '' }))));
      } else {
        form.setIssues([]);
      }
    }
  } catch {
    // ignore load errors
  }

  renderShell();
}
