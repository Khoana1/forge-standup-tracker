import { buildStandupCsv, standupExportFilename } from '../src/lib/export-csv.js';

describe('buildStandupCsv', () => {
  it('builds header and escaped rows for Excel', () => {
    const csv = buildStandupCsv([
      {
        date: '2026-07-13',
        projectKey: 'SCRUM',
        displayName: 'Khoa, Anh',
        accountId: 'abc',
        yesterday: 'Done A',
        today: 'Doing B',
        blockers: 'Sếp giữ lại\nline 2',
        blockerResolved: false,
        linkedIssueKeys: ['SCRUM-1', 'SCRUM-2'],
        createdAt: '2026-07-13T01:00:00.000Z',
      },
    ]);

    expect(csv.startsWith('date,projectKey,displayName,')).toBe(true);
    expect(csv).toContain('"Khoa, Anh"');
    expect(csv).toContain('SCRUM-1 SCRUM-2');
    expect(csv).toContain('Sếp giữ lại');
  });

  it('returns header only for empty entries', () => {
    expect(buildStandupCsv([])).toBe(
      'date,projectKey,displayName,accountId,tasks,progress,problems,blockerResolved,linkedIssueKeys,createdAt'
    );
  });
});

describe('standupExportFilename', () => {
  it('uses ISO date stamp', () => {
    expect(standupExportFilename('2026-07-14T10:00:00.000Z')).toBe('team-sync-export-2026-07-14.xlsx');
  });
});
