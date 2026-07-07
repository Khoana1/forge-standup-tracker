import Resolver from '@forge/resolver';
import { createLogger } from '../lib/logger.js';
import * as admin from './admin.js';
import * as dashboard from './dashboard.js';
import * as issuePanel from './issue-panel.js';
import * as standup from './standup.js';

const resolver = new Resolver();
const logger = createLogger('resolver');

const wrap = (name, handler) => {
  resolver.define(name, async (req) => {
    const timer = logger.timer(name);
    try {
      logger.info(`${name} invoked`, { accountId: req.context?.accountId ?? null });
      const result = await handler(req);
      timer.end({ resolver: name });
      return result;
    } catch (err) {
      timer.fail(err, { resolver: name });
      throw new Error(err?.message ?? 'An unexpected error occurred. Please try again.');
    }
  });
};

wrap('submitStandup', standup.submitStandup);
wrap('getMyStandupToday', standup.getMyStandupToday);
wrap('getTeamHistory', standup.getTeamHistory);
wrap('getWeeklySummary', standup.getWeeklySummary);
wrap('getAppStatus', standup.getAppStatus);

wrap('getProjectDashboard', dashboard.getProjectDashboard);
wrap('resolveBlocker', dashboard.resolveBlocker);
wrap('getUserAvatars', dashboard.getUserAvatars);

wrap('searchIssuesForLink', issuePanel.searchIssuesForLink);
wrap('getIssueStandupHistory', issuePanel.getIssueStandupHistory);
wrap('submitIssueStandup', issuePanel.submitIssueStandup);
wrap('enrichLinkedIssues', issuePanel.enrichLinkedIssues);
wrap('updateIssueStatus', issuePanel.updateIssueStatus);

wrap('getSettings', admin.getSettings);
wrap('saveSettings', admin.saveSettings);
wrap('getTeamConfiguration', admin.getTeamConfiguration);
wrap('saveTeamConfiguration', admin.saveTeamConfiguration);
wrap('getStandupDataMembers', admin.getStandupDataMembers);
wrap('purgeMemberStandupData', admin.purgeMemberStandupData);
wrap('exportStandupData', admin.exportStandupData);
wrap('purgeStandupData', admin.purgeStandupData);

export const handler = resolver.getDefinitions();
