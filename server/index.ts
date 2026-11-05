import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import cron from 'node-cron';
import { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 3001);
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-only-change-me-before-deploy';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });
const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: process.env.NODE_ENV === 'production' ? { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'","'unsafe-inline'",'https://www.youtube.com','https://www.google.com','https://apis.google.com'], styleSrc: ["'self'","'unsafe-inline'",'https://fonts.googleapis.com'], fontSrc: ["'self'",'https://fonts.gstatic.com','data:'], imgSrc: ["'self'",'data:','blob:','https:'], frameSrc: ["'self'",'https://www.youtube.com','https://www.youtube-nocookie.com','https://www.google.com'], connectSrc: ["'self'",'https://www.googleapis.com','https://generativelanguage.googleapis.com','https://www.youtube.com','https://youtube.com'], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'self'"] } } : false }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/ai', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, skip: (req) => req.path === '/health' || req.path === '/ready' }));

const asyncRoute = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function userIdFrom(req: Request): string | null {
  const value = String(req.header('x-user-id') || '');
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
function requireUser(req: Request, res: Response): string | null {
  const id = userIdFrom(req);
  if (!id) { res.status(401).json({ error: 'يجب بدء جلسة مستخدم محلية أولًا.' }); return null; }
  return id;
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = (req as Request & { cookies?: Record<string,string> }).cookies?.kholasat_admin || String(req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'غير مصرح بالوصول.' });
  try { jwt.verify(token, SESSION_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'انتهت جلسة الإدارة أو أنها غير صالحة.' }); }
}

app.use((req, _res, next) => {
  // Cookie parsing kept intentionally small; no third-party session store is needed for signed admin tokens.
  const raw = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  raw.split(';').forEach(part => { const at = part.indexOf('='); if (at > -1) cookies[part.slice(0, at).trim()] = decodeURIComponent(part.slice(at + 1).trim()); });
  (req as Request & { cookies?: Record<string, string> }).cookies = cookies;
  next();
});

async function db<T extends Record<string, any> = any>(sql: string, params: unknown[] = []) {
  return pool.query<T>(sql, params);
}
async function recordUsage(provider: string, operation: string, units: number, success: boolean, error = '', model = '') {
  try { await db('INSERT INTO api_usage_logs(provider, operation, units, success, error_message, model) VALUES($1,$2,$3,$4,$5,$6)', [provider, operation, units, success, error.slice(0, 500), model]); } catch (e) { console.error('usage log failure', e); }
}

const CATEGORY_MAP: Record<string, string> = {
  python: 'python', backend: 'backend', frontend: 'frontend', react: 'frontend', javascript: 'web-development', html: 'web-development', css: 'web-development',
  ai: 'ai', 'machine learning': 'ai', مونتاج: 'content-creation', تصوير: 'content-creation', youtube: 'content-creation', تصميم: 'design', english: 'english',
  sql: 'databases', database: 'databases', cybersecurity: 'cybersecurity', linux: 'programming', git: 'programming'
};
function autoCategory(title: string, description = ''): string | null {
  const text = `${title} ${description}`.toLowerCase();
  for (const [word, slug] of Object.entries(CATEGORY_MAP)) if (text.includes(word)) return slug;
  return null;
}

function parseIsoDuration(value = ''): number {
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

async function youtubeRequest(endpoint: string, params: Record<string, string>) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('لم يتم ضبط YOUTUBE_API_KEY في Secrets.');
  const quotaCost = endpoint === 'search' ? 100 : 1;
  const dailyLimit = Math.max(1, Number(process.env.YOUTUBE_DAILY_QUOTA || 10000));
  const usage = await db<any>("SELECT COALESCE(SUM(units),0)::int AS used FROM api_usage_logs WHERE provider='youtube' AND created_at >= date_trunc('day',NOW())");
  if (Number(usage.rows[0]?.used || 0) + quotaCost > dailyLimit) {
    await recordUsage('youtube',endpoint,0,false,'تم إيقاف الطلب قبل الإرسال لتجنب تجاوز حد الحصة التقديري.');
    throw new Error('تم الوصول إلى حد الحصة التقديري اليومي لـ YouTube API. احتفظنا بالبيانات القديمة؛ راجع Google Cloud Console.');
  }
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set('key', key);
  const response = await fetch(url);
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `YouTube API error ${response.status}`;
    await recordUsage('youtube', endpoint, quotaCost, false, message);
    throw new Error(message);
  }
  await recordUsage('youtube', endpoint, quotaCost, true);
  return payload;
}

