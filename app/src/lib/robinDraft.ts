const ROBIN_DRAFT_STORAGE_KEY = 'spouse-interview:robin-draft';

export function saveRobinDraft(draft?: string) {
  const text = String(draft || '').trim().slice(0, 1200);
  if (!text || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ROBIN_DRAFT_STORAGE_KEY, text);
  } catch {
    // Ignore storage failures; Robin still opens normally.
  }
}

export function consumeRobinDraft() {
  if (typeof window === 'undefined') return '';
  try {
    const draft = window.localStorage.getItem(ROBIN_DRAFT_STORAGE_KEY) || '';
    window.localStorage.removeItem(ROBIN_DRAFT_STORAGE_KEY);
    return draft.trim().slice(0, 1200);
  } catch {
    return '';
  }
}
