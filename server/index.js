import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { db, ensureUser, defaultSettings, logUsage } from './db.js';
import { resolveChannel, syncChannel, searchVideos, testYouTubeConnection } from './youtube.js';
import { chooseModel, generateContent } from './gemini.js';
import { createAdminCookie, clearAdminCookie, isAdminRequest } from './auth.js';
import { getApiSecret, getApiSecretMeta, saveApiSecret, deleteStoredApiSecret } from './secrets.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/admin/') || req.path === '/health' || req.path === '/ready') return next();
  try {
    const id = String(req.headers['x-user-id'] || '');
    const name = String(req.headers['x-user-name'] || 'ضيف').slice(0, 60);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'معرّف المستخدم غير صالح. أعد تحميل الصفحة.' });
    req.userId = ensureUser(id, name);
    next();
  } catch (error) { res.status(400).json({ error: error.message }); }
});

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const userId = req => req.userId;
const userOwnsVideo = (uid, id) => Boolean(db.prepare('SELECT 1 FROM videos v JOIN user_channels uc ON uc.channel_id=v.channel_id WHERE v.id=? AND uc.user_id=?').get(id,uid));
const bool = value => value === true || value === 1 || value === '1';
const videoSelect = `SELECT v.*, c.title AS channel_title, c.thumbnail AS channel_thumbnail,
  COALESCE(uc.category,v.category) AS user_category,
  EXISTS(SELECT 1 FROM favorites f WHERE f.video_id=v.id AND f.user_id=?) AS is_favorite,
  EXISTS(SELECT 1 FROM watch_later w WHERE w.video_id=v.id AND w.user_id=?) AS is_watch_later,
  COALESCE(wp.seconds,0) AS progress_seconds, COALESCE(wp.percent,0) AS progress_percent
  FROM videos v JOIN channels c ON c.id=v.channel_id
  JOIN user_channels uc ON uc.channel_id=c.id AND uc.user_id=?
  LEFT JOIN watch_progress wp ON wp.video_id=v.id AND wp.user_id=?`;

app.get('/api/health', (req,res) => res.json({ ok: true, service: 'kholasat-al-mofeed', time: new Date().toISOString(), database: db.open ? 'connected' : 'disconnected' }));
app.get('/api/ready', (req,res) => db.open ? res.json({ ready:true }) : res.status(503).json({ ready:false }));
app.get('/api/bootstrap', (req,res) => {
  const user = db.prepare('SELECT id,name,created_at FROM users WHERE id=?').get(userId(req));
  const settingsRow = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(userId(req));
  const settings = { ...defaultSettings, ...(JSON.parse(settingsRow?.settings_json || '{}')) };
  const channels = db.prepare(`SELECT c.*,uc.category AS user_category,uc.followed FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE uc.user_id=? ORDER BY uc.added_at DESC`).all(userId(req));
  const videos = db.prepare(`${videoSelect} ORDER BY COALESCE(v.published_at,v.updated_at) DESC LIMIT 24`).all(userId(req),userId(req),userId(req),userId(req));
  const unread = db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL').get(userId(req)).count;
  const stats = { videoCount: db.prepare('SELECT COUNT(*) AS n FROM videos v JOIN user_channels uc ON uc.channel_id=v.channel_id WHERE uc.user_id=?').get(userId(req)).n, folderCount: db.prepare('SELECT COUNT(*) AS n FROM folders WHERE user_id=?').get(userId(req)).n, summaryCount: db.prepare('SELECT COUNT(*) AS n FROM summaries WHERE user_id=?').get(userId(req)).n };
  res.json({ user, settings, channels, videos, unread, stats, integrations: { youtube: Boolean(getApiSecret('youtube')), gemini: Boolean(getApiSecret('gemini')) } });
});

app.patch('/api/profile', (req,res) => {
  const name = String(req.body?.name || '').trim().slice(0,60);
  if (!name) return res.status(400).json({ error: 'اكتب اسمًا صالحًا.' });
  db.prepare('UPDATE users SET name=? WHERE id=?').run(name,userId(req));
  res.json({ ok:true, name });
});

