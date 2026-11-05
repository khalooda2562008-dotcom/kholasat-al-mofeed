const USER_KEY = 'km_user_v1';
function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
}
function readUser() {
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (parsed?.id && parsed?.name !== undefined) return parsed;
  } catch {}
  const created = { id: makeId(), name: 'ضيف' };
  localStorage.setItem(USER_KEY, JSON.stringify(created));
  return created;
}
let currentUser = readUser();
export function getUser() { return currentUser; }
export function setUserName(name) {
  currentUser = { ...currentUser, name: String(name || 'ضيف').trim().slice(0,60) || 'ضيف' };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  return currentUser;
}
export function resetLocalUser() {
  localStorage.removeItem(USER_KEY);
  currentUser = { id: makeId(), name: 'ضيف' };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  return currentUser;
}
export async function api(path, options = {}) {
  const user = getUser();
  const headers = new Headers(options.headers || {});
  headers.set('X-User-Id', user.id);
  headers.set('X-User-Name', user.name || 'ضيف');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
    ...options, headers, credentials: 'same-origin'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `حدث خطأ (${response.status})`);
  return data;
}
export const json = value => JSON.stringify(value);
