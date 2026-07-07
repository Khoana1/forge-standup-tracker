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
  tasks: 'Ghi rõ các task làm trong ngày',
  progress: 'Tiến độ công việc (Nhanh, chậm, đúng tiến độ)',
  problems: 'Ghi rõ các impediment cản trở công việc. Nếu không có, gõ «Không có».',
};

export const STANDUP_LINKED_WORK_ITEMS_TITLE = 'Work item làm việc hôm nay';

export const STANDUP_LINKED_ISSUES_HINT =
  'Gom mọi work item bạn làm hôm nay tại đây — dán nhiều link (mỗi dòng), mã work item (SCRUM-1), hoặc tìm theo tiêu đề.';

/** Tiêu đề cột bảng (rút gọn để vừa layout). */
export const STANDUP_TABLE_HEADERS = {
  tasks: 'Tasks',
  progress: 'Progress',
  problems: 'Problems',
};

export const STANDUP_PLACEHOLDER = {
  tasks: 'Ghi rõ các task làm trong ngày',
  progress: 'Tiến độ công việc (Nhanh, chậm, đúng tiến độ)',
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