app.get('/api/videos', (req,res) => {
  const params = [userId(req),userId(req),userId(req),userId(req)];
  let sql = videoSelect;
  const category = String(req.query.category || '').trim();
  const q = String(req.query.q || '').trim().slice(0,120);
  const channel = Number(req.query.channel || 0);
  const project = req.query.project === '1';
  if (category) { sql += ' WHERE COALESCE(uc.category,v.category)=?'; params.push(category); }
  else if (channel) { sql += ' WHERE c.id=?'; params.push(channel); }
  else if (project) { sql += ' WHERE v.is_project=1'; }
  if (q) { sql += (sql.includes(' WHERE ') ? ' AND' : ' WHERE') + ' (v.title LIKE ? OR v.description LIKE ? OR c.title LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
  const limit = Math.min(60, Math.max(1, Number(req.query.limit || 36)));
  const offset = Math.max(0, Number(req.query.offset || 0));
  sql += ' ORDER BY COALESCE(v.published_at,v.updated_at) DESC LIMIT ? OFFSET ?'; params.push(limit,offset);
  res.json({ items: db.prepare(sql).all(...params) });
});

app.get('/api/videos/:id', (req,res) => {
  const row = db.prepare(`${videoSelect} WHERE v.id=?`).get(userId(req),userId(req),userId(req),userId(req),req.params.id);
  if (!row) return res.status(404).json({ error: 'الفيديو غير موجود في قنواتك المضافة.' });
  db.prepare('INSERT INTO watch_history(user_id,video_id,watched_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,video_id) DO UPDATE SET watched_at=CURRENT_TIMESTAMP').run(userId(req),row.id);
  res.json({ video: row });
});

app.post('/api/channels/resolve', asyncRoute(async (req,res) => {
  const result = await resolveChannel(req.body?.input);
  res.json(result.choices ? { choices: result.choices } : { channel: result });
}));

app.post('/api/channels', asyncRoute(async (req,res) => {
  const input = req.body?.input || req.body?.channelId;
  const category = String(req.body?.category || 'التعليم العام').slice(0,80);
  const resolved = await resolveChannel(input);
  if (resolved.choices) return res.status(300).json({ choices: resolved.choices, message: 'اختر القناة الصحيحة من النتائج.' });
  const result = db.prepare(`INSERT INTO channels(youtube_id,title,handle,thumbnail,description,subscriber_count,video_count,view_count,uploads_playlist_id,category)
    VALUES(@youtube_id,@title,@handle,@thumbnail,@description,@subscriber_count,@video_count,@view_count,@uploads_playlist_id,@category)
    ON CONFLICT(youtube_id) DO UPDATE SET title=excluded.title,handle=excluded.handle,thumbnail=excluded.thumbnail,description=excluded.description,subscriber_count=excluded.subscriber_count,video_count=excluded.video_count,view_count=excluded.view_count,uploads_playlist_id=excluded.uploads_playlist_id`).run({ ...resolved, category });
  const channel = db.prepare('SELECT * FROM channels WHERE youtube_id=?').get(resolved.youtube_id);
  db.prepare('INSERT INTO user_channels(user_id,channel_id,category) VALUES(?,?,?) ON CONFLICT(user_id,channel_id) DO UPDATE SET category=excluded.category,followed=1').run(userId(req),channel.id,category);
  let synced = 0, syncWarning = '';
  try { synced = await syncChannel(channel); }
  catch (error) { syncWarning = `تمت إضافة القناة لكن تعذرت مزامنة الفيديوهات: ${error.message}`; }
  const final = db.prepare('SELECT c.*,uc.category AS user_category FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE c.id=? AND uc.user_id=?').get(channel.id,userId(req));
  res.status(201).json({ channel: final, synced, syncWarning });
}));

app.get('/api/channels', (req,res) => {
  const items = db.prepare(`SELECT c.*,uc.category AS user_category,uc.followed FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE uc.user_id=? ORDER BY uc.added_at DESC`).all(userId(req));
  res.json({ items });
});
app.patch('/api/channels/:id', (req,res) => {
  const category = String(req.body?.category || '').trim().slice(0,80);
  if (!category) return res.status(400).json({ error: 'حدد المجال.' });
  const result = db.prepare('UPDATE user_channels SET category=? WHERE user_id=? AND channel_id=?').run(category,userId(req),Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'القناة غير موجودة.' });
  res.json({ ok:true });
});
app.delete('/api/channels/:id', (req,res) => {
  const result = db.prepare('DELETE FROM user_channels WHERE user_id=? AND channel_id=?').run(userId(req),Number(req.params.id));
  if (!result.changes) return res.status(404).json({ error: 'القناة غير موجودة في مكتبتك.' });
  res.json({ ok:true });
});
app.post('/api/channels/:id/sync', asyncRoute(async (req,res) => {
  const channel = db.prepare('SELECT c.* FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE c.id=? AND uc.user_id=?').get(Number(req.params.id),userId(req));
  if (!channel) return res.status(404).json({ error: 'القناة غير موجودة.' });
  const count = await syncChannel(channel);
  res.json({ ok:true, synced:count });
}));

