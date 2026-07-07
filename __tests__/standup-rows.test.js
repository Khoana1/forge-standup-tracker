import {
  createDefaultRows,
  DEFAULT_STANDUP_ROW_COUNT,
  estimateTextareaLines,
  fieldsToRows,
  getSharedRowMinRows,
  isRowEmpty,
  rowsToFields,
} from '../src/lib/standup-rows.js';

describe('standup-rows', () => {
  it('creates default empty rows', () => {
    const rows = createDefaultRows();
    expect(rows).toHaveLength(DEFAULT_STANDUP_ROW_COUNT);
    expect(rows.every(isRowEmpty)).toBe(true);
  });

  it('round-trips multi-line columns', () => {
    const rows = [
      { id: '1', tasks: 'Task A', progress: 'Done', problems: '' },
      { id: '2', tasks: 'Task B', progress: '50%', problems: 'Blocked by API' },
    ];
    const fields = rowsToFields(rows);
    expect(fields).toEqual({
      yesterday: 'Task A\nTask B',
      today: 'Done\n50%',
      blockers: 'Blocked by API',
    });

    const parsed = fieldsToRows(fields, { defaultRowCount: 2 });
    expect(parsed).toHaveLength(2);
    expect(parsed[0].tasks).toBe('Task A');
    expect(parsed[0].problems).toBe('Blocked by API');
    expect(parsed[1].tasks).toBe('Task B');
  });

  it('uses default problems when column is empty', () => {
    const rows = createDefaultRows(1);
    expect(rowsToFields(rows).blockers).toBe('Không có');
  });

  it('pads to default row count for empty entry', () => {
    const rows = fieldsToRows({ yesterday: '', today: '', blockers: '' });
    expect(rows).toHaveLength(DEFAULT_STANDUP_ROW_COUNT);
  });

  it('maps legacy single-paragraph entry to first row', () => {
    const rows = fieldsToRows({
      yesterday: 'One task block',
      today: 'In progress',
      blockers: 'Không có',
    });
    expect(rows[0].tasks).toBe('One task block');
    expect(rows[0].progress).toBe('In progress');
    expect(rows.length).toBeGreaterThanOrEqual(DEFAULT_STANDUP_ROW_COUNT);
  });

  it('estimates wrapped lines for tall single-line text', () => {
    const longLine = 'Xin chào '.repeat(30);
    expect(estimateTextareaLines(longLine)).toBeGreaterThan(2);
    expect(getSharedRowMinRows({ tasks: longLine, progress: '', problems: '' })).toBeGreaterThan(
      2
    );
  });
});