async function resolveChannelInput(inputRaw: string) {
  const input = inputRaw.trim();
  if (!input) throw new Error('أدخل رابط القناة أو المعرّف أو اسم المستخدم.');
  const idMatch = input.match(/youtube\.com\/channel\/(UC[a-zA-Z0-9_-]+)/i);
  const handleMatch = input.match(/youtube\.com\/@([\w.-]+)/i);
  const bareId = input.match(/^(UC[a-zA-Z0-9_-]{20,})$/);
  const bareHandle = input.match(/^@?([\w.-]{3,})$/);
  if (idMatch || bareId) {
    const id = idMatch?.[1] || bareId?.[1] || '';
    const data: any = await youtubeRequest('channels', { part: 'snippet,statistics,contentDetails', id });
    return (data.items || []).map(mapChannel);
  }
  if (handleMatch || (input.startsWith('@') && bareHandle)) {
    const handle = handleMatch?.[1] || input.replace(/^@/, '');
    const data: any = await youtubeRequest('channels', { part: 'snippet,statistics,contentDetails', forHandle: handle });
    return (data.items || []).map(mapChannel);
  }
  const data: any = await youtubeRequest('search', { part: 'snippet', type: 'channel', q: input, maxResults: '6' });
  const ids = (data.items || []).map((x: any) => x.id?.channelId).filter(Boolean);
  if (!ids.length) return [];
  const details: any = await youtubeRequest('channels', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
  return (details.items || []).map(mapChannel);
}
function mapChannel(item: any) {
  return {
    youtubeChannelId: item.id,
    title: item.snippet?.title || 'قناة بدون اسم',
    description: item.snippet?.description || '',
    thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || '',
    subscriberCount: Number(item.statistics?.subscriberCount || 0),
    videoCount: Number(item.statistics?.videoCount || 0),
    viewCount: Number(item.statistics?.viewCount || 0),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads || ''
  };
}

async function saveChannelForUser(userId: string, channel: ReturnType<typeof mapChannel>, categoryId?: number | null) {
  const saved = await db<any>(`INSERT INTO channels(youtube_channel_id,title,description,thumbnail,subscriber_count,video_count,view_count,uploads_playlist_id,updated_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW())
    ON CONFLICT(youtube_channel_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,thumbnail=EXCLUDED.thumbnail,subscriber_count=EXCLUDED.subscriber_count,video_count=EXCLUDED.video_count,view_count=EXCLUDED.view_count,uploads_playlist_id=EXCLUDED.uploads_playlist_id,updated_at=NOW()
    RETURNING *`, [channel.youtubeChannelId, channel.title, channel.description, channel.thumbnail, channel.subscriberCount, channel.videoCount, channel.viewCount, channel.uploadsPlaylistId]);
  const channelId = saved.rows[0].id;
  await db(`INSERT INTO user_channels(user_id,channel_id,category_id,is_following) VALUES($1,$2,$3,TRUE)
    ON CONFLICT(user_id,channel_id) DO UPDATE SET category_id=COALESCE(EXCLUDED.category_id,user_channels.category_id),is_following=TRUE`, [userId, channelId, categoryId || null]);
  return saved.rows[0];
}

async function syncOneChannel(channelId: number) {
  const result = await db<any>('SELECT * FROM channels WHERE id=$1', [channelId]);
  const channel = result.rows[0];
  if (!channel?.uploads_playlist_id) return { inserted: 0, skipped: true };
  const playlist: any = await youtubeRequest('playlistItems', { part: 'snippet,contentDetails', playlistId: channel.uploads_playlist_id, maxResults: '25' });
  const videoIds = (playlist.items || []).map((x: any) => x.contentDetails?.videoId).filter(Boolean);
  if (!videoIds.length) return { inserted: 0 };
  const details: any = await youtubeRequest('videos', { part: 'snippet,contentDetails,statistics', id: videoIds.join(',') });
  let inserted = 0;
  for (const item of (details.items || [])) {
    const title = item.snippet?.title || 'فيديو بدون عنوان';
    const description = item.snippet?.description || '';
    const categorySlug = autoCategory(title, description);
    const category = categorySlug ? await db<any>('SELECT id FROM categories WHERE slug=$1', [categorySlug]) : { rows: [] } as any;
    const video = await db<any>(`INSERT INTO videos(youtube_video_id,channel_id,title,description,thumbnail,published_at,duration_seconds,view_count,category_id,tags)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT(youtube_video_id) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,thumbnail=EXCLUDED.thumbnail,view_count=EXCLUDED.view_count,duration_seconds=EXCLUDED.duration_seconds,updated_at=NOW()
      RETURNING id,(xmax = 0) AS was_inserted`, [item.id, channelId, title, description, item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || '', item.snippet?.publishedAt || null, parseIsoDuration(item.contentDetails?.duration), Number(item.statistics?.viewCount || 0), category.rows[0]?.id || null, item.snippet?.tags || []]);
    if (video.rows[0]?.was_inserted) {
      inserted++;
      await db(`INSERT INTO notifications(user_id,channel_id,video_id,title,body)
        SELECT uc.user_id,$1,$2,$3,$4 FROM user_channels uc LEFT JOIN user_settings us ON us.user_id=uc.user_id WHERE uc.channel_id=$1 AND uc.is_following=TRUE AND COALESCE((us.settings->>'notifications')::boolean,TRUE)=TRUE AND COALESCE((us.settings->>'newVideoNotifications')::boolean,TRUE)=TRUE`, [channelId, video.rows[0].id, 'فيديو جديد من ' + channel.title, title]);
    }
  }
  await db('UPDATE channels SET last_synced_at=NOW(),updated_at=NOW() WHERE id=$1', [channelId]);
  return { inserted };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'kholasat-al-mofeed', time: new Date().toISOString() }));
app.get('/api/ready', asyncRoute(async (_req, res) => {
  await db('SELECT 1');
  res.json({ ok: true, database: 'connected' });
}));

