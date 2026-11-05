export const API_BASE = '/api';
export function getUserId() { return localStorage.getItem('km_user_id') || ''; }

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const userId = getUserId();
  if (userId) headers.set('x-user-id', userId);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `تعذر إكمال الطلب (${response.status})`);
  return payload as T;
}
export function formatViews(value: number | string) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')} مليون`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.0', '')} ألف`;
  return n.toLocaleString('ar-EG');
}
export function formatDuration(value: number) {
  const h = Math.floor(value / 3600); const m = Math.floor((value % 3600) / 60); const s = value % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
export function timeAgo(date?: string) {
  if (!date) return 'تاريخ غير متاح';
  const days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 86400000));
  if (days === 0) return 'اليوم'; if (days === 1) return 'منذ يوم'; if (days < 30) return `منذ ${days} يومًا`;
  const months = Math.floor(days / 30); if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
}
