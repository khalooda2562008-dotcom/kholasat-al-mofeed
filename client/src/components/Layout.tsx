import type React from 'react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, BrainCircuit, ChevronRight, CircleHelp, Compass, Folder, GraduationCap, Heart, History, Home, Layers, Library, Menu, Plus, Search, Settings, Sparkles, X, Bell, UserRound, ShieldCheck, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { api } from '../api';

const mainLinks = [
  {to:'/',label:'الرئيسية',icon:Home}, {to:'/explore',label:'استكشف',icon:Compass}, {to:'/categories',label:'المجالات',icon:Layers},
  {to:'/channels',label:'القنوات',icon:Library}, {to:'/folders',label:'مجلداتي',icon:Folder}
];
const savedLinks = [
  {to:'/favorites',label:'المفضلة',icon:Heart}, {to:'/watch-later',label:'مشاهدة لاحقًا',icon:Bookmark},
  {to:'/history',label:'آخر مشاهدة',icon:History}, {to:'/summaries',label:'ملخصاتي',icon:BookOpen}
];

export default function Layout({name, onLogout}:{name:string;onLogout:()=>void}) {
  const [collapsed,setCollapsed]=useState(localStorage.getItem('km_sidebar_collapsed')==='1');
  const [drawer,setDrawer]=useState(false); const [search,setSearch]=useState(''); const [noticeOpen,setNoticeOpen]=useState(false);
  const [notifications,setNotifications]=useState<any[]>([]); const [unread,setUnread]=useState(0); const [notifyEnabled,setNotifyEnabled]=useState(true);
  const location=useLocation(); const navigate=useNavigate();
  useEffect(()=>{localStorage.setItem('km_sidebar_collapsed',collapsed?'1':'0')},[collapsed]);
  useEffect(()=>{setDrawer(false);},[location.pathname]);
  async function loadNotifications(){if(!notifyEnabled){setNotifications([]);setUnread(0);return}try{const data=await api<any>('/notifications');setNotifications(data.notifications);setUnread(data.unread);}catch{}}
  useEffect(()=>{api<any>('/settings').then(x=>{setNotifyEnabled(x.settings.notifications!==false);document.documentElement.dataset.theme=x.settings.theme||'dark';document.documentElement.dataset.density=x.settings.density||'comfortable'}).catch(()=>{});},[]);
  useEffect(()=>{loadNotifications();const t=setInterval(loadNotifications,60000);return()=>clearInterval(t)},[notifyEnabled]);
  function doSearch(e:React.FormEvent){e.preventDefault();if(search.trim())navigate(`/explore?q=${encodeURIComponent(search.trim())}`)}
  async function markAll(){try{await api('/notifications/read-all',{method:'POST'});loadNotifications()}catch{}}
  async function openNotification(n:any){try{await api(`/notifications/${n.id}/read`,{method:'PATCH'});loadNotifications();if(n.video_id) navigate(`/video/${n.video_id}`)}catch{}}
  const navContent=<>
    <div className="side-brand"><div className="brand-mark"><BookOpen size={22}/><Sparkles size={10}/></div>{!collapsed&&<div><b>خلاصة المفيد</b><small>معرفتك في مكان واحد</small></div>}</div>
    <div className="side-scroll">
      <div className="nav-caption">القائمة الرئيسية</div>
      {mainLinks.map(item=><NavLink key={item.to} to={item.to} end={item.to==='/'} className={({isActive})=>`side-link ${isActive?'active':''}`}><item.icon size={19}/>{!collapsed&&<span>{item.label}</span>}</NavLink>)}
      <div className="nav-caption">مكتبتي</div>
      {savedLinks.map(item=><NavLink key={item.to} to={item.to} className={({isActive})=>`side-link ${isActive?'active':''}`}><item.icon size={19}/>{!collapsed&&<span>{item.label}</span>}</NavLink>)}
      <div className="nav-caption">التعلم الذكي</div>
      <NavLink to="/ai" className={({isActive})=>`side-link ${isActive?'active':''}`}><BrainCircuit size={19}/>{!collapsed&&<span>اسأل جيمناوي</span>}</NavLink>
      <NavLink to="/paths" className={({isActive})=>`side-link ${isActive?'active':''}`}><GraduationCap size={19}/>{!collapsed&&<span>المسارات التعليمية</span>}</NavLink>
      <NavLink to="/settings" className={({isActive})=>`side-link ${isActive?'active':''}`}><Settings size={19}/>{!collapsed&&<span>الإعدادات</span>}</NavLink>
    </div>
    <div className="side-footer">
      <NavLink to="/profile" className="profile-mini"><div className="user-avatar">{name?.[0]||'ض'}</div>{!collapsed&&<div><b>{name||'ضيف'}</b><small>حساب محلي</small></div>}</NavLink>
      <button className="side-collapse" onClick={()=>setCollapsed(!collapsed)} title="طي القائمة">{collapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button>
    </div>
  </>;
  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
    <aside className="sidebar desktop-sidebar">{navContent}</aside>
    {drawer&&<div className="drawer-backdrop" onClick={()=>setDrawer(false)}><aside className="sidebar mobile-sidebar" onClick={e=>e.stopPropagation()}>{navContent}</aside></div>}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={()=>setDrawer(true)} aria-label="القائمة"><Menu/></button>
        <form className="search-box" onSubmit={doSearch}><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن فيديو أو قناة أو موضوع..."/><kbd>Enter</kbd></form>
        <div className="top-actions">
          <button className="icon-button top-add" onClick={()=>navigate('/channels?add=1')} title="إضافة قناة"><Plus/></button>
          <div className="notification-wrap">
            <button className="icon-button" onClick={()=>setNoticeOpen(!noticeOpen)} aria-label="الإشعارات"><Bell/>{unread>0&&<i className="notification-dot">{unread>9?'9+':unread}</i>}</button>
            {noticeOpen&&<div className="notification-popover"><div className="popover-head"><b>الإشعارات</b><button onClick={markAll}>تحديد الكل كمقروء</button></div>{notifications.length?notifications.slice(0,8).map(n=><button className={`notice-item ${!n.is_read?'unread':''}`} key={n.id} onClick={()=>openNotification(n)}><span className="notice-icon"><Bell size={15}/></span><span><b>{n.title}</b><small>{n.body}</small></span></button>):<div className="empty-small">لا توجد إشعارات حاليًا</div>}</div>}
          </div>
          <button className="user-chip" onClick={()=>navigate('/profile')}><span className="user-avatar">{name?.[0]||'ض'}</span><span>{name||'ضيف'}</span></button>
        </div>
      </header>
      <div className="page-content"><Outlet/></div>
      <footer className="app-footer"><span>خلاصة المفيد</span><span>رتّب معرفتك. تعلّم بذكاء.</span></footer>
    </main>
  </div>;
}
