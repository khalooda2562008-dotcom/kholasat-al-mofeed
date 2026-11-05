import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, UserRound, ArrowLeft, PlayCircle, ShieldCheck } from 'lucide-react';
import { api } from './api';
import Layout from './components/Layout';
import { HomePage, ExplorePage, CategoriesPage, ChannelsPage, VideoPage, AIPage, FoldersPage, FolderDetailPage, CollectionPage, SettingsPage, ProfilePage, SummariesPage, PathsPage, AdminPage } from './pages/Pages';

function Welcome({ onEnter }: { onEnter: (name: string) => Promise<void> }) {
  const [name,setName]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function enter(displayName:string){setBusy(true);setError('');try{await onEnter(displayName)}catch(e){setError(e instanceof Error?e.message:'تعذر بدء الجلسة.')}finally{setBusy(false)}}
  return <div className="welcome-screen">
    <div className="welcome-glow glow-one"/><div className="welcome-glow glow-two"/>
    <div className="welcome-nav"><div className="brand-mark large"><BookOpen size={29}/><Sparkles size={12}/></div><b>خلاصة المفيد</b><span className="welcome-nav-tag">مكتبتك التعليمية الذكية</span></div>
    <div className="welcome-main">
      <div className="welcome-copy"><span className="eyebrow"><Sparkles size={14}/> المعرفة تستحق مكانًا منظمًا</span>
        <h1>كل المعرفة التي تحتاجها،<br/><em>منظمة في مكان واحد.</em></h1>
        <p>اجمع أفضل الفيديوهات من قنواتك المفضلة، رتّبها حسب المجالات، واحتفظ بملخصاتك وخطوات تعلمك في مكتبة واحدة.</p>
        <div className="welcome-points"><span><PlayCircle size={17}/> فيديوهات من قنواتك</span><span><BookOpen size={17}/> مكتبة منظمة</span><span><Sparkles size={17}/> مساعد ذكي</span></div>
        <div className="welcome-form"><label htmlFor="displayName">تحب نناديك بإيه؟ <small>اختياري</small></label><div className="welcome-input"><UserRound size={18}/><input id="displayName" value={name} onChange={e=>setName(e.target.value)} placeholder="اكتب اسمك هنا" maxLength={50}/></div>
          {error&&<p className="error-text">{error}</p>}
          <button className="primary-button full" disabled={busy} onClick={()=>enter(name.trim()||'ضيف')}>{busy?'جارٍ فتح مكتبتك...':'ابدأ الآن'}<ArrowLeft size={18}/></button>
          <button className="guest-button" disabled={busy} onClick={()=>enter('ضيف')}>الدخول كضيف دون اسم</button>
          <small className="privacy-note">دخول محلي بسيط دون بريد إلكتروني أو كلمة مرور. بيانات هذه النسخة مرتبطة بهذا المتصفح.</small>
        </div>
      </div>
      <div className="welcome-art"><div className="art-orbit orbit-a"/><div className="art-orbit orbit-b"/><div className="art-main-card"><div className="art-card-top"><div className="brand-mark"><BookOpen size={20}/></div><span>مكتبتك اليوم</span><span className="live-dot"/></div><div className="art-hero-lines"><i/><i/><i/></div><div className="art-mini-grid"><div className="art-mini blue"><PlayCircle/><b>فيديوهات</b><small>من قنواتك</small></div><div className="art-mini purple"><Sparkles/><b>جيمناوي</b><small>مساعدك الذكي</small></div><div className="art-mini cyan"><LayersIcon/><b>مجالات</b><small>مرتبة لك</small></div><div className="art-mini orange"><BookOpen/><b>ملخصات</b><small>ترجع لها</small></div></div><div className="art-progress"><span>مسارك التعليمي</span><b>68%</b><i><em/></i></div></div><div className="floating-chip chip-top"><Sparkles size={15}/> تعلم بذكاء</div><div className="floating-chip chip-bottom"><PlayCircle size={15}/> كل شيء في مكانه</div></div>
    </div>
    <div className="welcome-bottom"><span>خلاصة المفيد © 2026</span><span>نظّم وقتك. ركّز في المهم.</span></div>
  </div>;
}
function LayersIcon(){return <BookOpen size={19}/>}

export default function App(){
  const [user,setUser]=useState<{id:string;name:string}|null>(null); const [booting,setBooting]=useState(true); const navigate=useNavigate();
  useEffect(()=>{const id=localStorage.getItem('km_user_id');const name=localStorage.getItem('km_user_name');if(id){setUser({id,name:name||'ضيف'});api('/users/ensure',{method:'POST',body:JSON.stringify({id,name:name||'ضيف'})}).catch(()=>{});}setBooting(false)},[]);
  async function enter(name:string){
    const id=localStorage.getItem('km_user_id')||crypto.randomUUID();
    await api('/users/ensure',{method:'POST',body:JSON.stringify({id,name})});
    localStorage.setItem('km_user_id',id);localStorage.setItem('km_user_name',name);setUser({id,name});navigate('/');
  }
  if(booting)return <div className="boot-screen"><div className="brand-mark large"><BookOpen/></div><span>خلاصة المفيد</span><i/></div>;
  if(!user)return <Routes><Route path="/admin" element={<AdminPage/>}/><Route path="*" element={<Welcome onEnter={enter}/>}/></Routes>;
  return <Routes>
    <Route element={<Layout name={user.name} onLogout={()=>{localStorage.removeItem('km_user_id');localStorage.removeItem('km_user_name');setUser(null)}}/>}>
      <Route index element={<HomePage/>}/><Route path="explore" element={<ExplorePage/>}/><Route path="categories" element={<CategoriesPage/>}/><Route path="channels" element={<ChannelsPage/>}/>
      <Route path="video/:id" element={<VideoPage/>}/><Route path="ai" element={<AIPage/>}/><Route path="folders" element={<FoldersPage/>}/><Route path="folders/:id" element={<FolderDetailPage/>}/>
      <Route path="favorites" element={<CollectionPage collection="favorites" title="المفضلة"/>}/><Route path="watch-later" element={<CollectionPage collection="watch-later" title="مشاهدة لاحقًا"/>}/>
      <Route path="history" element={<CollectionPage collection="history" title="آخر مشاهدة"/>}/><Route path="summaries" element={<SummariesPage/>}/><Route path="paths" element={<PathsPage/>}/>
      <Route path="settings" element={<SettingsPage/>}/><Route path="profile" element={<ProfilePage name={user.name}/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route>
    <Route path="/admin" element={<AdminPage/>}/>
  </Routes>;
}
