import { invoke, view } from '@forge/bridge';
import { formatTeamSyncTitle, UI_COPY } from '../../../lib/labels.js';
import { renderDashboard } from './views/dashboard.js';
import { renderHistory } from './views/history.js';
import { renderLog } from './views/log.js';
import { renderSummary } from './views/summary.js';

const root = document.getElementById('root');

const VIEW_DASHBOARD = 'dashboard';
const VIEW_LOG = 'log';
const VIEW_HISTORY = 'history';
const VIEW_SUMMARY = 'summary';

const routeFromPathname = (pathname = '') => {
  const last = pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (last === VIEW_LOG) return VIEW_LOG;
  if (last === VIEW_HISTORY) return VIEW_HISTORY;
  if (last === VIEW_SUMMARY) return VIEW_SUMMARY;
  if (last === VIEW_DASHBOARD) return VIEW_DASHBOARD;
  return VIEW_DASHBOARD;
};

const ctx = {
  projectKey: null,
  sprintName: null,
  appDisabled: false,
  activeRoute: VIEW_DASHBOARD,
  memberFilter: '',
  logForm: null,
  historyFrom: null,
  historyTo: null,
  sprintStart: null,
  activeSprintStart: null,
  summary: null,
  pageTitle: 'Team Sync',
  teamSyncSubtitle: UI_COPY.teamSyncSubtitle,
};

const navigateLog = async () => {
  if (ctx.historyRef) {
    ctx.historyRef.push('/log');
  } else {
    ctx.activeRoute = VIEW_LOG;
    await render();
  }
};

const setMemberFilter = async (filter) => {
  ctx.memberFilter = filter;
  if (ctx.activeRoute === VIEW_DASHBOARD) await render();
};

const renderView = async (container) => {
  const viewCtx = {
    ...ctx,
    onNavigateLog: navigateLog,
    setMemberFilter,
  };

  switch (ctx.activeRoute) {
    case VIEW_DASHBOARD:
      await renderDashboard(container, viewCtx);
      break;
    case VIEW_LOG:
      await renderLog(container, viewCtx);
      break;
    case VIEW_HISTORY:
      await renderHistory(container, viewCtx);
      break;
    case VIEW_SUMMARY:
      await renderSummary(container, viewCtx);
      break;
    default:
      await renderDashboard(container, viewCtx);
  }
};

const render = async () => {
  if (!root) return;

  if (!ctx.projectKey) {
    root.innerHTML = `<div class="app-shell"><div class="alert alert-warning">Cần mở từ project — ${UI_COPY.noProject}</div></div>`;
    return;
  }

  if (ctx.appDisabled) {
    root.innerHTML = `<div class="app-shell"><div class="alert alert-warning">App chưa bật — ${UI_COPY.disabled}</div></div>`;
    return;
  }

  root.innerHTML = '<div class="app-shell"><div id="view-host"></div></div>';
  const host = root.querySelector('#view-host');
  await renderView(host);
};

const boot = async () => {
  if (!root) return;
  root.innerHTML = `<div class="app-shell"><div class="page-loading">${UI_COPY.loading}</div></div>`;

  try {
    const extensionCtx = await view.getContext();
    ctx.projectKey = extensionCtx?.extension?.project?.key ?? null;
  } catch {
    ctx.projectKey = null;
  }

  try {
    const history = await view.createHistory();
    ctx.historyRef = history;
    ctx.activeRoute = routeFromPathname(history.location.pathname);
    history.listen((loc) => {
      ctx.activeRoute = routeFromPathname(loc.pathname);
      render();
    });
  } catch {
    ctx.activeRoute = VIEW_DASHBOARD;
  }

  if (ctx.projectKey) {
    try {
      const status = await invoke('getAppStatus', { projectKey: ctx.projectKey });
      ctx.appDisabled = !status?.projectEnabled;
      ctx.sprintName = status?.activeSprint?.name ?? null;
      ctx.activeSprintStart = status?.activeSprint?.startDate?.slice(0, 10) ?? null;
      ctx.pageTitle = formatTeamSyncTitle(ctx.sprintName);
    } catch {
      ctx.appDisabled = false;
    }
  }

  await render();
};

boot();
