import { Clock3, Eye, Heart, BookmarkPlus, Play, FolderPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export function formatDuration(value = 0) {
  const n = Number(value || 0);
  if (!n) return '—';
  const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
  return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
export function formatViews(value = 0) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} مليون`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} ألف`;
  return n.toLocaleString('ar-EG');
}
export function VideoCard({ video, onUpdate, compact = false }) {
  const toggle = async (event, type) => {
    event.preventDefault(); event.stopPropagation();
    try { await api(`/videos/${video.id}/${type}`, { method:'POST' }); onUpdate?.(); }
    catch (error) { window.alert(error.message); }
  };
  return <article className={`video-card ${compact ? 'video-card-compact' : ''}`}>
    <Link className="thumb-wrap" to={`/video/${video.id}`}>
      <img src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`} loading={document.body.dataset.lazyImages==='false'?'eager':'lazy'} alt="" onError={e => { e.currentTarget.src = '/assets/logo.svg'; }} />
      <span className="duration"><Clock3 size={12}/>{formatDuration(video.duration_seconds)}</span>
      {Number(video.progress_percent) > 0 && <span className="progress-line"><i style={{ width:`${Math.min(100,video.progress_percent)}%` }}/></span>}
      <span className="play-overlay"><Play size={24} fill="currentColor"/></span>
    </Link>
    <div className="video-meta">
      <div className="video-title-row"><Link to={`/video/${video.id}`} className="video-title">{video.title}</Link></div>
      <div className="channel-line"><span className="channel-avatar">{(video.channel_title || 'ق').slice(0,1)}</span><span>{video.channel_title || 'قناة غير معروفة'}</span></div>
      <div className="video-stats"><span><Eye size={13}/>{formatViews(video.view_count)}</span><span>{video.published_at ? new Date(video.published_at).toLocaleDateString('ar-EG') : '—'}</span></div>
      <div className="card-actions">
        <button title="المفضلة" onClick={e=>toggle(e,'favorite')} className={video.is_favorite ? 'active' : ''}><Heart size={16}/></button>
        <button title="مشاهدة لاحقًا" onClick={e=>toggle(e,'watch-later')} className={video.is_watch_later ? 'active' : ''}><BookmarkPlus size={16}/></button>
        <Link title="افتح الفيديو" to={`/video/${video.id}`}><Play size={15}/></Link>
      </div>
    </div>
  </article>;
}

export function VideoGrid({ items = [], onUpdate, empty = 'لا توجد فيديوهات هنا حتى الآن.' }) {
  if (!items.length) return <div className="empty-state"><div className="empty-icon">◌</div><strong>{empty}</strong><p>أضف قناة تعليمية وابدأ في بناء مكتبتك.</p></div>;
  return <div className="video-grid">{items.map(v => <VideoCard key={v.id} video={v} onUpdate={onUpdate}/>)}</div>;
}
