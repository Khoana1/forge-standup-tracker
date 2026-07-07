import {
  notifyProblemIfNeeded,
  shouldNotifyProjectAdminsOnProblem,
} from '../src/lib/problem-notify.js';

jest.mock('../src/lib/jira-issues.js', () => ({
  findLatestProjectIssueKey: jest.fn(),
}));

jest.mock('../src/lib/jira-users.js', () => ({
  fetchProjectAdministratorIds: jest.fn(),
}));

import { findLatestProjectIssueKey } from '../src/lib/jira-issues.js';
import { fetchProjectAdministratorIds } from '../src/lib/jira-users.js';

const baseEntry = {
  accountId: 'user-1',
  displayName: 'Alice',
  projectKey: 'SCRUM',
  date: '2026-06-17',
  yesterday: 'Task A',
  today: 'Task B',
  blockers: 'Waiting for API access',
  blockerResolved: false,
};

describe('shouldNotifyProjectAdminsOnProblem', () => {
  it('returns false when problems is empty-like', () => {
    expect(
      shouldNotifyProjectAdminsOnProblem({
        entry: { ...baseEntry, blockers: 'Không có' },
        existingEntry: null,
      })
    ).toBe(false);
  });

  it('returns true for a new active problem', () => {
    expect(
      shouldNotifyProjectAdminsOnProblem({
        entry: baseEntry,
        existingEntry: null,
      })
    ).toBe(true);
  });

  it('returns false when the same problem is saved again', () => {
    expect(
      shouldNotifyProjectAdminsOnProblem({
        entry: baseEntry,
        existingEntry: { ...baseEntry },
      })
    ).toBe(false);
  });

  it('returns true when problem text changes', () => {
    expect(
      shouldNotifyProjectAdminsOnProblem({
        entry: { ...baseEntry, blockers: 'Blocked by vendor' },
        existingEntry: baseEntry,
      })
    ).toBe(true);
  });
});

describe('notifyProblemIfNeeded', () => {
  beforeEach(() => {
    findLatestProjectIssueKey.mockReset();
    fetchProjectAdministratorIds.mockReset();
  });

  it('skips when notifications are disabled', async () => {
    const result = await notifyProblemIfNeeded({
      entry: baseEntry,
      existingEntry: null,
      settings: { notifyProjectAdminsOnProblem: false },
    });
    expect(result.skipped).toBe('disabled');
    expect(fetchProjectAdministratorIds).not.toHaveBeenCalled();
  });

  it('skips when notification is not needed', async () => {
    const result = await notifyProblemIfNeeded({
      entry: baseEntry,
      existingEntry: baseEntry,
      settings: { notifyProjectAdminsOnProblem: true },
    });
    expect(result.skipped).toBe('not_needed');
  });

  it('skips when project has no administrators', async () => {
    fetchProjectAdministratorIds.mockResolvedValue([]);
    const result = await notifyProblemIfNeeded({
      entry: baseEntry,
      existingEntry: null,
      settings: { notifyProjectAdminsOnProblem: true },
    });
    expect(result.skipped).toBe('no_recipients');
  });

  it('skips when project has no issues for notify anchor', async () => {
    fetchProjectAdministratorIds.mockResolvedValue(['admin-1']);
    findLatestProjectIssueKey.mockResolvedValue(null);
    const result = await notifyProblemIfNeeded({
      entry: baseEntry,
      existingEntry: null,
      settings: { notifyProjectAdminsOnProblem: true },
    });
    expect(result.skipped).toBe('no_issue');
  });
});