app.post('/api/users/ensure', asyncRoute(async (req, res) => {
  const schema = z.object({ id: z.string().uuid(), name: z.string().trim().max(50).optional().default('ضيف') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات المستخدم غير صحيحة.' });
  const { id, name } = parsed.data;
  const result = await db<any>(`INSERT INTO users(id,display_name) VALUES($1,$2)
    ON CONFLICT(id) DO UPDATE SET display_name=CASE WHEN $2 <> 'ضيف' AND $2 <> '' THEN $2 ELSE users.display_name END, updated_at=NOW()
    RETURNING id,display_name,created_at`, [id, name || 'ضيف']);
  res.json({ user: result.rows[0] });
}));
app.get('/api/categories', asyncRoute(async (_req, res) => {
  const result = await db('SELECT c.*, COUNT(DISTINCT v.id)::int AS video_count, COUNT(DISTINCT uc.channel_id)::int AS channel_count FROM categories c LEFT JOIN videos v ON v.category_id=c.id LEFT JOIN user_channels uc ON uc.category_id=c.id GROUP BY c.id ORDER BY c.name');
  res.json({ categories: result.rows });
}));

app.get('/api/channels', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const result = await db<any>(`SELECT c.*, uc.category_id, cat.name AS category_name, uc.is_following, uc.added_at,
      (SELECT COUNT(*)::int FROM videos v WHERE v.channel_id=c.id) AS local_video_count
    FROM channels c JOIN user_channels uc ON uc.channel_id=c.id LEFT JOIN categories cat ON cat.id=uc.category_id
    WHERE uc.user_id=$1 ORDER BY uc.added_at DESC`, [userId]);
  res.json({ channels: result.rows });
}));
app.post('/api/channels/resolve', asyncRoute(async (req, res) => {
  const parsed = z.object({ input: z.string().min(2).max(300) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'أدخل اسم قناة أو رابطًا صحيحًا.' });
  try { const channels = await resolveChannelInput(parsed.data.input); res.json({ channels }); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'تعذر الاتصال بيوتيوب.' }); }
}));
app.post('/api/channels', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = z.object({ youtubeChannelId: z.string().min(5), categoryId: z.number().int().positive().nullable().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'اختر قناة صحيحة من نتائج البحث.' });
  try {
    const channels = await resolveChannelInput(parsed.data.youtubeChannelId);
    const channel = channels.find(c => c.youtubeChannelId === parsed.data.youtubeChannelId) || channels[0];
    if (!channel) return res.status(404).json({ error: 'لم يتم العثور على القناة.' });
    const saved = await saveChannelForUser(userId, channel, parsed.data.categoryId);
    res.status(201).json({ channel: saved, message: 'تمت إضافة القناة بنجاح.' });
  } catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'فشل إضافة القناة.' }); }
}));
app.delete('/api/channels/:id', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  await db('DELETE FROM user_channels WHERE user_id=$1 AND channel_id=$2', [userId, Number(req.params.id)]);
  res.json({ ok: true });
}));
app.patch('/api/channels/:id', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = z.object({ categoryId: z.number().int().positive().nullable().optional(), isFollowing: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات التعديل غير صحيحة.' });
  const hasCategory = Object.prototype.hasOwnProperty.call(req.body || {}, 'categoryId');
  const hasFollowing = Object.prototype.hasOwnProperty.call(req.body || {}, 'isFollowing');
  const result = await db<any>(`UPDATE user_channels SET category_id=CASE WHEN $3 THEN $4 ELSE category_id END,is_following=CASE WHEN $5 THEN $6 ELSE is_following END
    WHERE user_id=$1 AND channel_id=$2 RETURNING *`, [userId, Number(req.params.id), hasCategory, parsed.data.categoryId ?? null, hasFollowing, parsed.data.isFollowing ?? null]);
  if (!result.rowCount) return res.status(404).json({ error: 'القناة غير موجودة في مكتبتك.' });
  res.json({ channel: result.rows[0] });
}));
app.post('/api/channels/:id/sync', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const found = await db('SELECT 1 FROM user_channels WHERE user_id=$1 AND channel_id=$2', [userId, Number(req.params.id)]);
  if (!found.rowCount) return res.status(404).json({ error: 'القناة غير موجودة.' });
  try { const result = await syncOneChannel(Number(req.params.id)); res.json({ ok: true, ...result }); }
  catch (error) { res.status(502).json({ error: error instanceof Error ? error.message : 'فشل تحديث القناة.' }); }
}));

