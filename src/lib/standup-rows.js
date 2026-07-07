/** Row helpers for Team Sync table input — maps to yesterday / today / blockers fields. */

export const DEFAULT_STANDUP_ROW_COUNT = 3;

const splitColumnLines = (text) => (text ?? '').split(/\n/);

const joinColumnLines = (cells) => cells.map((cell) => cell.trim()).filter(Boolean).join('\n');

let rowIdCounter = 0;

export const createRowId = () => {
  rowIdCounter += 1;
  return `standup-row-${rowIdCounter}-${Date.now()}`;
};

/** @returns {{ id: string, tasks: string, progress: string, problems: string }[]} */
export const createDefaultRows = (count = DEFAULT_STANDUP_ROW_COUNT) =>
  Array.from({ length: count }, () => ({
    id: createRowId(),
    tasks: '',
    progress: '',
    problems: '',
  }));

/**
 * Parse stored standup fields into table rows.
 * Legacy single-paragraph entries become row 1; pad to defaultRowCount when empty.
 */
export const fieldsToRows = (
  { yesterday = '', today = '', blockers = '' },
  { defaultRowCount = DEFAULT_STANDUP_ROW_COUNT } = {}
) => {
  const tasks = splitColumnLines(yesterday);
  const progress = splitColumnLines(today);
  const problems = splitColumnLines(blockers);
  const rowCount = Math.max(
    tasks.length,
    progress.length,
    problems.length,
    defaultRowCount
  );

  return Array.from({ length: rowCount }, (_, index) => ({
    id: createRowId(),
    tasks: (tasks[index] ?? '').trim(),
    progress: (progress[index] ?? '').trim(),
    problems: (problems[index] ?? '').trim(),
  }));
};

/** Serialize table rows back to standup field values (newline-separated per column). */
export const rowsToFields = (rows, defaultProblems = 'Không có') => {
  const tasks = rows.map((row) => row.tasks ?? '');
  const progress = rows.map((row) => row.progress ?? '');
  const problems = rows.map((row) => row.problems ?? '');

  let blockers = joinColumnLines(problems);
  if (!blockers) blockers = defaultProblems;

  return {
    yesterday: joinColumnLines(tasks),
    today: joinColumnLines(progress),
    blockers,
  };
};

export const isRowEmpty = (row) =>
  !(row?.tasks ?? '').trim() &&
  !(row?.progress ?? '').trim() &&
  !(row?.problems ?? '').trim();

/** Visible line count including soft-wrapped long lines (for synced textarea height). */
export const estimateTextareaLines = (text, charsPerLine = 48) => {
  const value = text ?? '';
  if (!value.trim()) return 0;
  return value
    .split(/\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
};

export const getSharedTextareaMinRows = (row, minRows = 2) =>
  Math.max(
    minRows,
    estimateTextareaLines(row.tasks),
    estimateTextareaLines(row.problems)
  );

/** @deprecated Use getSharedTextareaMinRows — progress is a single-line field. */
export const getSharedRowMinRows = getSharedTextareaMinRows;
