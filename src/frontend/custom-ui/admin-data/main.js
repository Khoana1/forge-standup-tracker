import { invoke } from '@forge/bridge';
import { downloadExcelFromCsv, escapeHtml } from '../project-app/shared/dom.js';
import { userAvatarHtml } from '../project-app/shared/avatars.js';

const root = document.getElementById('root');

const formatDateRange = (firstDate, lastDate) => {
  if (!firstDate) return '';
  if (firstDate === lastDate) return firstDate;
  return `${firstDate} → ${lastDate}`;
};

const state = {
  members: [],
  membersLoading: true,
  loading: false,
  error: null,
  deleteSuccess: null,
  confirmingId: null,
  confirmingAll: false,
  exportMsg: null,
};

const setState = (patch) => {
  Object.assign(state, patch);
  render();
};

const loadMembers = async () => {
  setState({ membersLoading: true, error: null });
  try {
    const { members } = await invoke('getStandupDataMembers');
    setState({ members: members ?? [], membersLoading: false });
  } catch (e) {
    setState({
      membersLoading: false,
      error: e?.message ?? 'Không tải được danh sách thành viên.',
    });
  }
};

const handleExportExcel = async () => {
  setState({ loading: true, error: null, exportMsg: null });
  try {
    const payload = await invoke('exportStandupData');
    await downloadExcelFromCsv(payload.filename, payload.csv ?? '');
    setState({
      loading: false,
      exportMsg: `Đã tải ${payload.filename} (${payload.entryCount} bản ghi).`,
    });
  } catch (e) {
    setState({
      loading: false,
      error: e?.message ?? 'Không xuất được file Excel.',
    });
  }
};

const handleDeleteMember = async (member) => {
  setState({ loading: true, error: null, deleteSuccess: null });
  try {
    const result = await invoke('purgeMemberStandupData', { accountId: member.accountId });
    setState({
      loading: false,
      members: state.members.filter((m) => m.accountId !== member.accountId),
      confirmingId: null,
      deleteSuccess: {
        displayName: member.displayName,
        deleted: result.deleted,
      },
    });
  } catch (e) {
    setState({
      loading: false,
      error: e?.message ?? 'Không xóa được dữ liệu thành viên.',
    });
  }
};

const handleDeleteAll = async () => {
  setState({ loading: true, error: null, deleteSuccess: null });
  try {
    const result = await invoke('purgeStandupData', {
      confirm: 'DELETE_ALL_STANDUP_DATA',
    });
    setState({
      loading: false,
      members: [],
      confirmingAll: false,
      confirmingId: null,
      deleteSuccess: {
        displayName: 'toàn bộ dữ liệu Team Sync',
        deleted: result.deleted,
      },
    });
  } catch (e) {
    setState({
      loading: false,
      error: e?.message ?? 'Không xóa được toàn bộ dữ liệu.',
    });
  }
};

const memberRowHtml = (member) => {
  const isConfirming = state.confirmingId === member.accountId;
  const isDeleting = state.loading && isConfirming;
  return `
    <article class="member-row" data-account-id="${escapeHtml(member.accountId)}">
      <div class="member-row-main">
        <div class="member-row-info">
          ${userAvatarHtml(member.accountId, member.displayName, member.avatarUrl ?? '', 'member-row-avatar')}
          <div>
            <p class="member-row-name">${escapeHtml(member.displayName)}</p>
            <p class="member-row-meta">${member.entryCount} bản ghi · ${escapeHtml(member.projectKeys?.join(', ') || '—')}</p>
            <p class="member-row-meta">${escapeHtml(formatDateRange(member.firstDate, member.lastDate))}</p>
          </div>
        </div>
        ${
          !isConfirming
            ? `<button type="button" class="btn btn-danger" data-request-delete="${escapeHtml(member.accountId)}">Xóa dữ liệu</button>`
            : ''
        }
      </div>
      ${
        isConfirming
          ? `<div class="alert alert-warning">
              <p>Xóa toàn bộ ${member.entryCount} bản ghi của <strong>${escapeHtml(member.displayName)}</strong>?</p>
              <div class="row-actions">
                <button type="button" class="btn btn-danger" data-confirm-delete="${escapeHtml(member.accountId)}" ${isDeleting ? 'disabled' : ''}>
                  ${isDeleting ? 'Đang xóa…' : 'Xác nhận xóa'}
                </button>
                <button type="button" class="btn" data-cancel-delete ${isDeleting ? 'disabled' : ''}>Hủy</button>
              </div>
            </div>`
          : ''
      }
    </article>
  `;
};

