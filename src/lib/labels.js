/** Nhãn hiển thị — template Team Sync (Tasks / Progress / Problems). */

export const STANDUP_LABELS = {
  tasks: 'Tasks — Ưu tiên và công việc cần làm hôm nay',
  progress: 'Progress — Tiến độ đã đạt được',
  problems: 'Problems — Vấn đề hoặc trở ngại đang gặp phải',
};

/** Nhãn ngắn trên form — khớp cột biên bản Team Sync. */
export const STANDUP_LABELS_SHORT = {
  tasks: 'Tasks',
  progress: 'Progress',
  problems: 'Problems',
};

export const STANDUP_HINTS = {
  tasks: 'Liệt kê ticket, task hoặc mục tiêu bạn tập trung hôm nay (mỗi dòng một mục).',
  progress: 'Mô tả tiến độ: DONE, đang làm, % hoàn thành, hoặc kết quả cụ thể.',
  problems: 'Ghi rõ vấn đề cần hỗ trợ. Nếu không có, gõ «Không có».',
};

/** Tiêu đề cột bảng (rút gọn để vừa layout). */
export const STANDUP_TABLE_HEADERS = {
  tasks: 'Tasks',
  progress: 'Progress',
  problems: 'Problems',
};

export const STANDUP_PLACEHOLDER = {
  tasks: 'Ví dụ: MOBIX-13031 — Xử lý rule điều hướng màn nhập thông tin…',
  progress: 'Ví dụ: DONE · Đang review · 80% hoàn thành…',
  problems: 'Không có',
};

export const UI_COPY = {
  teamSyncSubtitle:
    'Mọi thành viên cần báo cáo ưu tiên, tiến độ và vấn đề mỗi ngày trong biên bản Team Sync.',
  loading: 'Đang tải…',
  noProject: 'Mở trang này từ sidebar của một project Jira.',
  disabled:
    'App chưa bật cho project này. Liên hệ Jira admin để cấu hình Team Sync.',
};

/** Tiêu đề trang: `{Sprint} Team Sync` — khớp biên bản SMN. */
export const formatTeamSyncTitle = (sprintName) => {
  const trimmed = (sprintName ?? '').trim();
  return trimmed ? `${trimmed} Team Sync` : 'Team Sync';
};
