import type React from 'react';
import { BookmarkPlus, Heart, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, formatDuration, formatViews, timeAgo } from '../api';

export type Video = {
  id: number; youtube_video_id: string; title: string; description?: string; thumbnail: string;
  published_at?: string; duration_seconds: number; view_count: number; channel_title: string;
  channel_thumbnail?: string; category_name?: string; progress_percent?: number; is_favorite?: boolean; is_watch_later?: boolean;
};

export default function VideoCard({ video, onChange }: { video: Video; onChange?: () => void }) {
  async function toggle(kind: 'favorite' | 'watch-later', e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    try { await api(`/videos/${video.id}/${kind}`, { method: 'POST' }); onChange?.(); }
    catch (error) { alert(error instanceof Error ? error.message : 'حدث خطأ'); }
  }
  return <article className="video-card">
    <Link to={`/video/${video.id}`} className="thumb-wrap">
      {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <div className="thumb-fallback"><Play size={28}/></div>}
      <span className="duration">{formatDuration(Number(video.duration_seconds || 0))}</span>
      {Number(video.progress_percent || 0) > 0 && <span className="progress-track"><i style={{ width: `${Math.min(100, Number(video.progress_percent))}%` }} /></span>}
      <span className="play-hover"><Play size={23} fill="currentColor"/></span>
    </Link>
    <div className="video-card-body">
      <div className="video-avatar">{video.channel_thumbnail ? <img src={video.channel_thumbnail} alt=""/> : (video.channel_title || 'ق')[0]}</div>
      <div className="video-info">
        <Link to={`/video/${video.id}`} className="video-title">{video.title}</Link>
        <div className="channel-name">{video.channel_title || 'قناة غير معروفة'}</div>
        <div className="video-meta"><span>{formatViews(video.view_count)} مشاهدة</span><span>•</span><span>{timeAgo(video.published_at)}</span></div>
        {video.category_name && <span className="mini-tag">{video.category_name}</span>}
      </div>
      <div className="video-actions">
        <button aria-label="المفضلة" className={`icon-button tiny ${video.is_favorite ? 'is-active' : ''}`} onClick={(e)=>toggle('favorite',e)}><Heart size={17}/></button>
        <button aria-label="مشاهدة لاحقًا" className={`icon-button tiny ${video.is_watch_later ? 'is-active' : ''}`} onClick={(e)=>toggle('watch-later',e)}><BookmarkPlus size={17}/></button>
      </div>
    </div>
  </article>;
}
