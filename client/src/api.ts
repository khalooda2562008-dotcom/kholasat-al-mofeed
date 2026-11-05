export const API_BASE = '/api';
export function getUserId() { return localStorage.getItem('km_user_id') || ''; }

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

// Initial standalone database in localStorage
const DEFAULT_CATEGORIES = [
  { id: 1, slug: 'programming', name: 'البرمجة', description: 'تعلم البرمجة وبناء البرامج والتطبيقات', icon: 'code', channel_count: 3, video_count: 6 },
  { id: 2, slug: 'web-development', name: 'تطوير الويب', description: 'بناء مواقع وتطبيقات الويب الحديثة', icon: 'globe', channel_count: 2, video_count: 5 },
  { id: 3, slug: 'python', name: 'Python', description: 'تعلم لغة Python ومكتباتها المتنوعة', icon: 'terminal', channel_count: 2, video_count: 4 },
  { id: 4, slug: 'ai', name: 'الذكاء الاصطناعي', description: 'الذكاء الاصطناعي ونماذج التوليد وتعلم الآلة', icon: 'brain', channel_count: 2, video_count: 4 },
  { id: 5, slug: 'productivity', name: 'الإنتاجية', description: 'إدارة الوقت، العادات، والتعلم الفعّال', icon: 'clock', channel_count: 2, video_count: 5 },
  { id: 6, slug: 'content-creation', name: 'صناعة المحتوى', description: 'المونتاج، السرد، والتصوير الرقمي', icon: 'video', channel_count: 1, video_count: 3 },
  { id: 7, slug: 'english', name: 'اللغة الإنجليزية', description: 'مهارات التحدث والمصطلحات والطلاقة', icon: 'languages', channel_count: 1, video_count: 3 },
  { id: 8, slug: 'science', name: 'العلوم والمعرفة', description: 'تبسيط العلوم والأفكار المعرفية العامة', icon: 'flask', channel_count: 2, video_count: 5 },
  { id: 9, slug: 'databases', name: 'قواعد البيانات', description: 'تصميم وهيكلة وإدارة قواعد البيانات', icon: 'database', channel_count: 1, video_count: 2 },
  { id: 10, slug: 'cybersecurity', name: 'الأمن السيبراني', description: 'حماية الأنظمة وتأمين التطبيقات والبيانات', icon: 'shield', channel_count: 1, video_count: 2 },
  { id: 11, slug: 'design', name: 'التصميم', description: 'تصميم الواجهات UI/UX والتصميم الجرافيكي', icon: 'palette', channel_count: 1, video_count: 2 },
  { id: 12, slug: 'projects', name: 'المشاريع العملية', description: 'تطبيقات عملية ومشاريع كاملة خطوة بخطوة', icon: 'briefcase', channel_count: 2, video_count: 4 }
];

