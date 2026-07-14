import { extractPlainText } from './adf-helpers.js';

const CSV_HEADERS = [
  'date',
  'projectKey',
  'displayName',
  'accountId',
  'tasks',
  'progress',
  'problems',
  'blockerResolved',
  'linkedIssueKeys',
  'createdAt',
];

const escapeCsvCell = (value) => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

/** Build Excel-friendly CSV (UTF-8). Caller may prefix BOM for Excel. */
export const buildStandupCsv = (entries = []) => {
  const rows = (entries ?? []).map((entry) => {
    const cells = [
      entry.date ?? '',
      entry.projectKey ?? '',
      entry.displayName ?? '',
      entry.accountId ?? '',
      extractPlainText(entry.yesterday ?? ''),
      extractPlainText(entry.today ?? ''),
      extractPlainText(entry.blockers ?? ''),
      entry.blockerResolved ? 'yes' : 'no',
      (entry.linkedIssueKeys ?? []).join(' '),
      entry.createdAt ?? '',
    ];
    return cells.map(escapeCsvCell).join(',');
  });

  return [CSV_HEADERS.join(','), ...rows].join('\n');
};

export const standupExportFilename = (exportedAt = new Date()) => {
  const stamp = new Date(exportedAt).toISOString().slice(0, 10);
  return `team-sync-export-${stamp}.xlsx`;
};
