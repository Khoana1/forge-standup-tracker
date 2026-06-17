/** DatePicker display format (Atlaskit / moment-style tokens). */
export const DISPLAY_DATE_FORMAT = 'DD/MM/YYYY';

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const isoToDisplay = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/** Ngắn gọn cho tiêu đề timeline, ví dụ "5 thg 6". */
export const isoToDayMonth = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso ?? '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' });
};

export const displayToIso = (display) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(display ?? '').trim());
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
};

export const addDaysIso = (iso, days) => {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const mondayOfWeekIso = (referenceDate = new Date()) => {
  const d = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};
