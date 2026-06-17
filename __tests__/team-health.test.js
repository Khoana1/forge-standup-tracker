import { hasActiveBlocker, classifyBlockerType } from '../src/lib/blockers.js';
import {
  buildBlockerAnalytics,
  summarizeBlockers,
  mapActiveBlocker,
} from '../src/lib/blocker-analytics.js';
import { deriveTeamMembers, computeSprintCompletionRate } from '../src/lib/team-health.js';

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