app.get('/api/videos', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const q = String(req.query.q || '').trim();
  const rawCategoryId = Number(req.query.categoryId || 0);
  const rawChannelId = Number(req.query.channelId || 0);
  const categoryId = Number.isFinite(rawCategoryId) && rawCategoryId > 0 ? Math.floor(rawCategoryId) : 0;
  const channelId = Number.isFinite(rawChannelId) && rawChannelId > 0 ? Math.floor(rawChannelId) : 0;
  const collection = String(req.query.collection || 'feed');
  const rawLimit = Number(req.query.limit || 24);
  const rawOffset = Number(req.query.offset || 0);
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 24, 1), 60);
  const offset = Math.max(Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0, 0);
  const params: any[] = [userId];
  let where = 'uc.user_id=$1 AND uc.is_following=TRUE';
  if (q) { params.push(`%${q}%`); where += ` AND (v.title ILIKE $${params.length} OR v.description ILIKE $${params.length} OR c.title ILIKE $${params.length})`; }
  if (categoryId) { params.push(categoryId); where += ` AND COALESCE(uc.category_id,v.category_id)=$${params.length}`; }
  if (channelId) { params.push(channelId); where += ` AND c.id=$${params.length}`; }
  if (collection === 'favorites') where += ' AND EXISTS(SELECT 1 FROM favorites f WHERE f.user_id=$1 AND f.video_id=v.id)';
  if (collection === 'watch-later') where += ' AND EXISTS(SELECT 1 FROM watch_later w WHERE w.user_id=$1 AND w.video_id=v.id)';
  if (collection === 'history') where += ' AND EXISTS(SELECT 1 FROM watch_progress p WHERE p.user_id=$1 AND p.video_id=v.id)';
  if (collection === 'in-progress') where += ' AND EXISTS(SELECT 1 FROM watch_progress p WHERE p.user_id=$1 AND p.video_id=v.id AND p.is_completed=FALSE AND p.percent>0)';
  const sql = `SELECT v.*, c.title AS channel_title,c.thumbnail AS channel_thumbnail,
      COALESCE(uc.category_id,v.category_id) AS effective_category_id, cat.name AS category_name,
      COALESCE(p.percent,0) AS progress_percent, COALESCE(p.position_seconds,0) AS position_seconds,
      EXISTS(SELECT 1 FROM favorites f WHERE f.user_id=$1 AND f.video_id=v.id) AS is_favorite,
      EXISTS(SELECT 1 FROM watch_later w WHERE w.user_id=$1 AND w.video_id=v.id) AS is_watch_later
    FROM videos v JOIN channels c ON c.id=v.channel_id JOIN user_channels uc ON uc.channel_id=c.id
    LEFT JOIN categories cat ON cat.id=COALESCE(uc.category_id,v.category_id)
    LEFT JOIN watch_progress p ON p.video_id=v.id AND p.user_id=$1
    WHERE ${where} ORDER BY v.published_at DESC NULLS LAST LIMIT ${limit} OFFSET ${offset}`;
  const result = await db(sql, params);
  res.json({ videos: result.rows, limit, offset });
}));
app.get('/api/videos/:id', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const result = await db<any>(`SELECT v.*,c.title AS channel_title,c.thumbnail AS channel_thumbnail,cat.name AS category_name,
      COALESCE(p.position_seconds,0) AS position_seconds,COALESCE(p.percent,0) AS progress_percent,
      EXISTS(SELECT 1 FROM favorites f WHERE f.user_id=$1 AND f.video_id=v.id) AS is_favorite,
      EXISTS(SELECT 1 FROM watch_later w WHERE w.user_id=$1 AND w.video_id=v.id) AS is_watch_later
    FROM videos v JOIN channels c ON c.id=v.channel_id JOIN user_channels uc ON uc.channel_id=c.id
    LEFT JOIN categories cat ON cat.id=COALESCE(uc.category_id,v.category_id) LEFT JOIN watch_progress p ON p.user_id=$1 AND p.video_id=v.id
    WHERE v.id=$2 AND uc.user_id=$1 LIMIT 1`, [userId, Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: 'الفيديو غير موجود في مكتبتك.' });
  res.json({ video: result.rows[0] });
}));

async function toggleCollection(req: Request, res: Response, table: 'favorites' | 'watch_later') {
  const userId = requireUser(req, res); if (!userId) return;
  const videoId = Number(req.params.videoId);
  const owned = await db('SELECT 1 FROM videos v JOIN user_channels uc ON uc.channel_id=v.channel_id WHERE v.id=$1 AND uc.user_id=$2', [videoId, userId]);
  if (!owned.rowCount) return res.status(404).json({ error: 'الفيديو غير موجود في مكتبتك.' });
  const exists = await db(`SELECT 1 FROM ${table} WHERE user_id=$1 AND video_id=$2`, [userId, videoId]);
  if (exists.rowCount) { await db(`DELETE FROM ${table} WHERE user_id=$1 AND video_id=$2`, [userId, videoId]); return res.json({ active: false }); }
  await db(`INSERT INTO ${table}(user_id,video_id) VALUES($1,$2) ON CONFLICT DO NOTHING`, [userId, videoId]);
  return res.json({ active: true });
}
app.post('/api/videos/:videoId/favorite', asyncRoute(async (req, res) => toggleCollection(req, res, 'favorites')));
app.post('/api/videos/:videoId/watch-later', asyncRoute(async (req, res) => toggleCollection(req, res, 'watch_later')));
app.post('/api/videos/:videoId/progress', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = z.object({ positionSeconds: z.number().int().min(0), percent: z.number().min(0).max(100), durationSeconds: z.number().int().min(0).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات التقدم غير صحيحة.' });
  const owned = await db('SELECT 1 FROM videos v JOIN user_channels uc ON uc.channel_id=v.channel_id WHERE v.id=$1 AND uc.user_id=$2', [Number(req.params.videoId), userId]);
  if (!owned.rowCount) return res.status(404).json({ error: 'الفيديو غير موجود.' });
  const isCompleted = parsed.data.percent >= 95;
  await db(`INSERT INTO watch_progress(user_id,video_id,position_seconds,percent,is_completed,updated_at) VALUES($1,$2,$3,$4,$5,NOW())
    ON CONFLICT(user_id,video_id) DO UPDATE SET position_seconds=EXCLUDED.position_seconds,percent=GREATEST(watch_progress.percent,EXCLUDED.percent),is_completed=EXCLUDED.is_completed,updated_at=NOW()`, [userId, Number(req.params.videoId), parsed.data.positionSeconds, parsed.data.percent, isCompleted]);
  res.json({ ok: true, isCompleted });
}));

