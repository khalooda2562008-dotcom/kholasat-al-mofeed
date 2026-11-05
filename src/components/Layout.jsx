import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BookOpen, Compass, Layers3, Radio, Folder, Heart, Bookmark, History, Sparkles, Settings, UserRound, Menu, Search, Code2, Bell, Plus, X, CheckCheck, Shield, LogOut } from 'lucide-react';
import { api, getUser } from '../api';

const links = [
  {to:'/',label:'الرئيسية',icon:BookOpen,end:true}, {to:'/explore',label:'استكشف',icon:Compass},
  {to:'/categories',label:'المجالات',icon:Layers3}, {to:'/channels',label:'قنواتي',icon:Radio}, {to:'/projects',label:'المشاريع العملية',icon:Code2},
  {to:'/folders',label:'مجلداتي',icon:Folder}, {to:'/library/favorites',label:'المفضلة',icon:Heart},
  {to:'/library/watch-later',label:'مشاهدة لاحقًا',icon:Bookmark}, {to:'/library/history',label:'آخر مشاهدة',icon:History},
  {to:'/ai',label:'جيمناوي',icon:Sparkles}, {to:'/summaries',label:'ملخصاتي',icon:BookOpen},
  {to:'/settings',label:'الإعدادات',icon:Settings}, {to:'/profile',label:'ملفي الشخصي',icon:UserRound}
];
export default function Layout() {
  const [drawer,setDrawer] = useState(false), [search,setSearch] = useState(''), [notifications,setNotifications] = useState(false), [notes,setNotes] = useState([]), [unread,setUnread] = useState(0);
  const user = getUser(), navigate = useNavigate();
  const loadNotes = async () => { try { const d=await api('/notifications'); setNotes(d.items); setUnread(d.items.filter(n=>!n.read_at).length); } catch {} };
  useEffect(()=>{ loadNotes(); },[]);
  const submitSearch = e => { e.preventDefault(); if(search.trim()) { navigate(`/explore?q=${encodeURIComponent(search.trim())}`); setDrawer(false); } };
  const openNotifications = async () => { const next=!notifications; setNotifications(next); if(next) await loadNotes(); };
  const readAll = async () => { await api('/notifications/read-all',{method:'POST'}); await loadNotes(); };
  const readOne = async note => { await api(`/notifications/${note.id}/read`,{method:'POST'}); await loadNotes(); if(note.video_id) navigate(`/video/${note.video_id}`); };
  return <div className="app-shell">
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={()=>setDrawer(true)} aria-label="القائمة"><Menu/></button>
      <NavLink to="/" className="brand"><img src="/assets/logo.svg"/><span>خلاصة <b>المفيد</b><small>معرفتك في مكان واحد</small></span></NavLink>
      <form className="top-search" onSubmit={submitSearch}><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في مكتبتك عن فيديو أو قناة أو موضوع..."/><kbd>Enter</kbd></form>
      <div className="top-actions">
        <button className="icon-button notification-trigger" onClick={openNotifications} aria-label="الإشعارات"><Bell/>{unread>0&&<i/>}</button>
        <button className="user-chip" onClick={()=>navigate('/profile')}><span>{(user.name||'ض').slice(0,1)}</span><b>{user.name}</b></button>
      </div>
      {notifications&&<div className="notification-popover"><div className="popover-head"><b>الإشعارات</b><button onClick={readAll}><CheckCheck size={15}/> قراءة الكل</button><button onClick={()=>setNotifications(false)}><X size={16}/></button></div>{notes.length?notes.map(n=><button className={`notice ${n.read_at?'read':''}`} key={n.id} onClick={()=>readOne(n)}><b>{n.title}</b><small>{n.body}</small></button>):<p className="muted center">لا توجد إشعارات حتى الآن.</p>}</div>}
    </header>
    {drawer&&<button className="drawer-shade" onClick={()=>setDrawer(false)} aria-label="إغلاق القائمة"/>}
    <aside className={`sidebar ${drawer?'sidebar-open':''}`}>
      <div className="side-top"><span>مساحة التعلم</span><button className="icon-button close-drawer" onClick={()=>setDrawer(false)}><X/></button></div>
      <nav>{links.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} end={end} onClick={()=>setDrawer(false)} className={({isActive})=>`nav-link ${isActive?'nav-active':''}`}><Icon size={18}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="mini-promo"><Sparkles size={18}/><b>تعلم بذكاء</b><p>حوّل الفيديوهات إلى معرفة منظمة مع جيمناوي.</p><button onClick={()=>{navigate('/ai');setDrawer(false)}}>ابدأ المحادثة</button></div><NavLink to="/admin" onClick={()=>setDrawer(false)} className="nav-link admin-link"><Shield size={17}/><span>لوحة المالك</span></NavLink><small>خلاصة المفيد · إصدار 1.0</small></div>
    </aside>
    <main className="main-content"><Outlet/></main>
  </div>;
}
