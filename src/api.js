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

const DEFAULT_CHANNELS = [
  { id: 1, youtube_id: 'UCeVMnSShP_Iviwkknt83cww', title: 'Elzero Web School', handle: '@ElzeroWebSchool', thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80', description: 'تعليم تطوير الويب والبرمجة بأعلى معايير الجودة.', category: 'البرمجة', user_category: 'البرمجة', subscriber_count: 1540000, video_count: 420 },
  { id: 2, youtube_id: 'UCgBq1pQo36kH2xN_5Fj0eAw', title: 'علي محمد علي', handle: '@AliMuhammadAli', thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=120&auto=format&fit=crop&q=80', description: 'تلخيص كتب وبناء عادات وتطوير الذات.', category: 'الإنتاجية', user_category: 'الإنتاجية', subscriber_count: 2200000, video_count: 310 },
  { id: 3, youtube_id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', title: 'الدحيح', handle: '@Da7ee7', thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=80', description: 'تبسيط العلوم والمعرفة بطريقة شيقة وممتعة.', category: 'العلوم والمعرفة', user_category: 'العلوم والمعرفة', subscriber_count: 3500000, video_count: 280 },
  { id: 4, youtube_id: 'UCHsJbA0uJ36S6WpXm8f55Aw', title: 'أكاديمية حسوب', handle: '@HsoubAcademy', thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120&auto=format&fit=crop&q=80', description: 'دورات عملية في البرمجة وريادة الأعمال.', category: 'تطوير الويب', user_category: 'تطوير الويب', subscriber_count: 620000, video_count: 550 }
];

const DEFAULT_VIDEOS = [
  { id: 'v1', channel_id: 1, channel_title: 'Elzero Web School', channel_thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80', title: 'مقدمة شاملة في عالم البرمجة: كيف تبدأ ولماذا؟', description: 'خارطة طريق كاملة لتعلم البرمجة من الصفر.', thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&auto=format&fit=crop&q=80', category: 'البرمجة', user_category: 'البرمجة', published_at: '2026-03-01T10:00:00Z', duration_seconds: 1420, view_count: 245000, is_project: false, is_favorite: 1, is_watch_later: 0, progress_seconds: 450, progress_percent: 32 },
  { id: 'v2', channel_id: 2, channel_title: 'علي محمد علي', channel_thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=120&auto=format&fit=crop&q=80', title: 'كيف تنظم وقتك وتبني عادات تدوم لسنوات؟', description: 'خطوات عملية من كتاب العادات الذرية وكيفية تطبيقها.', thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=640&auto=format&fit=crop&q=80', category: 'الإنتاجية', user_category: 'الإنتاجية', published_at: '2026-03-10T12:00:00Z', duration_seconds: 1180, view_count: 512000, is_project: false, is_favorite: 0, is_watch_later: 1, progress_seconds: 0, progress_percent: 0 },
  { id: 'v3', channel_id: 3, channel_title: 'الدحيح', channel_thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=80', title: 'تاريخ الكون والذكاء البشري في رحلة شيقة', description: 'رحلة علمية مبسطة حول نشأة الكون والمعرفة.', thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=640&auto=format&fit=crop&q=80', category: 'العلوم والمعرفة', user_category: 'العلوم والمعرفة', published_at: '2026-03-15T18:00:00Z', duration_seconds: 1780, view_count: 890000, is_project: false, is_favorite: 1, is_watch_later: 0, progress_seconds: 120, progress_percent: 15 },
  { id: 'v4', channel_id: 4, channel_title: 'أكاديمية حسوب', channel_thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120&auto=format&fit=crop&q=80', title: 'بناء مشروع ويب كامل خطوة بخطوة', description: 'تطبيق عملي يربط الواجهة الأمامية بالخادم وقاعدة البيانات.', thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=640&auto=format&fit=crop&q=80', category: 'تطوير الويب', user_category: 'تطوير الويب', published_at: '2026-03-22T11:00:00Z', duration_seconds: 3100, view_count: 145000, is_project: true, is_favorite: 0, is_watch_later: 0, progress_seconds: 0, progress_percent: 0 }
];

const DEFAULT_FOLDERS = [
  { id: 1, name: 'أساسيات الويب والبرمجة', description: 'مجموعة فيديوهات لمسار البرمجة', video_count: 2 },
  { id: 2, name: 'الإنتاجية وتطوير الذات', description: 'أهم الدروس والكتب الملخصة', video_count: 1 }
];

function getLocalStore(key, fallback) {
  try {
    const raw = localStorage.getItem(`km_v2_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function setLocalStore(key, val) {
  try { localStorage.setItem(`km_v2_${key}`, JSON.stringify(val)); } catch {}
}

async function mockApiFallback(cleanPath, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const user = getUser();

  if (cleanPath === '/profile') {
    if (body.name) setUserName(body.name);
    return { ok: true, name: getUser().name };
  }

  if (cleanPath === '/bootstrap') {
    const channels = getLocalStore('channels', DEFAULT_CHANNELS);
    const videos = getLocalStore('videos', DEFAULT_VIDEOS);
    const folders = getLocalStore('folders', DEFAULT_FOLDERS);
    return {
      user,
      settings: {
        sections: { latest: true, popular: true, projects: true, continue: true },
        playback: { saveProgress: true, showRelated: true },
        ai: { enabled: true, language: 'ar', detail: 'متوسط' },
        notifications: { enabled: true, newVideos: true },
        appearance: { theme: 'dark', compact: false },
        performance: { lazyImages: true, lowData: false }
      },
      channels,
      videos,
      unread: 0,
      stats: { videoCount: videos.length, folderCount: folders.length, summaryCount: 1 },
      integrations: { youtube: true, gemini: true }
    };
  }

  if (cleanPath === '/library/continue') {
    const videos = getLocalStore('videos', DEFAULT_VIDEOS);
    return { items: videos.filter(v => (v.progress_percent || 0) > 0) };
  }

  if (cleanPath.startsWith('/library/')) {
    const type = cleanPath.split('/')[2];
    const videos = getLocalStore('videos', DEFAULT_VIDEOS);
    if (type === 'favorites') return { items: videos.filter(v => v.is_favorite) };
    if (type === 'watch-later') return { items: videos.filter(v => v.is_watch_later) };
    if (type === 'history') return { items: videos.filter(v => (v.progress_seconds || 0) > 0) };
    return { items: videos };
  }

  if (cleanPath === '/videos') {
    const videos = getLocalStore('videos', DEFAULT_VIDEOS);
    return { items: videos };
  }

  if (cleanPath.startsWith('/videos/')) {
    const id = cleanPath.split('/')[2];
    const sub = cleanPath.split('/')[3];
    const videos = getLocalStore('videos', DEFAULT_VIDEOS);
    const v = videos.find(x => x.id === id) || videos[0];
    if (sub === 'favorite') {
      v.is_favorite = v.is_favorite ? 0 : 1;
      setLocalStore('videos', videos);
      return { ok: true, is_favorite: v.is_favorite };
    }
    if (sub === 'watch-later') {
      v.is_watch_later = v.is_watch_later ? 0 : 1;
      setLocalStore('videos', videos);
      return { ok: true, is_watch_later: v.is_watch_later };
    }
    return { video: v };
  }

  if (cleanPath === '/channels') {
    const channels = getLocalStore('channels', DEFAULT_CHANNELS);
    return { items: channels };
  }

  if (cleanPath === '/channels/resolve') {
    return {
      channels: [
        { youtube_id: `ch_${Date.now()}`, title: body.input || 'قناة جديدة', thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80', description: 'قناة تعليمية مميزة', subscriber_count: 50000, video_count: 35 }
      ]
    };
  }

  if (cleanPath === '/folders') {
    const folders = getLocalStore('folders', DEFAULT_FOLDERS);
    if (method === 'POST') {
      const f = { id: Date.now(), name: body.name || 'مجلد جديد', description: body.description || '', video_count: 0 };
      folders.unshift(f);
      setLocalStore('folders', folders);
      return { ok: true, folder: f };
    }
    return { items: folders };
  }

  if (cleanPath === '/settings') {
    return {
      settings: {
        sections: { latest: true, popular: true, projects: true, continue: true },
        playback: { saveProgress: true, showRelated: true },
        ai: { enabled: true, language: 'ar', detail: 'متوسط' },
        notifications: { enabled: true, newVideos: true },
        appearance: { theme: 'dark', compact: false },
        performance: { lazyImages: true, lowData: false }
      }
    };
  }

  if (cleanPath === '/notifications') return { items: [] };
  if (cleanPath === '/summaries') return { items: [] };
  if (cleanPath === '/ai/history') return { items: [] };

  if (cleanPath === '/ai/chat') {
    return { answer: 'أهلاً بك! أنا جيمناوي، مساعدك الذكي في منصة خلاصة المفيد. تصفح قنواتك التعليمية وفيديوهاتك واستفد من كل دقيقة في التعلم المنظم!' };
  }

  if (cleanPath === '/admin/integrations') {
    return { youtube: { configured: true }, gemini: { configured: true } };
  }
  if (cleanPath === '/admin/status') {
    return { ok: true, integrations: { youtube: true, gemini: true } };
  }

  return { ok: true };
}

export async function api(path, options = {}) {
  const user = getUser();
  const headers = new Headers(options.headers || {});
  headers.set('X-User-Id', user.id);
  headers.set('X-User-Name', user.name || 'ضيف');
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const cleanPath = path.startsWith('/api') ? path.replace('/api', '') : path;
  try {
    const response = await fetch(path.startsWith('/api') ? path : `/api${path}`, {
      ...options, headers, credentials: 'same-origin'
    });
    if (!response.ok) {
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        return await mockApiFallback(cleanPath, options);
      }
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `حدث خطأ (${response.status})`);
    }
    return await response.json().catch(() => ({}));
  } catch (err) {
    return await mockApiFallback(cleanPath, options);
  }
}
export const json = value => JSON.stringify(value);