const render = () => {
  if (!root) return;

  root.innerHTML = `
    <div class="page admin-data-page">
      <header class="page-header">
        <div>
          <h2 class="page-title">Dữ liệu &amp; quyền riêng tư</h2>
          <p class="page-subtitle">Chỉ Jira administrator mới truy cập được trang này.</p>
        </div>
      </header>

      ${state.error ? `<div class="alert alert-error"><p>${escapeHtml(state.error)}</p></div>` : ''}
      ${
        state.deleteSuccess
          ? `<div class="alert alert-success"><p>Đã xóa ${state.deleteSuccess.deleted} bản ghi của ${escapeHtml(state.deleteSuccess.displayName)}.</p></div>`
          : ''
      }
      ${
        state.exportMsg
          ? `<div class="alert alert-success"><p>${escapeHtml(state.exportMsg)}</p></div>`
          : ''
      }

      <section class="section">
        <h3 class="section-title">Thành viên có dữ liệu</h3>
        <p class="section-filter-hint">Xóa dữ liệu theo từng thành viên trên mọi project.</p>
        ${
          state.membersLoading
            ? '<div class="page-loading">Đang tải danh sách thành viên…</div>'
            : state.members.length === 0
              ? '<div class="alert alert-info"><p>Chưa có thành viên nào có dữ liệu Team Sync.</p></div>'
              : `<div class="member-rows">${state.members.map(memberRowHtml).join('')}</div>`
        }
      </section>

      <section class="section">
        <h3 class="section-title">Xuất Excel</h3>
        <p class="section-filter-hint">
          Tải file <strong>.xlsx</strong> về máy — mở bằng Microsoft Excel hoặc Google Sheets.
        </p>
        <button type="button" class="btn btn-primary" id="export-excel" ${state.loading ? 'disabled' : ''}>
          ${state.loading ? 'Đang xuất…' : 'Tải file Excel (.xlsx)'}
        </button>
      </section>

      <section class="section">
        <h3 class="section-title">Xóa toàn bộ dữ liệu</h3>
        <p class="section-filter-hint">Xóa mọi bản ghi Team Sync trên site. Cài đặt app vẫn được giữ.</p>
        ${
          !state.confirmingAll
            ? `<button type="button" class="btn btn-danger" id="request-purge-all" ${
                state.loading || state.members.length === 0 ? 'disabled' : ''
              }>Xóa toàn bộ dữ liệu</button>`
            : `<div class="alert alert-warning">
                <p><strong>Không thể hoàn tác.</strong> Xóa toàn bộ bản ghi Team Sync của mọi thành viên?</p>
                <div class="row-actions">
                  <button type="button" class="btn btn-danger" id="confirm-purge-all" ${state.loading ? 'disabled' : ''}>
                    ${state.loading ? 'Đang xóa…' : 'Xác nhận xóa toàn bộ'}
                  </button>
                  <button type="button" class="btn" id="cancel-purge-all" ${state.loading ? 'disabled' : ''}>Hủy</button>
                </div>
              </div>`
        }
      </section>

      <section class="section">
        <h3 class="section-title">Thông báo quyền riêng tư</h3>
        <p class="section-filter-hint">
          Dữ liệu lưu trong Forge app storage, tách theo từng Jira site. Không gửi cho bên thứ ba.
        </p>
      </section>
    </div>
  `;

  root.querySelector('#export-excel')?.addEventListener('click', handleExportExcel);

  root.querySelectorAll('[data-request-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setState({ confirmingId: btn.dataset.requestDelete, confirmingAll: false });
    });
  });

  root.querySelectorAll('[data-confirm-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const member = state.members.find((m) => m.accountId === btn.dataset.confirmDelete);
      if (member) handleDeleteMember(member);
    });
  });

  root.querySelector('[data-cancel-delete]')?.addEventListener('click', () => {
    setState({ confirmingId: null });
  });

  root.querySelector('#request-purge-all')?.addEventListener('click', () => {
    setState({ confirmingAll: true, confirmingId: null });
  });
  root.querySelector('#cancel-purge-all')?.addEventListener('click', () => {
    setState({ confirmingAll: false });
  });
  root.querySelector('#confirm-purge-all')?.addEventListener('click', handleDeleteAll);
};

await loadMembers();