app.get('/api/folders', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const result = await db<any>(`SELECT f.*,COUNT(fi.video_id)::int AS video_count FROM folders f LEFT JOIN folder_items fi ON fi.folder_id=f.id WHERE f.user_id=$1 GROUP BY f.id ORDER BY f.is_pinned DESC,f.created_at DESC`, [userId]);
  res.json({ folders: result.rows });
}));
app.post('/api/folders', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = z.object({ title: z.string().trim().min(1).max(70), description: z.string().max(240).optional().default(''), icon: z.string().max(30).optional().default('folder') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'اسم المجلد مطلوب.' });
  try { const result = await db<any>('INSERT INTO folders(user_id,title,description,icon) VALUES($1,$2,$3,$4) RETURNING *', [userId, parsed.data.title, parsed.data.description, parsed.data.icon]); res.status(201).json({ folder: result.rows[0] }); }
  catch (e: any) { if (e.code === '23505') return res.status(409).json({ error: 'يوجد مجلد بهذا الاسم بالفعل.' }); throw e; }
}));
app.patch('/api/folders/:id', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const parsed = z.object({ title: z.string().trim().min(1).max(70).optional(), description: z.string().max(240).optional(), isPinned: z.boolean().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'بيانات التعديل غير صحيحة.' });
  const result = await db<any>(`UPDATE folders SET title=COALESCE($3,title),description=COALESCE($4,description),is_pinned=COALESCE($5,is_pinned) WHERE id=$1 AND user_id=$2 RETURNING *`, [Number(req.params.id), userId, parsed.data.title ?? null, parsed.data.description ?? null, parsed.data.isPinned ?? null]);
  if (!result.rowCount) return res.status(404).json({ error: 'المجلد غير موجود.' });
  res.json({ folder: result.rows[0] });
}));
app.delete('/api/folders/:id', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  await db('DELETE FROM folders WHERE id=$1 AND user_id=$2', [Number(req.params.id), userId]); res.json({ ok: true });
}));
app.get('/api/folders/:id/videos', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const owns = await db('SELECT 1 FROM folders WHERE id=$1 AND user_id=$2', [Number(req.params.id), userId]);
  if (!owns.rowCount) return res.status(404).json({ error: 'المجلد غير موجود.' });
  const result = await db<any>(`SELECT v.*,c.title AS channel_title,c.thumbnail AS channel_thumbnail FROM folder_items fi JOIN videos v ON v.id=fi.video_id JOIN channels c ON c.id=v.channel_id WHERE fi.folder_id=$1 ORDER BY fi.created_at DESC`, [Number(req.params.id)]);
  res.json({ videos: result.rows });
}));
app.post('/api/folders/:id/videos', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const folder = await db('SELECT 1 FROM folders WHERE id=$1 AND user_id=$2', [Number(req.params.id), userId]);
  if (!folder.rowCount) return res.status(404).json({ error: 'المجلد غير موجود.' });
  const videoId = Number(req.body.videoId);
  const owned = await db('SELECT 1 FROM videos v JOIN user_channels uc ON uc.channel_id=v.channel_id WHERE v.id=$1 AND uc.user_id=$2', [videoId,userId]);
  if (!owned.rowCount) return res.status(404).json({ error: 'الفيديو غير موجود في مكتبتك.' });
  await db('INSERT INTO folder_items(folder_id,video_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [Number(req.params.id),videoId]);
  res.json({ ok: true });
}));
app.delete('/api/folders/:id/videos/:videoId', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  await db('DELETE FROM folder_items fi USING folders f WHERE fi.folder_id=f.id AND f.user_id=$1 AND fi.folder_id=$2 AND fi.video_id=$3', [userId,Number(req.params.id),Number(req.params.videoId)]);
  res.json({ ok: true });
}));

app.get('/api/me/export', asyncRoute(async (req,res)=>{
  const userId=requireUser(req,res); if(!userId)return;
  const [user,channels,folders,favorites,watchLater,progress,settings,summaries]=await Promise.all([
    db<any>('SELECT id,display_name,created_at FROM users WHERE id=$1',[userId]),
    db<any>('SELECT c.youtube_channel_id,c.title,uc.category_id,uc.is_following,uc.added_at FROM user_channels uc JOIN channels c ON c.id=uc.channel_id WHERE uc.user_id=$1',[userId]),
    db<any>('SELECT f.id,f.title,f.description,f.icon,f.is_pinned,ARRAY(SELECT v.youtube_video_id FROM folder_items fi JOIN videos v ON v.id=fi.video_id WHERE fi.folder_id=f.id) AS video_ids FROM folders f WHERE f.user_id=$1',[userId]),
    db<any>('SELECT v.youtube_video_id FROM favorites f JOIN videos v ON v.id=f.video_id WHERE f.user_id=$1',[userId]),
    db<any>('SELECT v.youtube_video_id FROM watch_later w JOIN videos v ON v.id=w.video_id WHERE w.user_id=$1',[userId]),
    db<any>('SELECT v.youtube_video_id,p.position_seconds,p.percent,p.is_completed,p.updated_at FROM watch_progress p JOIN videos v ON v.id=p.video_id WHERE p.user_id=$1',[userId]),
    db<any>('SELECT settings FROM user_settings WHERE user_id=$1',[userId]),
    db<any>('SELECT title,content,basis,model,created_at FROM summaries WHERE user_id=$1 ORDER BY created_at DESC',[userId])
  ]);
  res.json({exportedAt:new Date().toISOString(),user:user.rows[0]||null,channels:channels.rows,folders:folders.rows,favorites:favorites.rows,watchLater:watchLater.rows,watchProgress:progress.rows,settings:settings.rows[0]?.settings||{},summaries:summaries.rows});
}));
app.delete('/api/me/data', asyncRoute(async(req,res)=>{
  const userId=requireUser(req,res); if(!userId)return;
  await db('DELETE FROM users WHERE id=$1',[userId]);
  res.json({ok:true});
}));