app.post('/api/videos/:id/favorite', (req,res) => {
  const id = req.params.id;
  if (!userOwnsVideo(userId(req),id)) return res.status(404).json({ error:'الفيديو غير موجود في قنواتك.' });
  const exists = db.prepare('SELECT 1 FROM favorites WHERE user_id=? AND video_id=?').get(userId(req),id);
  if (exists) db.prepare('DELETE FROM favorites WHERE user_id=? AND video_id=?').run(userId(req),id);
  else db.prepare('INSERT OR IGNORE INTO favorites(user_id,video_id) VALUES(?,?)').run(userId(req),id);
  res.json({ active: !exists });
});
app.post('/api/videos/:id/watch-later', (req,res) => {
  const id = req.params.id;
  if (!userOwnsVideo(userId(req),id)) return res.status(404).json({ error:'الفيديو غير موجود في قنواتك.' });
  const exists = db.prepare('SELECT 1 FROM watch_later WHERE user_id=? AND video_id=?').get(userId(req),id);
  if (exists) db.prepare('DELETE FROM watch_later WHERE user_id=? AND video_id=?').run(userId(req),id);
  else db.prepare('INSERT OR IGNORE INTO watch_later(user_id,video_id) VALUES(?,?)').run(userId(req),id);
  res.json({ active: !exists });
});
app.post('/api/watch-progress', (req,res) => {
  const id = String(req.body?.videoId || '');
  const seconds = Math.max(0,Math.floor(Number(req.body?.seconds || 0)));
  const percent = Math.max(0,Math.min(100,Number(req.body?.percent || 0)));
  if (!id || !userOwnsVideo(userId(req),id)) return res.status(404).json({ error: 'الفيديو غير موجود في قنواتك.' });
  db.prepare(`INSERT INTO watch_progress(user_id,video_id,seconds,percent,completed,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,video_id) DO UPDATE SET seconds=excluded.seconds,percent=excluded.percent,completed=excluded.completed,updated_at=CURRENT_TIMESTAMP`).run(userId(req),id,seconds,percent,percent >= 95 ? 1 : 0);
  db.prepare('INSERT INTO watch_history(user_id,video_id,watched_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,video_id) DO UPDATE SET watched_at=CURRENT_TIMESTAMP').run(userId(req),id);
  res.json({ ok:true });
});

app.get('/api/library/:type', (req,res) => {
  const type = req.params.type;
  const joins = {
    favorites: 'JOIN favorites x ON x.video_id=v.id AND x.user_id=?',
    'watch-later': 'JOIN watch_later x ON x.video_id=v.id AND x.user_id=?',
    history: 'JOIN watch_history x ON x.video_id=v.id AND x.user_id=?',
    continue: 'JOIN watch_progress x ON x.video_id=v.id AND x.user_id=? AND x.completed=0 AND x.percent>0'
  };
  if (!joins[type]) return res.status(400).json({ error:'نوع المكتبة غير صالح.' });
  const params = [userId(req),userId(req),userId(req),userId(req),userId(req)];
  const sql = `${videoSelect} ${joins[type]} ORDER BY ${type==='continue'?'x.updated_at':type==='history'?'x.watched_at':'x.created_at'} DESC LIMIT 100`;
  res.json({ items: db.prepare(sql).all(...params) });
});

