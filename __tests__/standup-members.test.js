import { summarizeStandupMembers } from '../src/lib/standup-store.js';

describe('summarizeStandupMembers', () => {
  it('returns empty array for no entries', () => {
    expect(summarizeStandupMembers([])).toEqual([]);
  });

  it('aggregates entries per accountId', () => {
    const members = summarizeStandupMembers([
      {
        accountId: 'u2',
        displayName: 'Bob',
        projectKey: 'DEV',
        date: '2026-06-02',
      },
      {
        accountId: 'u1',
        displayName: 'Alice',
        projectKey: 'PROJ',
        date: '2026-06-01',
      },
      {
        accountId: 'u1',
        displayName: 'Alice Nguyen',
        projectKey: 'DEV',
        date: '2026-06-10',
      },
    ]);

    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({
      accountId: 'u1',
      displayName: 'Alice Nguyen',
      entryCount: 2,
      projectKeys: ['DEV', 'PROJ'],
      firstDate: '2026-06-01',
      lastDate: '2026-06-10',
    });
    expect(members[1]).toMatchObject({
      accountId: 'u2',
      entryCount: 1,
      projectKeys: ['DEV'],
    });
  });
});
