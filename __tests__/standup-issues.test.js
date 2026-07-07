import { allGroupedIssueKeys, groupStandupLinkedIssues } from '../src/lib/standup-issues.js';

describe('groupStandupLinkedIssues', () => {
  it('groups keys from standup fields and linked list', () => {
    const groups = groupStandupLinkedIssues({
      yesterday: 'Done SCRUM-1',
      today: 'Working on SCRUM-2',
      blockers: 'Blocked by SCRUM-3',
      linkedIssueKeys: ['SCRUM-4'],
      blockerIssueKey: null,
    });

    expect(groups.tasks).toEqual(['SCRUM-1', 'SCRUM-4']);
    expect(groups.progress).toEqual(['SCRUM-2']);
    expect(groups.problems).toEqual(['SCRUM-3']);
  });

  it('puts auto-created problem task in problems', () => {
    const groups = groupStandupLinkedIssues({
      yesterday: 'Task A',
      today: 'On track',
      blockers: 'Chán',
      linkedIssueKeys: ['SCRUM-1', 'SCRUM-62'],
      blockerIssueKey: 'SCRUM-62',
    });

    expect(groups.tasks).toEqual(['SCRUM-1']);
    expect(groups.problems).toEqual(['SCRUM-62']);
    expect(groups.progress).toEqual([]);
  });

  it('removes problem keys from tasks when both appear', () => {
    const groups = groupStandupLinkedIssues({
      yesterday: 'SCRUM-62',
      blockers: 'Chán',
      linkedIssueKeys: ['SCRUM-62'],
      blockerIssueKey: 'SCRUM-62',
    });

    expect(groups.tasks).toEqual([]);
    expect(groups.problems).toEqual(['SCRUM-62']);
  });
});

describe('allGroupedIssueKeys', () => {
  it('returns unique keys across groups', () => {
    expect(
      allGroupedIssueKeys({
        tasks: ['SCRUM-1'],
        progress: ['SCRUM-2'],
        problems: ['SCRUM-1'],
      })
    ).toEqual(['SCRUM-1', 'SCRUM-2']);
  });
});
