import { db, logUsage, parseDuration } from './db.js';
import { getApiSecret } from './secrets.js';

const API = 'https://www.googleapis.com/youtube/v3';

async function yt(path, params, operation, units = 1) {
  const key = getApiSecret('youtube');
  if (!key) throw new Error('أضف YOUTUBE_API_KEY في متغيرات البيئة لتفعيل YouTube.');
  const budget = Math.max(1, Number(process.env.YOUTUBE_DAILY_QUOTA_BUDGET || 10000));
  const consumed = Number(db.prepare("SELECT COALESCE(SUM(units),0) AS n FROM api_usage WHERE provider='youtube' AND created_at >= date('now')").get().n || 0);
  if (consumed + units > budget) throw new Error(`تم بلوغ حد الحصة التقديري الداخلي (${consumed}/${budget} وحدة). راجع الحصة الفعلية في Google Cloud Console.`);
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key })) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  let usageRecorded = false;
  try {
    const response = await fetch(url);
    const body = await response.json().catch(() => ({}));
    logUsage('youtube', operation, units, response.ok ? 'success' : 'failed');
    usageRecorded = true;
    if (!response.ok) throw new Error(body?.error?.message || `فشل YouTube API (${response.status})`);
    return body;
  } catch (error) {
    if (!usageRecorded) logUsage('youtube', operation, units, 'failed');
    throw error;
  }
}

function extractChannelInput(input) {
  const value = String(input || '').trim();
  if (!value) throw new Error('اكتب رابط القناة أو @Handle أو Channel ID.');
  const idMatch = value.match(/(UC[a-zA-Z0-9_-]{22})/);
  if (idMatch) return { type: 'id', value: idMatch[1] };
  const handleMatch = value.match(/@([\w.-]+)/);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };
  if (/^[\w.-]{3,}$/u.test(value)) return { type: 'search', value };
  throw new Error('لم أتعرف على الرابط. استخدم رابط قناة أو @Handle أو Channel ID.');
}

export async function resolveChannel(input) {
  const parsed = extractChannelInput(input);
  let channelId = parsed.value;
  if (parsed.type !== 'id') {
    const search = await yt('search', { part: 'snippet', type: 'channel', q: parsed.value, maxResults: 5 }, 'search_channels', 100);
    const matches = search.items || [];
    if (!matches.length) throw new Error('لم يتم العثور على قناة مطابقة. جرّب رابط القناة أو @Handle.');
    if (parsed.type === 'search' && matches.length > 1) {
      return { choices: matches.map(x => ({ id: x.id.channelId, title: x.snippet.title, thumbnail: x.snippet.thumbnails?.default?.url })) };
    }
    channelId = matches[0].id.channelId;
  }
  const result = await yt('channels', { part: 'snippet,contentDetails,statistics', id: channelId }, 'channel_details', 1);
  const item = result.items?.[0];
  if (!item) throw new Error('القناة غير موجودة أو لا يمكن الوصول إليها.');
  return normalizeChannel(item);
}

function normalizeChannel(item) {
  const s = item.snippet || {};
  const stats = item.statistics || {};
  return {
    youtube_id: item.id, title: s.title || 'قناة بدون اسم', handle: s.customUrl || '',
    thumbnail: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
    description: s.description || '', subscriber_count: Number(stats.subscriberCount || 0),
    video_count: Number(stats.videoCount || 0), view_count: Number(stats.viewCount || 0),
    uploads_playlist_id: item.contentDetails?.relatedPlaylists?.uploads || ''
  };
}

export async function syncChannel(channelRow) {
  if (!channelRow.uploads_playlist_id) throw new Error('القناة لا تحتوي على قائمة فيديوهات مرفوعة متاحة.');
  const playlist = await yt('playlistItems', { part: 'contentDetails', playlistId: channelRow.uploads_playlist_id, maxResults: 25 }, 'latest_uploads', 1);
  const ids = (playlist.items || []).map(x => x.contentDetails?.videoId).filter(Boolean);
  if (!ids.length) return 0;
  const videosResponse = await yt('videos', { part: 'snippet,contentDetails,statistics', id: ids.join(',') }, 'video_details', 1);
  const insert = db.prepare(`INSERT INTO videos(id,channel_id,title,description,thumbnail,published_at,duration_seconds,view_count,category,is_project)
    VALUES(@id,@channel_id,@title,@description,@thumbnail,@published_at,@duration_seconds,@view_count,@category,@is_project)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,thumbnail=excluded.thumbnail,published_at=excluded.published_at,duration_seconds=excluded.duration_seconds,view_count=excluded.view_count,category=excluded.category,is_project=excluded.is_project,updated_at=CURRENT_TIMESTAMP`);
  const transaction = db.transaction(items => {
    for (const item of items) {
      const s = item.snippet || {};
      const thumbnail = s.thumbnails?.maxres?.url || s.thumbnails?.high?.url || s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '';
      const title = s.title || '';
      const text = `${title} ${s.description || ''}`;
      const isProject = /(مشروع|project|build|tutorial project|تطبيق عملي)/i.test(text);
      insert.run({ id: item.id, channel_id: channelRow.id, title, description: s.description || '', thumbnail,
        published_at: s.publishedAt || null, duration_seconds: parseDuration(item.contentDetails?.duration),
        view_count: Number(item.statistics?.viewCount || 0), category: channelRow.category || 'التعليم العام', is_project: isProject ? 1 : 0 });
    }
  });
  transaction(videosResponse.items || []);
  db.prepare('UPDATE channels SET last_synced_at=CURRENT_TIMESTAMP, video_count=COALESCE(video_count,0) WHERE id=?').run(channelRow.id);
  return (videosResponse.items || []).length;
}

export async function searchVideos(query, maxResults = 12) {
  const result = await yt('search', { part: 'snippet', type: 'video', q: query, maxResults: Math.min(25, Math.max(1, maxResults)), order: 'relevance' }, 'search_videos', 100);
  return (result.items || []).map(item => ({
    id: item.id.videoId, title: item.snippet.title, description: item.snippet.description,
    thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || '',
    published_at: item.snippet.publishedAt, channel_title: item.snippet.channelTitle,
    channel_id: item.snippet.channelId, external_result: true
  }));
}

export async function testYouTubeConnection() {
  const result = await yt('channels', { part: 'id', id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' }, 'admin_connection_test', 1);
  if (!Array.isArray(result.items)) throw new Error('استجابة YouTube غير متوقعة.');
  return { checked: true, quotaUnitsEstimated: 1 };
}