app.get('/api/settings', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const result = await db<any>('SELECT settings FROM user_settings WHERE user_id=$1',[userId]);
  res.json({ settings: result.rows[0]?.settings || {} });
}));
app.put('/api/settings', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  if (typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 30000) return res.status(400).json({ error: 'الإعدادات غير صالحة.' });
  const result = await db<any>(`INSERT INTO user_settings(user_id,settings) VALUES($1,$2::jsonb) ON CONFLICT(user_id) DO UPDATE SET settings=EXCLUDED.settings,updated_at=NOW() RETURNING settings`, [userId,JSON.stringify(req.body)]);
  res.json({ settings: result.rows[0].settings });
}));
app.get('/api/notifications', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  const result = await db<any>('SELECT n.*,v.youtube_video_id FROM notifications n LEFT JOIN videos v ON v.id=n.video_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 50',[userId]);
  const unread = await db<any>('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND is_read=FALSE',[userId]);
  res.json({ notifications: result.rows, unread: unread.rows[0].count });
}));
app.patch('/api/notifications/:id/read', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  await db('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2',[Number(req.params.id),userId]); res.json({ok:true});
}));
app.post('/api/notifications/read-all', asyncRoute(async (req, res) => {
  const userId = requireUser(req, res); if (!userId) return;
  await db('UPDATE notifications SET is_read=TRUE WHERE user_id=$1',[userId]); res.json({ok:true});
}));