app.get('/api/folders', (req,res) => {
  const items = db.prepare(`SELECT f.*,COUNT(fi.video_id) AS video_count FROM folders f LEFT JOIN folder_items fi ON fi.folder_id=f.id WHERE f.user_id=? GROUP BY f.id ORDER BY f.created_at DESC`).all(userId(req));
  res.json({ items });
});
app.post('/api/folders', (req,res) => {
  const name = String(req.body?.name || '').trim().slice(0,80);
  if (!name) return res.status(400).json({ error:'اكتب اسم المجلد.' });
  const info = db.prepare('INSERT INTO folders(user_id,name,description) VALUES(?,?,?)').run(userId(req),name,String(req.body?.description || '').slice(0,300));
  res.status(201).json({ folder: db.prepare('SELECT * FROM folders WHERE id=?').get(info.lastInsertRowid) });
});
app.patch('/api/folders/:id', (req,res) => {
  const name = String(req.body?.name || '').trim().slice(0,80);
  if (!name) return res.status(400).json({ error:'اسم المجلد مطلوب.' });
  const result = db.prepare('UPDATE folders SET name=?,description=? WHERE id=? AND user_id=?').run(name,String(req.body?.description || '').slice(0,300),Number(req.params.id),userId(req));
  if (!result.changes) return res.status(404).json({ error:'المجلد غير موجود.' });
  res.json({ ok:true });
});
app.delete('/api/folders/:id', (req,res) => {
  const result = db.prepare('DELETE FROM folders WHERE id=? AND user_id=?').run(Number(req.params.id),userId(req));
  if (!result.changes) return res.status(404).json({ error:'المجلد غير موجود.' });
  res.json({ ok:true });
});
app.get('/api/folders/:id/videos', (req,res) => {
  const owns = db.prepare('SELECT 1 FROM folders WHERE id=? AND user_id=?').get(Number(req.params.id),userId(req));
  if (!owns) return res.status(404).json({ error:'المجلد غير موجود.' });
  const items = db.prepare(`${videoSelect} JOIN folder_items fi ON fi.video_id=v.id AND fi.folder_id=? WHERE 1 ORDER BY fi.added_at DESC`).all(userId(req),userId(req),userId(req),userId(req),Number(req.params.id));
  res.json({ items });
});
app.post('/api/folders/:id/videos', (req,res) => {
  const folderId = Number(req.params.id), videoId = String(req.body?.videoId || '');
  const owns = db.prepare('SELECT 1 FROM folders WHERE id=? AND user_id=?').get(folderId,userId(req));
  if (!owns) return res.status(404).json({ error:'المجلد غير موجود.' });
  if (!userOwnsVideo(userId(req),videoId)) return res.status(404).json({ error:'الفيديو غير موجود في قنواتك.' });
  db.prepare('INSERT OR IGNORE INTO folder_items(folder_id,video_id) VALUES(?,?)').run(folderId,videoId);
  res.json({ ok:true });
});
app.delete('/api/folders/:id/videos/:videoId', (req,res) => {
  const owns = db.prepare('SELECT 1 FROM folders WHERE id=? AND user_id=?').get(Number(req.params.id),userId(req));
  if (!owns) return res.status(404).json({ error:'المجلد غير موجود.' });
  db.prepare('DELETE FROM folder_items WHERE folder_id=? AND video_id=?').run(Number(req.params.id),req.params.videoId);
  res.json({ ok:true });
});

app.get('/api/settings', (req,res) => {
  const row = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(userId(req));
  res.json({ settings:{ ...defaultSettings, ...JSON.parse(row?.settings_json || '{}') } });
});
app.put('/api/settings', (req,res) => {
  const row = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(userId(req));
  const previous = JSON.parse(row?.settings_json || '{}');
  const incoming = req.body?.settings || {};
  const merged = { ...defaultSettings, ...previous };
  for (const [key,value] of Object.entries(incoming)) if (value && typeof value === 'object' && !Array.isArray(value)) merged[key] = { ...(merged[key] || {}), ...value };
  db.prepare('UPDATE user_settings SET settings_json=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?').run(JSON.stringify(merged),userId(req));
  res.json({ ok:true, settings:merged });
});

app.get('/api/notifications', (req,res) => res.json({ items: db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(userId(req)) }));
app.post('/api/notifications/read-all', (req,res) => { db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL').run(userId(req)); res.json({ ok:true }); });
app.post('/api/notifications/:id/read', (req,res) => { db.prepare('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').run(Number(req.params.id),userId(req)); res.json({ ok:true }); });

app.get('/api/search', (req,res) => {
  const q = String(req.query.q || '').trim().slice(0,100);
  if (!q) return res.json({ videos:[], channels:[] });
  const like = `%${q}%`;
  const videos = db.prepare(`${videoSelect} WHERE (v.title LIKE ? OR v.description LIKE ? OR c.title LIKE ?) ORDER BY v.published_at DESC LIMIT 20`).all(userId(req),userId(req),userId(req),userId(req),like,like,like);
  const channels = db.prepare('SELECT c.*,uc.category AS user_category FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE uc.user_id=? AND (c.title LIKE ? OR c.handle LIKE ?) LIMIT 10').all(userId(req),like,like);
  res.json({ videos, channels });
});
app.get('/api/search/youtube', asyncRoute(async (req,res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error:'اكتب عبارة البحث.' });
  const items = await searchVideos(q,12);
  res.json({ items, note:'هذه نتائج بحث خارج مكتبتك ولم تتم إضافتها إلى الرئيسية.' });
}));