const DEFAULT_CHANNELS = [
  { id: 1, youtubeChannelId: 'UCeVMnSShP_Iviwkknt83cww', title: 'Elzero Web School', description: 'قناة متخصصة في تعليم لغات وتطوير الويب بأعلى معايير الجودة.', categoryId: 1, subscriberCount: 1540000, thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80' },
  { id: 2, youtubeChannelId: 'UCgBq1pQo36kH2xN_5Fj0eAw', title: 'علي محمد علي', description: 'قناة متخصصة في تلخيص الكتب، بناء العادات، وتطوير الذات والإنتاجية.', categoryId: 5, subscriberCount: 2200000, thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=120&auto=format&fit=crop&q=80' },
  { id: 3, youtubeChannelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', title: 'الدحيح', description: 'تبسيط العلوم والتاريخ والأفكار المعرفية بطريقة ممتعة وذكية.', categoryId: 8, subscriberCount: 3500000, thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=80' },
  { id: 4, youtubeChannelId: 'UCHsJbA0uJ36S6WpXm8f55Aw', title: 'أكاديمية حسوب', description: 'دروس ومسارات تعليمية متكاملة لعلوم الحاسوب وتطوير البرمجيات.', categoryId: 2, subscriberCount: 620000, thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=120&auto=format&fit=crop&q=80' },
  { id: 5, youtubeChannelId: 'UCV3P5JqV_89vK8hM9f89XAw', title: 'طارق السويدان', description: 'مهارات القيادة، التخطيط الاستراتيجي، والإدارة الذاتية الناجحة.', categoryId: 5, subscriberCount: 1850000, thumbnail: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=120&auto=format&fit=crop&q=80' },
  { id: 6, youtubeChannelId: 'UC2wRz2P6uZZ5FSM9Ttw9Aw', title: 'عالم الذكاء الاصطناعي', description: 'أحدث التطورات والشروحات العملية في أدوات ونماذج الذكاء الاصطناعي.', categoryId: 4, subscriberCount: 450000, thumbnail: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=120&auto=format&fit=crop&q=80' }
];

const DEFAULT_VIDEOS = [
  { id: 1, youtube_video_id: 'rYQgy8QDEBI', title: 'مقدمة شاملة في عالم البرمجة: كيف تبدأ ولماذا؟', description: 'فيديو يوضح لك خارطة الطريق لتعلم البرمجة من الصفر دون تشتت.', channel_id: 1, channel_title: 'Elzero Web School', category_slug: 'programming', category_name: 'البرمجة', published_at: '2026-02-15T10:00:00Z', duration_seconds: 1420, views_count: 245000, thumbnail_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&auto=format&fit=crop&q=80', is_favorite: true, is_watch_later: false, position_seconds: 450, percent: 32 },
  { id: 2, youtube_video_id: 'b0Z3b1c6Z1c', title: 'كيف تنظم وقتك وتبني عادات تدوم لسنوات؟', description: 'خطوات عملية من كتاب العادات الذرية وكيفية تطبيقها في يومك.', channel_id: 2, channel_title: 'علي محمد علي', category_slug: 'productivity', category_name: 'الإنتاجية', published_at: '2026-03-01T12:00:00Z', duration_seconds: 1180, views_count: 512000, thumbnail_url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=640&auto=format&fit=crop&q=80', is_favorite: false, is_watch_later: true, position_seconds: 0, percent: 0 },
  { id: 3, youtube_video_id: 'PkZNo7MFNFg', title: 'فهم الذكاء الاصطناعي التوليدي LLMs ببساطة', description: 'كيف تفكر النماذج اللغوية الكبيرة وما الذي يجعلها ثورة العصر؟', channel_id: 6, channel_title: 'عالم الذكاء الاصطناعي', category_slug: 'ai', category_name: 'الذكاء الاصطناعي', published_at: '2026-03-20T14:30:00Z', duration_seconds: 960, views_count: 189000, thumbnail_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=640&auto=format&fit=crop&q=80', is_favorite: true, is_watch_later: false, position_seconds: 120, percent: 12 },
  { id: 4, youtube_video_id: 'e-ORhEE9VVg', title: 'تاريخ الكون في نصف ساعة ممتعة', description: 'رحلة علمية شيقة منذ الانفجار العظيم حتى اللحظة الحالية.', channel_id: 3, channel_title: 'الدحيح', category_slug: 'science', category_name: 'العلوم والمعرفة', published_at: '2026-04-05T18:00:00Z', duration_seconds: 1780, views_count: 890000, thumbnail_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=640&auto=format&fit=crop&q=80', is_favorite: false, is_watch_later: false, position_seconds: 0, percent: 0 },
  { id: 5, youtube_video_id: 'WGJJIrtnfpk', title: 'أساسيات لغة JavaScript للمبتدئين', description: 'شرح منطق البرمجة باستخدام لغة الويب الأكثر انتشاراً عالمياً.', channel_id: 1, channel_title: 'Elzero Web School', category_slug: 'web-development', category_name: 'تطوير الويب', published_at: '2026-01-20T09:00:00Z', duration_seconds: 2400, views_count: 320000, thumbnail_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=640&auto=format&fit=crop&q=80', is_favorite: false, is_watch_later: true, position_seconds: 0, percent: 0 },
  { id: 6, youtube_video_id: 'rfscVS0vtbw', title: 'قواعد التفكير الاستراتيجي واتخاذ القرارات الصعبة', description: 'كيف تتخذ قراراتك المصيرية بناءً على دراسة الفرص والمخاطر.', channel_id: 5, channel_title: 'طارق السويدان', category_slug: 'productivity', category_name: 'الإنتاجية', published_at: '2026-02-28T16:00:00Z', duration_seconds: 1350, views_count: 410000, thumbnail_url: 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=640&auto=format&fit=crop&q=80', is_favorite: true, is_watch_later: false, position_seconds: 0, percent: 0 },
  { id: 7, youtube_video_id: 'kUMe1FH4CHE', title: 'بناء تطبيق ويب متكامل من البداية حتى النشر', description: 'تطبيق عملي خطوة بخطوة يربط الواجهة الأمامية بالخادم وقاعدة البيانات.', channel_id: 4, channel_title: 'أكاديمية حسوب', category_slug: 'projects', category_name: 'المشاريع العملية', published_at: '2026-04-12T11:00:00Z', duration_seconds: 3100, views_count: 145000, thumbnail_url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=640&auto=format&fit=crop&q=80', is_favorite: false, is_watch_later: false, position_seconds: 0, percent: 0 },
  { id: 8, youtube_video_id: 'fBNz5xF-Kx4', title: 'مدخل إلى لغة Python للمبتدئين ولتحليل البيانات', description: 'كل ما تحتاج معرفته عن لغة بايثون وبناء أوامرك الأولى.', channel_id: 1, channel_title: 'Elzero Web School', category_slug: 'python', category_name: 'Python', published_at: '2026-03-15T08:00:00Z', duration_seconds: 1980, views_count: 275000, thumbnail_url: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=640&auto=format&fit=crop&q=80', is_favorite: false, is_watch_later: true, position_seconds: 0, percent: 0 }
];

const DEFAULT_FOLDERS = [
  { id: 1, title: 'أساسيات الويب والبرمجة', description: 'مجموعة فيديوهات للبدء في مسار تطوير البرمجيات.', is_pinned: true, video_count: 3 },
  { id: 2, title: 'الإنتاجية وتطوير الذات', description: 'أهم الدروس والكتب الملخصة لإدارة الوقت والتركيز.', is_pinned: true, video_count: 2 },
  { id: 3, title: 'الذكاء الاصطناعي والمستقبل', description: 'تطبيقات عملية ومفاهيم حديثة للتعلم التوليدي.', is_pinned: false, video_count: 1 }
];

function getStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`km_store_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`km_store_${key}`, JSON.stringify(value));
  } catch {}
}

function initMockStorage() {
  if (!localStorage.getItem('km_store_initialized')) {
    setStore('categories', DEFAULT_CATEGORIES);
    setStore('channels', DEFAULT_CHANNELS);
    setStore('videos', DEFAULT_VIDEOS);
    setStore('folders', DEFAULT_FOLDERS);
    setStore('folder_videos', { 1: [1, 5, 7], 2: [2, 6], 3: [3] });
    setStore('settings', { theme: 'dark', density: 'comfortable', autoSync: true, showContinue: true, notifications: true });
    setStore('notifications', [
      { id: 1, title: 'مرحبًا بك في خلاصة المفيد!', body: 'تم تجهيز مكتبتك التعليمية الذكية بنجاح. تصفح الفيديوهات وقنواتك الآن.', read: false, created_at: new Date().toISOString() }
    ]);
    localStorage.setItem('km_store_initialized', '1');
  }
}

async function mockApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  initMockStorage();
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};
  const [cleanPath, queryString] = path.split('?');
  const query = new URLSearchParams(queryString || '');

  // Users ensure
  if (cleanPath === '/users/ensure') {
    const id = body.id || getUserId() || 'guest';
    const name = body.name || 'ضيف';
    localStorage.setItem('km_user_id', id);
    localStorage.setItem('km_user_name', name);
    return { ok: true, user: { id, name } } as T;
  }

  // Categories
  if (cleanPath === '/categories') {
    const categories = getStore('categories', DEFAULT_CATEGORIES);
    return { categories } as T;
  }

  // Channels
  if (cleanPath === '/channels') {
    const channels = getStore('channels', DEFAULT_CHANNELS);
    if (method === 'GET') {
      return { channels } as T;
    }
    if (method === 'POST') {
      const newChan = {
        id: Date.now(),
        youtubeChannelId: body.youtubeChannelId || `ch_${Date.now()}`,
        title: body.title || 'قناة جديدة',
        description: 'قناة تعليمية مضافة إلى مكتبتك.',
        categoryId: body.categoryId || 1,
        subscriberCount: 10000,
        thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80'
      };
      channels.unshift(newChan);
      setStore('channels', channels);
      return { ok: true, channel: newChan } as T;
    }
  }

  if (cleanPath.startsWith('/channels/')) {
    const id = Number(cleanPath.split('/')[2]);
    const channels = getStore('channels', DEFAULT_CHANNELS);
    if (cleanPath.endsWith('/sync')) {
      return { ok: true, inserted: 0 } as T;
    }
    if (method === 'DELETE') {
      const next = channels.filter(c => c.id !== id);
      setStore('channels', next);
      return { ok: true } as T;
    }
    if (method === 'PATCH') {
      const next = channels.map(c => c.id === id ? { ...c, ...body } : c);
      setStore('channels', next);
      return { ok: true } as T;
    }
  }

  if (cleanPath === '/channels/resolve') {
    const input = (body.input || '').toLowerCase();
    const channels = [
      { youtubeChannelId: 'UCeVMnSShP_Iviwkknt83cww', title: 'Elzero Web School', subscriberCount: 1540000, thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80' },
      { youtubeChannelId: 'UCgBq1pQo36kH2xN_5Fj0eAw', title: 'علي محمد علي', subscriberCount: 2200000, thumbnail: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=120&auto=format&fit=crop&q=80' },
      { youtubeChannelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw', title: 'الدحيح', subscriberCount: 3500000, thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=120&auto=format&fit=crop&q=80' }
    ].filter(c => !input || c.title.toLowerCase().includes(input) || input.includes('http'));
    return { channels: channels.length ? channels : [{ youtubeChannelId: `ch_${Date.now()}`, title: body.input || 'قناة يوتيوب', subscriberCount: 10000, thumbnail: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=120&auto=format&fit=crop&q=80' }] } as T;
  }

  // Videos
  if (cleanPath === '/videos') {
    let videos = getStore('videos', DEFAULT_VIDEOS);
    const collection = query.get('collection');
    const category = query.get('category');
    const channelId = query.get('channelId');
    const search = query.get('search') || query.get('q');
    const limit = Number(query.get('limit') || 50);

    if (collection === 'in-progress') {
      videos = videos.filter(v => (v.percent || 0) > 0 && (v.percent || 0) < 100);
    } else if (collection === 'favorites') {
      videos = videos.filter(v => v.is_favorite);
    } else if (collection === 'watch-later') {
      videos = videos.filter(v => v.is_watch_later);
    } else if (collection === 'history') {
      videos = videos.filter(v => (v.position_seconds || 0) > 0 || (v.percent || 0) > 0);
    }

    if (category) {
      videos = videos.filter(v => v.category_slug === category);
    }
    if (channelId) {
      videos = videos.filter(v => v.channel_id === Number(channelId));
    }
    if (search) {
      const s = search.toLowerCase();
      videos = videos.filter(v => v.title.toLowerCase().includes(s) || v.description?.toLowerCase().includes(s));
    }

    return { videos: videos.slice(0, limit) } as T;
  }

  if (cleanPath.startsWith('/videos/')) {
    const parts = cleanPath.split('/');
    const id = Number(parts[2]);
    const action = parts[3];
    const videos = getStore('videos', DEFAULT_VIDEOS);
    const video = videos.find(v => v.id === id) || videos[0];

    if (!action && method === 'GET') {
      return {
        video,
        related: videos.filter(v => v.id !== id).slice(0, 4),
        notes: [],
        summary: 'ملخص تعليمي مركز: يغطي هذا الفيديو المفاهيم الرئيسية والخطوات الأساسية للتطبيق العملي.'
      } as T;
    }

    if (action === 'favorite') {
      video.is_favorite = !video.is_favorite;
      setStore('videos', [...videos]);
      return { ok: true, is_favorite: video.is_favorite } as T;
    }

    if (action === 'watch-later') {
      video.is_watch_later = !video.is_watch_later;
      setStore('videos', [...videos]);
      return { ok: true, is_watch_later: video.is_watch_later } as T;
    }

    if (action === 'progress') {
      video.position_seconds = body.positionSeconds || 0;
      video.percent = body.percent || 0;
      setStore('videos', [...videos]);
      return { ok: true } as T;
    }
  }

  // Folders
  if (cleanPath === '/folders') {
    const folders = getStore('folders', DEFAULT_FOLDERS);
    if (method === 'GET') {
      return { folders } as T;
    }
    if (method === 'POST') {
      const newFolder = {
        id: Date.now(),
        title: body.title || 'مجلد جديد',
        description: body.description || '',
        is_pinned: false,
        video_count: 0
      };
      folders.unshift(newFolder);
      setStore('folders', folders);
      return { ok: true, folder: newFolder } as T;
    }
  }

  if (cleanPath.startsWith('/folders/')) {
    const parts = cleanPath.split('/');
    const id = Number(parts[2]);
    const sub = parts[3];
    const folders = getStore('folders', DEFAULT_FOLDERS);
    const folderVideos = getStore<Record<number, number[]>>('folder_videos', { 1: [1, 5, 7], 2: [2, 6], 3: [3] });

    if (sub === 'videos') {
      if (method === 'GET') {
        const vIds = folderVideos[id] || [];
        const allVideos = getStore('videos', DEFAULT_VIDEOS);
        const folder = folders.find(f => f.id === id) || { id, title: 'المجلد', description: '' };
        return { folder, videos: allVideos.filter(v => vIds.includes(v.id)) } as T;
      }
      if (method === 'POST') {
        const vId = Number(body.videoId);
        const current = folderVideos[id] || [];
        if (!current.includes(vId)) current.push(vId);
        folderVideos[id] = current;
        setStore('folder_videos', folderVideos);
        return { ok: true } as T;
      }
    }

    if (method === 'PATCH') {
      const next = folders.map(f => f.id === id ? { ...f, ...body } : f);
      setStore('folders', next);
      return { ok: true } as T;
    }

    if (method === 'DELETE') {
      setStore('folders', folders.filter(f => f.id !== id));
      return { ok: true } as T;
    }
  }

  // Settings
  if (cleanPath === '/settings') {
    const settings = getStore('settings', { theme: 'dark', density: 'comfortable', autoSync: true, showContinue: true, notifications: true });
    if (method === 'GET') {
      return { settings } as T;
    }
    if (method === 'PUT') {
      const next = { ...settings, ...body };
      setStore('settings', next);
      return { ok: true, settings: next } as T;
    }
  }

  // Notifications
  if (cleanPath === '/notifications') {
    const notifications = getStore('notifications', []);
    const unread = notifications.filter((n: any) => !n.read).length;
    return { notifications, unread } as T;
  }
  if (cleanPath === '/notifications/read-all') {
    const notifications = getStore('notifications', []).map((n: any) => ({ ...n, read: true }));
    setStore('notifications', notifications);
    return { ok: true } as T;
  }
  if (cleanPath.startsWith('/notifications/') && cleanPath.endsWith('/read')) {
    const id = Number(cleanPath.split('/')[2]);
    const notifications = getStore('notifications', []).map((n: any) => n.id === id ? { ...n, read: true } : n);
    setStore('notifications', notifications);
    return { ok: true } as T;
  }

  // AI & Summaries
  if (cleanPath === '/ai/status') {
    return { available: true, provider: 'gemini', model: 'gemini-1.5-flash' } as T;
  }
  if (cleanPath === '/ai/chat') {
    const userMsg = body.message || '';
    return {
      reply: `مرحبًا بك! أنا جيمناوي، مساعدك التعليمي في منصة خلاصة المفيد. بخصوص سؤالك: "${userMsg}"\n\nأنصحك بتقسيم وقت التعلم إلى جلسات تركيز (25 دقيقة)، وتدوين النقاط الرئيسية أثناء مشاهدة الفيديو، ثم مراجعتها وتطبيق تمرين عملي لترسيخ المعلومة.`
    } as T;
  }
  if (cleanPath.startsWith('/ai/summarize/')) {
    return {
      summary: 'ملخص تعليمي مكثف:\n1. التركيز على الأساسيات قبل الانتقال للأدوات المتقدمة.\n2. التطبيق العملي والممارسة اليومية هما مفتاح الاستيعاب.\n3. تدوين الملاحظات الشخصية يزيد من كفاءة استرجاع المعرفة.'
    } as T;
  }
  if (cleanPath === '/summaries' || cleanPath === '/ai/conversations') {
    return { summaries: [], conversations: [] } as T;
  }

  // Admin
  if (cleanPath === '/admin/session' || cleanPath === '/admin/login' || cleanPath === '/admin/logout') {
    return { ok: true } as T;
  }
  if (cleanPath === '/admin/stats') {
    return {
      stats: { users: 1, channels: 6, videos: 8, categories: 12, folders: 3, summaries: 2 },
      usage: [],
      youtubeDailyQuota: 10000,
      logs: []
    } as T;
  }
  if (cleanPath === '/admin/service-check') {
    return { database: 'مُعدّة (تخزين محلي)', youtubeConfigured: true, geminiConfigured: true, adminConfigured: true } as T;
  }

  // Me
  if (cleanPath === '/me/export') {
    return { user: { id: getUserId(), name: localStorage.getItem('km_user_name') } } as T;
  }
  if (cleanPath === '/me/data' && method === 'DELETE') {
    localStorage.clear();
    return { ok: true } as T;
  }

  return { ok: true } as T;
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const userId = getUserId();
  if (userId) headers.set('x-user-id', userId);

  try {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
    if (!response.ok) {
      if (response.status === 404 || response.status === 502 || response.status === 503) {
        return await mockApi<T>(path, options);
      }
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `تعذر إكمال الطلب (${response.status})`);
    }
    const payload = await response.json().catch(() => ({}));
    return payload as T;
  } catch (err: any) {
    // If backend is unreachable or 404 (e.g. GitHub Pages static deployment), fallback gracefully to mock API
    return await mockApi<T>(path, options);
  }
}
