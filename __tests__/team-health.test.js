import { hasActiveBlocker, classifyBlockerType, hadBlockerContent } from '../src/lib/blockers.js';
import {
  buildBlockerAnalytics,
  summarizeBlockers,
  mapActiveBlocker,
} from '../src/lib/blocker-analytics.js';
import {
  deriveTeamMembers,
  mergeTeamMembers,
  filterEntriesToMembers,
  computeSprintCompletionRate,
} from '../src/lib/team-health.js';
import { isAllowedProjectRoleName } from '../src/lib/jira-users.js';

describe('hasActiveBlocker', () => {
  it('treats none-like values as inactive', () => {
    expect(hasActiveBlocker('None')).toBe(false);
    expect(hasActiveBlocker('Không có')).toBe(false);
  });

  it('detects real blockers', () => {
    expect(hasActiveBlocker('Waiting on Redis staging')).toBe(true);
  });

  it('respects resolved flag', () => {
    expect(hasActiveBlocker('Redis down', true)).toBe(false);
  });

  it('hadBlockerContent detects real blockers', () => {
    expect(hadBlockerContent('Chán')).toBe(true);
    expect(hadBlockerContent('Không có')).toBe(false);
  });
});

describe('deriveTeamMembers', () => {
  it('returns unique members from recent entries', () => {
    const members = deriveTeamMembers(
      [
        { accountId: '1', displayName: 'Alice', date: '2026-05-28' },
        { accountId: '2', displayName: 'Bob', date: '2026-05-28' },
        { accountId: '1', displayName: 'Alice', date: '2026-05-27' },
      ],
      14,
      new Date('2026-05-29T12:00:00.000Z')
    );
    expect(members).toHaveLength(2);
  });
});

describe('mergeTeamMembers', () => {
  it('includes all Jira project members even without standup entries', () => {
    const members = mergeTeamMembers(
      [
        { accountId: '1', displayName: 'Alice' },
        { accountId: '2', displayName: 'Bob' },
        { accountId: '3', displayName: 'Carol' },
      ],
      [{ accountId: '1', displayName: 'Alice', date: '2026-05-28' }],
      14,
      new Date('2026-05-29T12:00:00.000Z')
    );
    expect(members).toHaveLength(3);
    expect(members.map((m) => m.accountId)).toEqual(['1', '2', '3']);
  });

  it('excludes standup-only users who are not in project roles', () => {
    const members = mergeTeamMembers(
      [{ accountId: '1', displayName: 'Alice' }],
      [
        { accountId: '1', displayName: 'Alice', date: '2026-05-28' },
        { accountId: '9', displayName: 'Former', date: '2026-05-28' },
      ],
      14,
      new Date('2026-05-29T12:00:00.000Z')
    );
    expect(members).toHaveLength(1);
    expect(members[0].accountId).toBe('1');
  });
});

describe('filterEntriesToMembers', () => {
  it('drops entries from users outside the allowed member list', () => {
    const filtered = filterEntriesToMembers(
      [
        { accountId: '1', date: '2026-05-28' },
        { accountId: '9', date: '2026-05-28' },
      ],
      [{ accountId: '1', displayName: 'Alice' }]
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].accountId).toBe('1');
  });
});

describe('isAllowedProjectRoleName', () => {
  it('allows member and administrator roles only', () => {
    expect(isAllowedProjectRoleName('Member')).toBe(true);
    expect(isAllowedProjectRoleName('Administrators')).toBe(true);
    expect(isAllowedProjectRoleName('atlassian-addons-project-access')).toBe(false);
    expect(isAllowedProjectRoleName('Viewers')).toBe(false);
  });
});

describe('computeSprintCompletionRate', () => {
  it('returns participation rate for working days', () => {
    const members = [{ accountId: 'a', displayName: 'A' }];
    const today = '2026-05-29';
    const entries = [{ accountId: 'a', date: today }];
    const result = computeSprintCompletionRate(entries, members, new Date(`${today}T12:00:00.000Z`));
    expect(result.rate).toBeGreaterThanOrEqual(0);
  });
});

describe('blocker analytics', () => {
  it('classifies infrastructure blockers', () => {
    expect(classifyBlockerType('Redis staging is down')).toBe('infrastructure');
  });

  it('builds member and type counts', () => {
    const analytics = buildBlockerAnalytics([
      { displayName: 'A', date: '2026-05-29', blockers: 'Redis staging' },
      { displayName: 'A', date: '2026-05-28', blockers: 'Need access' },
    ]);
    expect(analytics.totalActive).toBe(2);
    expect(analytics.byMember[0].count).toBe(2);
    expect(analytics.byMember[0].percent).toBe(100);
  });

  it('summarizes blockers by today and stale', () => {
    const today = '2026-05-29';
    const blockers = [
      mapActiveBlocker(
        { key: '1', date: today, blockers: 'Redis', displayName: 'A' },
        today,
        1
      ),
      mapActiveBlocker(
        { key: '2', date: '2026-05-27', blockers: 'Access', displayName: 'B' },
        today,
        1
      ),
    ];
    const summary = summarizeBlockers(blockers);
    expect(summary.total).toBe(2);
    expect(summary.today).toBe(1);
    expect(summary.stale).toBe(1);
  });
});
