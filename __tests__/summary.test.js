import {
  buildSprintSummary,
  buildWeeklySummary,
  filterEntriesByDateRange,
  getDefaultWeekStart,
  getSprintDateRange,
  getSprintEndDate,
  isProjectEnabled,
  SPRINT_SUMMARY_DAYS,
} from '../src/lib/summary.js';

describe('buildSprintSummary', () => {
  const entries = [
    {
      date: '2026-05-25',
      displayName: 'Alice',
      yesterday: 'A1',
      today: 'A2',
      blockers: 'None',
    },
    {
      date: '2026-05-25',
      displayName: 'Bob',
      yesterday: 'B1',
      today: 'B2',
      blockers: 'Waiting on review',
    },
    {
      date: '2026-05-27',
      displayName: 'Alice',
      yesterday: 'C1',
      today: 'C2',
      blockers: 'none',
    },
  ];

  it('builds markdown summary for a 2-week sprint window', () => {
    const summary = buildSprintSummary(entries, '2026-05-25');
    expect(summary.totalEntries).toBe(3);
    expect(summary.blockerCount).toBe(1);
    expect(summary.text).toContain('Alice');
    expect(summary.text).toContain('Tổng kết Team Sync sprint (2 tuần)');
    expect(summary.text).toContain('2026-05-26');
    expect(summary.sprintDates).toHaveLength(SPRINT_SUMMARY_DAYS);
    expect(summary.sprintEndDate).toBe(getSprintEndDate('2026-05-25'));
    expect(summary.days).toHaveLength(SPRINT_SUMMARY_DAYS);
  });

  it('keeps buildWeeklySummary as alias', () => {
    expect(buildWeeklySummary(entries, '2026-05-25').periodDays).toBe(SPRINT_SUMMARY_DAYS);
  });
});

describe('getSprintDateRange', () => {
  it('returns 14 consecutive dates', () => {
    const dates = getSprintDateRange('2026-06-01');
    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-06-01');
    expect(dates[13]).toBe('2026-06-14');
  });
});

describe('filterEntriesByDateRange', () => {
  const entries = [
    { date: '2026-05-01' },
    { date: '2026-05-15' },
    { date: '2026-05-30' },
  ];

  it('filters inclusive range', () => {
    const filtered = filterEntriesByDateRange(entries, '2026-05-10', '2026-05-20');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe('2026-05-15');
  });
});

describe('getDefaultWeekStart', () => {
  it('returns a Monday date string', () => {
    const monday = getDefaultWeekStart(new Date('2026-05-28T12:00:00.000Z'));
    expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const day = new Date(`${monday}T12:00:00.000Z`).getUTCDay();
    expect(day).toBe(1);
  });
});

describe('isProjectEnabled', () => {
  it('allows all projects when list is empty', () => {
    expect(isProjectEnabled('PROJ', { enabledProjects: [] }, { enabled: true })).toBe(true);
  });

  it('respects enabled project list', () => {
    expect(
      isProjectEnabled('PROJ', { enabledProjects: ['PROJ'] }, { enabled: true })
    ).toBe(true);
    expect(
      isProjectEnabled('OTHER', { enabledProjects: ['PROJ'] }, { enabled: true })
    ).toBe(false);
  });

  it('respects global disabled flag', () => {
    expect(isProjectEnabled('PROJ', { enabledProjects: [] }, { enabled: false })).toBe(false);
  });
});
