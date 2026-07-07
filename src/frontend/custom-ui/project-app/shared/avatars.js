import { invoke } from '@forge/bridge';
import { avatarColor, escapeHtml, memberInitials } from './dom.js';

const cache = new Map();

export const loadAvatars = async (accountIds = []) => {
  const missing = [...new Set((accountIds ?? []).filter(Boolean))].filter((id) => !cache.has(id));
  if (missing.length) {
    try {
      const result = await invoke('getUserAvatars', { accountIds: missing });
      const avatars = result?.avatars ?? {};
      for (const id of missing) {
        cache.set(id, avatars[id] ?? '');
      }
    } catch {
      for (const id of missing) cache.set(id, '');
    }
  }
  const out = {};
  for (const id of accountIds ?? []) {
    if (id) out[id] = cache.get(id) ?? '';
  }
  return out;
};

export const userAvatarHtml = (accountId, displayName, avatarUrl, className = 'user-avatar') => {
  if (avatarUrl) {
    return `<img class="${className}" src="${escapeHtml(avatarUrl)}" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer" />`;
  }
  return `<span class="${className} entry-avatar-fallback" style="background:${avatarColor(accountId)}">${escapeHtml(memberInitials(displayName))}</span>`;
};