app.get('/api/ai/history', (req,res) => res.json({ items: db.prepare('SELECT role,content,created_at FROM ai_messages WHERE user_id=? ORDER BY id DESC LIMIT 60').all(userId(req)).reverse() }));
app.delete('/api/ai/history', (req,res) => { db.prepare('DELETE FROM ai_messages WHERE user_id=?').run(userId(req)); res.json({ ok:true }); });
app.post('/api/ai/chat', asyncRoute(async (req,res) => {
  const question = String(req.body?.message || '').trim().slice(0,4000);
  if (!question) return res.status(400).json({ error:'اكتب سؤالك أولًا.' });
  const context = req.body?.context || {};
  const safeContext = [
    context.video ? `بيانات الفيديو المتاحة:\n${JSON.stringify(context.video).slice(0,5000)}` : '',
    context.transcript ? `نص التفريغ الذي أدخله المستخدم:\n${String(context.transcript).slice(0,14000)}` : '',
    context.category ? `المجال الحالي: ${String(context.category).slice(0,100)}` : ''
  ].filter(Boolean).join('\n\n');
  const history = db.prepare('SELECT role,content FROM ai_messages WHERE user_id=? ORDER BY id DESC LIMIT 8').all(userId(req)).reverse();
  const prefRow = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(userId(req));
  const aiPrefs = JSON.parse(prefRow?.settings_json || '{}').ai || {};
  if (aiPrefs.enabled === false) return res.status(403).json({ error:'جيمناوي متوقف من إعداداتك. فعّله أولًا.' });
  const answerLanguage = aiPrefs.language === 'en' ? 'الإنجليزية' : 'العربية';
  const detail = aiPrefs.detail || 'متوسط';
  const prompt = `أنت جيمناوي، المساعد التعليمي لمنصة خلاصة المفيد. أجب باللغة ${answerLanguage} ما لم يطلب المستخدم غير ذلك. مستوى التفصيل المطلوب: ${detail}. كن دقيقًا وعمليًا. لا تدّع مشاهدة فيديو أو معرفة محتواه إذا لم يُرسل نص تفريغه. عند وجود بيانات وصفية فقط، صرّح أن إجابتك مبنية على البيانات المتاحة فقط. لا تخترع توقيتات أو اقتباسات.\n\n${safeContext}\n\nسجل المحادثة:\n${history.map(m=>`${m.role}: ${m.content}`).join('\n')}\n\nسؤال المستخدم: ${question}`;
  const result = await generateContent(prompt);
  db.prepare('INSERT INTO ai_messages(user_id,role,content) VALUES(?,?,?)').run(userId(req),'user',question);
  db.prepare('INSERT INTO ai_messages(user_id,role,content) VALUES(?,?,?)').run(userId(req),'assistant',result.text);
  res.json({ answer:result.text, model:result.model, usage:result.usage });
}));
app.post('/api/ai/summarize', asyncRoute(async (req,res) => {
  const prefRow = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(userId(req));
  const aiPrefs = JSON.parse(prefRow?.settings_json || '{}').ai || {};
  if (aiPrefs.enabled === false) return res.status(403).json({ error:'جيمناوي متوقف من إعداداتك. فعّله أولًا.' });
  const text = String(req.body?.transcript || req.body?.description || '').trim().slice(0,20000);
  const title = String(req.body?.title || 'ملخص جديد').slice(0,180);
  if (text.length < 50) return res.status(400).json({ error:'أدخل نص التفريغ أو وصفًا كافيًا (50 حرفًا على الأقل). لا يمكن تلخيص فيديو من رابطه فقط.' });
  const summaryLanguage = aiPrefs.language === 'en' ? 'الإنجليزية' : 'العربية';
  const result = await generateContent(`لخص المادة التالية باللغة ${summaryLanguage} دون إضافة معلومات غير موجودة فيها. نظّم الناتج إلى: الفكرة العامة، أهم النقاط، المصطلحات، خطوات عملية، وأسئلة مراجعة قصيرة. العنوان: ${title}\n\nالمادة:\n${text}`);
  const info = db.prepare('INSERT INTO summaries(user_id,title,content,source_note) VALUES(?,?,?,?)').run(userId(req),title,result.text,req.body?.transcript ? 'ملخص مبني على نص تفريغ أدخله المستخدم' : 'ملخص مبني على وصف متاح');
  res.status(201).json({ summary: db.prepare('SELECT * FROM summaries WHERE id=?').get(info.lastInsertRowid), model:result.model });
}));
app.get('/api/summaries', (req,res) => res.json({ items: db.prepare('SELECT * FROM summaries WHERE user_id=? ORDER BY created_at DESC').all(userId(req)) }));

