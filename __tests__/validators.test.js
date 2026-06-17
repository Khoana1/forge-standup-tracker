import {
  validateHistoryPayload,
  validateSettingsPayload,
  validateSubmitStandupPayload,
  validateTeamConfigPayload,
} from '../src/lib/validators.js';

describe('validateSubmitStandupPayload', () => {
  it('accepts valid standup payload', () => {
    const result = validateSubmitStandupPayload({
      projectKey: 'PROJ',
      yesterday: 'Finished API',
      today: 'Write tests',
      blockers: 'None',
    });
    expect(result.valid).toBe(true);
    expect(result.projectKey).toBe('PROJ');
  });

  it('rejects invalid project key', () => {
    const result = validateSubmitStandupPayload({
      projectKey: 'bad key',
      yesterday: 'a',
      today: 'b',
      blockers: 'c',
    });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe('projectKey');
  });

  it('rejects empty standup fields', () => {
    const result = validateSubmitStandupPayload({
      projectKey: 'PROJ',
      yesterday: '   ',
      today: 'Today',
      blockers: 'None',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateHistoryPayload', () => {
  it('requires project key', () => {
    const result = validateHistoryPayload({});
    expect(result.valid).toBe(false);
  });

  it('rejects inverted date range', () => {
    const result = validateHistoryPayload({
      projectKey: 'PROJ',
      fromDate: '2026-06-01',
      toDate: '2026-05-01',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateSettingsPayload', () => {
  it('accepts valid settings', () => {
    const result = validateSettingsPayload({
      enabled: true,
      retentionDays: 90,
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(result.valid).toBe(true);
  });

  it('rejects retention below minimum', () => {
    const result = validateSettingsPayload({
      enabled: true,
      retentionDays: 3,
      timezone: 'UTC',
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateTeamConfigPayload', () => {
  it('accepts empty project list', () => {
    const result = validateTeamConfigPayload({ enabledProjects: [] });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid project keys in list', () => {
    const result = validateTeamConfigPayload({ enabledProjects: ['PROJ', 'not valid'] });
    expect(result.valid).toBe(false);
  });
});
