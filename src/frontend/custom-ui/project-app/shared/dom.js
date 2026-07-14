export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const memberInitials = (name) =>
  (name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const AVATAR_COLORS = ['#0c66e4', '#1f845a', '#e56910', '#8270db', '#c9372c', '#5b7f24'];

export const avatarColor = (accountId) => {
  const s = accountId ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
};

export const formatTime = (iso) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
};

/** Download CSV with Excel-friendly UTF-8 BOM (Custom UI only). */
export const downloadCsvFile = (filename, csv) => {
  const blob = new Blob([`\uFEFF${csv ?? ''}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'team-sync-export.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

/**
 * Build a real .xlsx workbook from CSV text and trigger browser download.
 * Must run in Custom UI (has document + Blob).
 */
export const downloadExcelFromCsv = async (filename, csv) => {
  const XLSX = await import('xlsx');
  const parsed = XLSX.read(csv ?? '', { type: 'string', raw: false });
  const sourceName = parsed.SheetNames?.[0];
  const sourceSheet = sourceName ? parsed.Sheets[sourceName] : null;

  const workbook = XLSX.utils.book_new();
  const sheet = sourceSheet ?? XLSX.utils.aoa_to_sheet([['No data']]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Team Sync');

  const safeName = String(filename || 'team-sync-export.xlsx')
    .replace(/\.csv$/i, '.xlsx')
    .replace(/\.xlsx$/i, '.xlsx');
  XLSX.writeFile(workbook, safeName.endsWith('.xlsx') ? safeName : `${safeName}.xlsx`);
};