app.post('/api/export', (req,res) => {
  const uid = userId(req);
  const exportData = {
    exportedAt: new Date().toISOString(), user: db.prepare('SELECT id,name,created_at FROM users WHERE id=?').get(uid),
    settings: JSON.parse(db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(uid)?.settings_json || '{}'),
    channels: db.prepare('SELECT c.*,uc.category AS user_category FROM channels c JOIN user_channels uc ON uc.channel_id=c.id WHERE uc.user_id=?').all(uid),
    favorites: db.prepare('SELECT video_id,created_at FROM favorites WHERE user_id=?').all(uid),
    watchLater: db.prepare('SELECT video_id,created_at FROM watch_later WHERE user_id=?').all(uid),
    history: db.prepare('SELECT video_id,watched_at FROM watch_history WHERE user_id=?').all(uid),
    folders: db.prepare('SELECT * FROM folders WHERE user_id=?').all(uid),
    summaries: db.prepare('SELECT * FROM summaries WHERE user_id=?').all(uid)
  };
  res.json(exportData);
});
app.delete('/api/account', (req,res) => {
  db.prepare('DELETE FROM users WHERE id=?').run(userId(req));
  res.json({ ok:true });
});

function requireAdmin(req,res,next) {
  if (!process.env.ADMIN_PASSWORD) return res.status(503).json({ error:'لوحة المالك غير مفعلة. أضف ADMIN_PASSWORD إلى إعدادات الخادم.' });
  if (!isAdminRequest(req)) return res.status(401).json({ error:'يلزم تسجيل دخول المالك.' });
  next();
}
app.post('/api/admin/login', (req,res) => {
  const expected = String(process.env.ADMIN_PASSWORD || '');
  if (!process.env.ADMIN_SESSION_SECRET && !process.env.SESSION_SECRET) return res.status(503).json({ error:'أضف SESSION_SECRET أو ADMIN_SESSION_SECRET قبل تفعيل لوحة المالك.' });
  const supplied = String(req.body?.password || '');
  const expectedBuffer = Buffer.from(expected); const suppliedBuffer = Buffer.from(supplied);
  if (!expected || expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer,suppliedBuffer)) return res.status(401).json({ error:'كلمة مرور المالك غير صحيحة أو لم يتم إعدادها.' });
  createAdminCookie(res);
  res.json({ ok:true });
});
app.post('/api/admin/logout', (req,res) => { clearAdminCookie(res); res.json({ ok:true }); });
app.get('/api/admin/integrations', requireAdmin, (req,res) => {
  res.json({ integrations: { youtube: getApiSecretMeta('youtube'), gemini: getApiSecretMeta('gemini') } });
});
app.put('/api/admin/integrations/:provider', requireAdmin, (req,res) => {
  const provider = String(req.params.provider || '');
  if (!['youtube','gemini'].includes(provider)) return res.status(404).json({ error:'نوع التكامل غير معروف.' });
  const meta = saveApiSecret(provider, req.body?.key);
  res.json({ ok:true, integration:meta, message:'تم حفظ المفتاح مشفّرًا على الخادم.' });
});
app.delete('/api/admin/integrations/:provider', requireAdmin, (req,res) => {
  const provider = String(req.params.provider || '');
  if (!['youtube','gemini'].includes(provider)) return res.status(404).json({ error:'نوع التكامل غير معروف.' });
  const meta = deleteStoredApiSecret(provider);
  res.json({ ok:true, integration:meta, message: meta.source === 'environment' ? 'تم حذف النسخة المحفوظة؛ ما زال مفتاح متغيرات البيئة مستخدمًا.' : 'تم حذف المفتاح المحفوظ.' });
});
app.post('/api/admin/integrations/youtube/test', requireAdmin, asyncRoute(async (req,res) => {
  const result = await testYouTubeConnection();
  res.json({ ok:true, message:'اتصال YouTube API ناجح.', details:result });
}));
app.post('/api/admin/integrations/gemini/test', requireAdmin, asyncRoute(async (req,res) => {
  const result = await generateContent('أجب بكلمة واحدة فقط: جاهز');
  res.json({ ok:true, message:'اتصال Gemini ناجح وتم اختبار generateContent.', model:result.model });
}));
app.get('/api/admin/status', requireAdmin, (req,res) => {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
  const usage = db.prepare('SELECT provider,operation,SUM(units) AS units,COUNT(*) AS requests,SUM(CASE WHEN status=\'failed\' THEN 1 ELSE 0 END) AS failed FROM api_usage WHERE created_at >= date(\'now\') GROUP BY provider,operation').all();
  const quotaBudget = Math.max(1,Number(process.env.YOUTUBE_DAILY_QUOTA_BUDGET || 10000));
  const quotaUsed = Number(db.prepare("SELECT COALESCE(SUM(units),0) AS n FROM api_usage WHERE provider='youtube' AND created_at >= date('now')").get().n || 0);
  res.json({ metrics:{ users:count('users'),channels:count('channels'),videos:count('videos'),folders:count('folders'),summaries:count('summaries'),notifications:count('notifications') }, quota:{budget:quotaBudget,used:quotaUsed,remaining:Math.max(0,quotaBudget-quotaUsed)}, usage, integrations:{youtube:Boolean(getApiSecret('youtube')),gemini:Boolean(getApiSecret('gemini'))}, modelConfigured:process.env.GEMINI_MODEL || 'اكتشاف تلقائي' });
});
app.get('/api/admin/model-check', requireAdmin, asyncRoute(async (req,res) => { const model = await chooseModel(true); res.json({ ok:true,model }); }));

