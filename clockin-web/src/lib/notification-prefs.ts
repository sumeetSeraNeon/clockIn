/**
 * Simple personal notification toggles (browser-local until a prefs API exists).
 * Manager feedback FIX 1 — "if easy".
 */

export type NotificationPrefs = {
  emailApprovals: boolean;
  emailDigest: boolean;
};

const DEFAULTS: NotificationPrefs = {
  emailApprovals: true,
  emailDigest: false,
};

function storageKey(userId: string) {
  return `clockin:notifyPrefs:${userId}`;
}

export function loadNotificationPrefs(userId: string): NotificationPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      emailApprovals: parsed.emailApprovals ?? DEFAULTS.emailApprovals,
      emailDigest: parsed.emailDigest ?? DEFAULTS.emailDigest,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
}
