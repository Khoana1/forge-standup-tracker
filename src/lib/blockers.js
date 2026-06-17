const NONE_PATTERNS = ['none', 'không có', 'khong co', 'n/a', 'na', 'không', 'khong', 'no'];

export const hasActiveBlocker = (blockers, blockerResolved = false) => {
  if (blockerResolved) return false;
  if (!blockers || typeof blockers !== 'string') return false;
  const trimmed = blockers.trim().toLowerCase();
  if (!trimmed.length) return false;
  return !NONE_PATTERNS.some((p) => trimmed === p || trimmed.startsWith(`${p} `));
};

export const classifyBlockerType = (text) => {
  const lower = (text ?? '').toLowerCase();
  if (/redis|staging|deploy|pipeline|ci\/cd|devops|infra|server|docker|kubernetes/.test(lower)) {
    return 'infrastructure';
  }
  if (/access|permission|sandbox|account|credential|login|auth/.test(lower)) {
    return 'access';
  }
  if (/review|design|approval|sign.?off|feedback/.test(lower)) {
    return 'review';
  }
  if (/vendor|third.?party|external|api partner|dependency/.test(lower)) {
    return 'external';
  }
  return 'other';
};

export const BLOCKER_TYPE_LABELS = {
  infrastructure: 'Hạ tầng',
  access: 'Quyền truy cập',
  review: 'Review / phê duyệt',
  external: 'Bên ngoài',
  other: 'Khác',
};