async function discoverGeminiModels() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('لم يتم ضبط GEMINI_API_KEY في Secrets.');
  const allModels: any[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
    url.searchParams.set('key', key); url.searchParams.set('pageSize','100');
    if (pageToken) url.searchParams.set('pageToken',pageToken);
    const response = await fetch(url);
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini models error ${response.status}`);
    allModels.push(...(payload.models || []));
    pageToken = payload.nextPageToken || '';
    if (!pageToken) break;
  }
  const models = allModels.filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent') && /flash/i.test(m.name) && !/preview|experimental|exp-/i.test(m.name));
  models.sort((a: any, b: any) => {
    const version = (name: string) => { const m = name.match(/gemini-(\d+(?:\.\d+)?)/i); return m ? Number(m[1]) : 0; };
    return version(b.name) - version(a.name);
  });
  return models;
}
async function generateGemini(prompt: string, preferred?: string) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini غير مفعّل: أضف GEMINI_API_KEY إلى Secrets.');
  const models = await discoverGeminiModels();
  const override = preferred || process.env.GEMINI_MODEL_OVERRIDE;
  const available = models.map((m: any) => m.name.replace(/^models\//, ''));
  const primary = override && available.includes(override.replace(/^models\//,'')) ? override.replace(/^models\//,'') : available[0];
  const fallback = (process.env.GEMINI_FALLBACK_MODEL || '').replace(/^models\//,'');
  const autoFallback = available.find((name: string) => name !== primary);
  const candidates = [primary, autoFallback, fallback].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
  if (!candidates.length) throw new Error('لم يتم العثور على موديل Gemini Flash مستقر يدعم generateContent.');
  let lastError = '';
  for (const model of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.35, maxOutputTokens: 1800 } }) });
    const payload: any = await response.json().catch(() => ({}));
    if (response.ok) {
      await recordUsage('gemini','generateContent',1,true,'',model);
      return { text: payload.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('\n') || 'لم تصل إجابة نصية.', model };
    }
    lastError = payload?.error?.message || `Gemini ${response.status}`;
    await recordUsage('gemini','generateContent',1,false,lastError,model);
  }
  throw new Error(lastError || 'تعذر توليد الإجابة من Gemini.');
}
app.get('/api/ai/status', asyncRoute(async (_req,res) => {
  res.json({ configured: !!process.env.GEMINI_API_KEY, modelOverride: process.env.GEMINI_MODEL_OVERRIDE || null });
}));
app.get('/api/ai/models', requireAdmin, asyncRoute(async (_req,res) => {
  try { const models = await discoverGeminiModels(); res.json({ models: models.map((m: any) => ({ name: m.name, displayName: m.displayName, supportedGenerationMethods: m.supportedGenerationMethods })) }); }
  catch (e) { res.status(502).json({error:e instanceof Error?e.message:'فشل فحص الموديلات.'}); }
}));
app.post('/api/ai/chat', asyncRoute(async (req,res) => {
  const userId = requireUser(req,res); if (!userId) return;
  const parsed = z.object({ message: z.string().trim().min(1).max(5000), videoId: z.number().int().positive().optional(), transcript: z.string().max(30000).optional(), conversationId: z.number().int().positive().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:'اكتب سؤالًا صحيحًا.'});
  let context = 'لا يوجد سياق فيديو محدد.';
  if (parsed.data.videoId) {
    const video = await db<any>(`SELECT v.title,v.description,v.duration_seconds,v.view_count,c.title AS channel_title FROM videos v JOIN channels c ON c.id=v.channel_id JOIN user_channels uc ON uc.channel_id=c.id WHERE v.id=$1 AND uc.user_id=$2 LIMIT 1`,[parsed.data.videoId,userId]);
    if (!video.rowCount) return res.status(404).json({error:'الفيديو غير موجود في مكتبتك.'});
    const v=video.rows[0];
    context = `بيانات الفيديو المتاحة فقط: العنوان: ${v.title}\nالقناة: ${v.channel_title}\nالوصف: ${v.description}\nالمدة بالثواني: ${v.duration_seconds}\nالمشاهدات: ${v.view_count}`;
    if (parsed.data.transcript) context += `\nنص التفريغ الذي قدمه المستخدم:\n${parsed.data.transcript}`;
    else context += '\nتنبيه: لا يوجد Transcript. لا تدّعِ أنك شاهدت الفيديو ولا تستنتج تفاصيل غير موجودة في العنوان والوصف. اذكر بوضوح أن الإجابة مبنية على البيانات المتاحة فقط.';
  }
  const prompt = `أنت جيمناوي، مساعد تعليمي عربي واضح. أجب باللهجة المصرية المهذبة أو العربية المبسطة بحسب السؤال. لا تخترع حقائق.\nالسياق:\n${context}\n\nسؤال المستخدم:\n${parsed.data.message}`;
  try {
    const answer = await generateGemini(prompt);
    const exchange = [{ role: 'user', text: parsed.data.message, createdAt: new Date().toISOString() }, { role: 'assistant', text: answer.text, model: answer.model, createdAt: new Date().toISOString() }];
    let conversationId = parsed.data.conversationId;
    if (conversationId) {
      const existing = await db<any>('SELECT messages FROM ai_conversations WHERE id=$1 AND user_id=$2',[conversationId,userId]);
      if (!existing.rowCount) conversationId = undefined;
      else {
        const history = Array.isArray(existing.rows[0].messages) ? existing.rows[0].messages : [];
        const updated = await db<any>('UPDATE ai_conversations SET messages=$3::jsonb,updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING id',[conversationId,userId,JSON.stringify([...history,...exchange])]);
        conversationId = updated.rows[0]?.id;
      }
    }
    if (!conversationId) {
      const created = await db<any>('INSERT INTO ai_conversations(user_id,title,messages) VALUES($1,$2,$3::jsonb) RETURNING id',[userId,parsed.data.message.slice(0,80),JSON.stringify(exchange)]);
      conversationId = created.rows[0].id;
    }
    res.json({ answer: answer.text, model: answer.model, basis: parsed.data.transcript ? 'transcript' : parsed.data.videoId ? 'metadata' : 'general', conversationId });
  } catch(e) { res.status(502).json({error:e instanceof Error?e.message:'تعذر الوصول إلى Gemini.'}); }
}));
app.post('/api/ai/summarize/:videoId', asyncRoute(async (req,res) => {
  const userId = requireUser(req,res); if (!userId) return;
  const parsed = z.object({ transcript: z.string().max(30000).optional() }).safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({error:'نص التفريغ طويل أو غير صالح.'});
  const video = await db<any>(`SELECT v.*,c.title AS channel_title FROM videos v JOIN channels c ON c.id=v.channel_id JOIN user_channels uc ON uc.channel_id=c.id WHERE v.id=$1 AND uc.user_id=$2 LIMIT 1`,[Number(req.params.videoId),userId]);
  if (!video.rowCount) return res.status(404).json({error:'الفيديو غير موجود في مكتبتك.'});
  const v=video.rows[0];
  const basis = parsed.data.transcript ? 'transcript' : 'metadata';
  const prompt = `اكتب ملخصًا تعليميًا منظمًا بالعربية لهذا المحتوى. افصل الأفكار المؤكدة عن أي نقص في المعلومات. لا تستنتج ما لم يرد في المصدر.\nالعنوان: ${v.title}\nالقناة: ${v.channel_title}\nالوصف: ${v.description}\n${parsed.data.transcript ? `Transcript:\n${parsed.data.transcript}` : 'لا يوجد Transcript؛ الملخص يجب أن يكون محدودًا بالعنوان والوصف فقط، مع تنبيه صريح بذلك.'}`;
  try {
    const answer=await generateGemini(prompt);
    const saved=await db<any>('INSERT INTO summaries(user_id,video_id,title,content,basis,model) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at',[userId,v.id,v.title,answer.text,basis,answer.model]);
    res.json({summary:{...saved.rows[0],title:v.title,content:answer.text,basis,model:answer.model}});
  } catch(e) { res.status(502).json({error:e instanceof Error?e.message:'تعذر تلخيص الفيديو.'}); }
}));
app.get('/api/ai/conversations', asyncRoute(async(req,res)=>{
  const userId=requireUser(req,res); if(!userId)return;
  const result=await db('SELECT id,title,messages,created_at,updated_at FROM ai_conversations WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 20',[userId]);
  res.json({conversations:result.rows});
}));
app.get('/api/summaries', asyncRoute(async(req,res)=>{
  const userId=requireUser(req,res); if(!userId)return;
  const result=await db('SELECT s.*,v.youtube_video_id FROM summaries s LEFT JOIN videos v ON v.id=s.video_id WHERE s.user_id=$1 ORDER BY s.created_at DESC LIMIT 100',[userId]);
  res.json({summaries:result.rows});
}));

app.post('/api/admin/login', asyncRoute(async(req,res)=>{
  const password = String(req.body?.password || '');
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({error:'ADMIN_PASSWORD غير مضبوط في Secrets.'});
  if (password.length < 1 || password !== process.env.ADMIN_PASSWORD) return res.status(401).json({error:'كلمة مرور الإدارة غير صحيحة.'});
  const token=jwt.sign({role:'owner'},SESSION_SECRET,{expiresIn:'8h'});
  res.cookie('kholasat_admin',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000,path:'/'});
  await db("INSERT INTO admin_audit_logs(action,details) VALUES('admin_login','{}'::jsonb)");
  res.json({ok:true});
}));
app.post('/api/admin/logout',(_req,res)=>{res.clearCookie('kholasat_admin',{path:'/'});res.json({ok:true});});
app.get('/api/admin/session',requireAdmin,(_req,res)=>res.json({ok:true}));
app.get('/api/admin/stats',requireAdmin,asyncRoute(async(_req,res)=>{
  const [users,channels,videos,categories,folders,summaries,logs,usage]=await Promise.all([
    db<any>('SELECT COUNT(*)::int AS count FROM users'),db<any>('SELECT COUNT(*)::int AS count FROM channels'),db<any>('SELECT COUNT(*)::int AS count FROM videos'),db<any>('SELECT COUNT(*)::int AS count FROM categories'),db<any>('SELECT COUNT(*)::int AS count FROM folders'),db<any>('SELECT COUNT(*)::int AS count FROM summaries'),db<any>('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 15'),
    db<any>(`SELECT provider,SUM(units)::int AS units,COUNT(*)::int AS requests,COUNT(*) FILTER(WHERE NOT success)::int AS failures FROM api_usage_logs WHERE created_at >= date_trunc('day',NOW()) GROUP BY provider`)
  ]);
  res.json({stats:{users:users.rows[0].count,channels:channels.rows[0].count,videos:videos.rows[0].count,categories:categories.rows[0].count,folders:folders.rows[0].count,summaries:summaries.rows[0].count},logs:logs.rows,usage:usage.rows,youtubeDailyQuota:Number(process.env.YOUTUBE_DAILY_QUOTA||10000)});
}));
app.get('/api/admin/service-check',requireAdmin,asyncRoute(async(_req,res)=>{
  let database='ok'; try{await db('SELECT 1')}catch{database='error'}
  res.json({database,youtubeConfigured:!!process.env.YOUTUBE_API_KEY,geminiConfigured:!!process.env.GEMINI_API_KEY,adminConfigured:!!process.env.ADMIN_PASSWORD,environment:process.env.NODE_ENV||'development'});
}));

async function syncAllChannels() {
  if (!process.env.YOUTUBE_API_KEY) { console.log('Channel scheduler skipped: YOUTUBE_API_KEY is not configured.'); return; }
  const result=await db<any>('SELECT DISTINCT c.id FROM channels c JOIN user_channels uc ON uc.channel_id=c.id AND uc.is_following=TRUE WHERE c.last_synced_at IS NULL OR c.last_synced_at < NOW() - INTERVAL \'2 hours 50 minutes\' ORDER BY c.id LIMIT 100');
  for (const row of result.rows) {
    try { const outcome=await syncOneChannel(row.id); console.log(`Synced channel ${row.id}:`,outcome); }
    catch(error){console.error(`Channel sync failed for ${row.id}:`,error);}
  }
}

app.use('/api', (_req,res)=>res.status(404).json({error:'المسار المطلوب غير موجود.'}));
app.use((err: any,_req:Request,res:Response,_next:NextFunction)=>{
  console.error('API error:',err?.stack||err);
  const message=process.env.NODE_ENV==='production'?'حدث خطأ داخلي. حاول مرة أخرى.':String(err?.message||'Unknown error');
  res.status(500).json({error:message});
});

async function start() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required. Add a PostgreSQL database and set DATABASE_URL in Replit Secrets.');
  const schemaPath=path.resolve(process.cwd(),'server/schema.sql');
  const schema=await readFile(schemaPath,'utf8');
  await pool.query(schema);
  if (process.env.NODE_ENV==='production') {
    if (SESSION_SECRET.length < 32 || SESSION_SECRET === 'development-only-change-me-before-deploy') throw new Error('Set a strong SESSION_SECRET (32+ characters) before production.');
    const clientPath=path.resolve(process.cwd(),'dist/client');
    app.use(express.static(clientPath,{maxAge:'1d',index:false}));
    app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(clientPath,'index.html'));});
  }
  const server=app.listen(PORT,'0.0.0.0',()=>console.log(`Kholasat Al Mofeed running on http://0.0.0.0:${PORT}`));
  const schedule=process.env.CHANNEL_SYNC_CRON||'0 */3 * * *';
  if (cron.validate(schedule)) cron.schedule(schedule,()=>syncAllChannels().catch(console.error));
  // Initial background sync is intentionally not awaited; app readiness does not depend on external APIs.
  if (process.env.YOUTUBE_API_KEY) setTimeout(()=>syncAllChannels().catch(console.error),5000);
  const shutdown=async()=>{server.close();await pool.end();process.exit(0);};
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
start().catch(error=>{console.error('Startup failed:',error);process.exit(1);});