async function scheduledSync() {
  if (!getApiSecret('youtube')) return;
  const channels = db.prepare('SELECT * FROM channels WHERE id IN (SELECT DISTINCT channel_id FROM user_channels)').all();
  for (const channel of channels) {
    try {
      const previousIds = new Set(db.prepare('SELECT id FROM videos WHERE channel_id=?').all(channel.id).map(x=>x.id));
      const synced = await syncChannel(channel);
      const latest = db.prepare('SELECT id,title FROM videos WHERE channel_id=? ORDER BY published_at DESC LIMIT 25').all(channel.id);
      const fresh = latest.filter(v=>!previousIds.has(v.id));
      if (fresh.length) {
        const users = db.prepare('SELECT user_id FROM user_channels WHERE channel_id=?').all(channel.id);
        const addNote = db.prepare('INSERT INTO notifications(user_id,title,body,video_id) VALUES(?,?,?,?)');
        for (const u of users) {
          const prefs = db.prepare('SELECT settings_json FROM user_settings WHERE user_id=?').get(u.user_id);
          const n = JSON.parse(prefs?.settings_json || '{}').notifications || {};
          if (n.enabled === false || n.newVideos === false) continue;
          for (const v of fresh) addNote.run(u.user_id,'فيديو جديد من قناة تتابعها',v.title,v.id);
        }
      }
      console.info(`[scheduler] ${channel.title}: ${synced} checked, ${fresh.length} new`);
    } catch (error) { console.error(`[scheduler] ${channel.title}:`,error.message); }
  }
}
cron.schedule('0 */3 * * *', scheduledSync);

app.use('/api', (req,res) => res.status(404).json({ error:'مسار API غير موجود.' }));

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname,'../dist');
  app.use(express.static(dist,{ maxAge:'1h', index:false }));
  app.get('*',(req,res) => res.sendFile(path.join(dist,'index.html')));
}

app.use((err,req,res,next) => {
  console.error('[api error]',err?.message || err);
  const status = Number(err?.status || 500);
  res.status(status).json({ error: status >= 500 ? 'حدث خطأ داخلي. راجع سجل الخادم.' : err.message });
});

app.listen(PORT,'0.0.0.0',() => {
  console.info(`Kholasat Al-Mofeed API listening on port ${PORT}`);
  console.info(`YouTube: ${getApiSecret('youtube') ? 'configured' : 'not configured'} | Gemini: ${getApiSecret('gemini') ? 'configured' : 'not configured'}`);
});
