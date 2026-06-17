import { listActiveBlockers, summarizeBlockers } from '../lib/blocker-analytics.js';
import { hasActiveBlocker } from '../lib/blockers.js';
import { fetchActiveSprint } from '../lib/jira-sprint.js';
import { createLogger } from '../lib/logger.js';
import { assertProjectAdmin, getMyProjectPermissions, userHasGlobalPermission } from '../lib/permissions.js';
import { getGlobalSettings } from '../lib/settings.js';
import { addDays } from '../lib/summary.js';
import { queryProjectEntries, updateBlockerResolved } from '../lib/standup-store.js';
import {
  computeSprintCompletionRate,
  deriveTeamMembers,
} from '../lib/team-health.js';
import { validateHistoryPayload, validateResolveBlockerPayload } from '../lib/validators.js';
import { assertProjectAllowed } from './standup.js';

const logger = createLogger('dashboard-resolver');

export const getProjectDashboard = async ({ payload, context }) => {
  const timer = logger.timer('getProjectDashboard');
  const validation = validateHistoryPayload({
    ...payload,
    fromDate: payload?.fromDate,
    toDate: payload?.toDate,
  });
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey } = payload;
  await assertProjectAllowed(projectKey);

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = payload.fromDate ?? addDays(today, -14);
  const toDate = payload.toDate ?? today;
  const memberFilter = payload.memberAccountId ?? null;

  const [entries, settings, permissions, isJiraAdmin, activeSprint] = await Promise.all([
    queryProjectEntries(projectKey, fromDate, toDate),
    getGlobalSettings(),
    getMyProjectPermissions(projectKey),
    userHasGlobalPermission('ADMINISTER'),
    fetchActiveSprint(projectKey),
  ]);

  const members = deriveTeamMembers(entries);
  const todayEntries = entries.filter((e) => e.date === today);
  const filteredToday = memberFilter
    ? todayEntries.filter((e) => e.accountId === memberFilter)
    : todayEntries;

  const staleThreshold = settings.blockerAlertDays ?? 1;
  const activeBlockers = listActiveBlockers(entries, { today, staleThreshold });
  const blockerSummary = summarizeBlockers(activeBlockers);

  const sprintCompletion = computeSprintCompletionRate(entries, members);

  const memberCards = members.map((m) => {
    const logged = todayEntries.some((e) => e.accountId === m.accountId);
    return { ...m, loggedToday: logged };
  });

  const timeline = filteredToday
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .map((e) => ({
      accountId: e.accountId,
      displayName: e.displayName,
      createdAt: e.createdAt,
      yesterday: e.yesterday,
      today: e.today,
      blockers: e.blockers,
      hasBlocker: hasActiveBlocker(e.blockers, e.blockerResolved),
      linkedIssueKeys: e.linkedIssueKeys ?? [],
    }));

  timer.end({ action: 'getProjectDashboard', projectKey });
  return {
    projectKey,
    today,
    accountId: context?.accountId ?? null,
    permissions: { ...permissions, isJiraAdmin },
    stats: {
      completionToday: {
        logged: todayEntries.length,
        total: Math.max(members.length, todayEntries.length),
        pending: Math.max(0, members.length - todayEntries.length),
      },
      sprintCompletion: sprintCompletion.rate,
      activeBlockers: blockerSummary.total,
      staleBlockers: blockerSummary.stale,
    },
    members: memberCards,
    timeline,
    activeBlockers,
    blockerSummary,
    settings: {
      standupWindowTime: settings.standupWindowTime,
      timezone: settings.timezone,
    },
    activeSprint,
  };
};

export const resolveBlocker = async ({ payload, context }) => {
  const timer = logger.timer('resolveBlocker');
  const validation = validateResolveBlockerPayload(payload);
  if (!validation.valid) throw new Error(validation.errors[0].message);

  const { projectKey, date, accountId, resolutionPlan } = payload;
  await assertProjectAllowed(projectKey);
  await assertProjectAdmin(projectKey);

  const updated = await updateBlockerResolved(projectKey, date, accountId, {
    resolved: true,
    resolutionPlan,
    resolvedBy: context?.accountId ?? null,
  });
  if (!updated) throw new Error('Standup entry not found.');

  timer.end({ action: 'resolveBlocker', projectKey, date, accountId });
  return { success: true, entry: updated };
};
