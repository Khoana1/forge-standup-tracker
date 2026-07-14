import { listActiveBlockers, summarizeBlockers } from '../lib/blocker-analytics.js';
import { hasActiveBlocker } from '../lib/blockers.js';
import { fetchActiveSprint } from '../lib/jira-sprint.js';
import { fetchMyDisplayName, fetchProjectRoleMembers, fetchUserAvatars } from '../lib/jira-users.js';
import { createLogger } from '../lib/logger.js';
import { assertProjectAdmin, getMyProjectPermissions, userHasGlobalPermission } from '../lib/permissions.js';
import { getGlobalSettings } from '../lib/settings.js';
import { addDays } from '../lib/summary.js';
import { queryProjectEntries, updateBlockerResolved } from '../lib/standup-store.js';
import {
  computeSprintCompletionRate,
  deriveTeamMembers,
  ensureViewerInMembers,
  filterEntriesToMembers,
  mergeTeamMembers,
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

  const accountId = context?.accountId ?? null;

  const [entries, settings, permissions, isJiraAdmin, activeSprint, projectRoleMembers] =
    await Promise.all([
      queryProjectEntries(projectKey, fromDate, toDate),
      getGlobalSettings(),
      getMyProjectPermissions(projectKey, accountId),
      userHasGlobalPermission('ADMINISTER'),
      fetchActiveSprint(projectKey),
      fetchProjectRoleMembers(projectKey),
    ]);

  const membersFromRoles =
    projectRoleMembers !== null
      ? mergeTeamMembers(projectRoleMembers, entries)
      : deriveTeamMembers(entries);

  const needsViewerName =
    Boolean(accountId) && !membersFromRoles.some((member) => member.accountId === accountId);
  const viewerDisplayName = needsViewerName ? await fetchMyDisplayName() : null;
  const members = ensureViewerInMembers(membersFromRoles, {
    accountId,
    displayName: viewerDisplayName,
  });

  const scopedEntries =
    projectRoleMembers !== null ? filterEntriesToMembers(entries, members) : entries;
  const todayEntries = scopedEntries.filter((e) => e.date === today);
  const filteredToday = memberFilter
    ? todayEntries.filter((e) => e.accountId === memberFilter)
    : todayEntries;

  const staleThreshold = settings.blockerAlertDays ?? 1;
  const activeBlockers = listActiveBlockers(scopedEntries, { today, staleThreshold });
  const blockerSummary = summarizeBlockers(activeBlockers);

  const sprintCompletion = computeSprintCompletionRate(scopedEntries, members);

  const memberCards = members.map((m) => {
    const logged = todayEntries.some((e) => e.accountId === m.accountId);
    return { ...m, loggedToday: logged };
  });

  const avatarAccountIds = [
    ...members.map((m) => m.accountId),
    ...filteredToday.map((e) => e.accountId),
  ];
  const avatars = await fetchUserAvatars(avatarAccountIds);

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
      blockerResolved: Boolean(e.blockerResolved),
      blockerResolution: e.blockerResolution ?? null,
      blockerResolvedAt: e.blockerResolvedAt ?? null,
      linkedIssueKeys: e.linkedIssueKeys ?? [],
      blockerIssueKey: e.blockerIssueKey ?? null,
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
        total: members.length,
        pending: Math.max(0, members.length - todayEntries.length),
      },
      sprintCompletion: sprintCompletion.rate,
      activeBlockers: blockerSummary.total,
      staleBlockers: blockerSummary.stale,
    },
    members: memberCards.map((m) => ({ ...m, avatarUrl: avatars[m.accountId] ?? '' })),
    timeline,
    avatars,
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
  await assertProjectAdmin(projectKey, context?.accountId);

  const updated = await updateBlockerResolved(projectKey, date, accountId, {
    resolved: true,
    resolutionPlan,
    resolvedBy: context?.accountId ?? null,
  });
  if (!updated) throw new Error('Standup entry not found.');

  timer.end({ action: 'resolveBlocker', projectKey, date, accountId });
  return { success: true, entry: updated };
};

export const getUserAvatars = async ({ payload }) => {
  const accountIds = payload?.accountIds ?? [];
  const avatars = await fetchUserAvatars(accountIds);
  return { avatars };
};
