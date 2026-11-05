import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Radio, Sparkles, TrendingUp, FolderOpen, PlayCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { VideoGrid } from '../components/VideoCard';
export default function Home() {
  const [data,setData]=useState({videos:[],channels:[],integrations:{},settings:{}}),[continueItems,setContinueItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);try{const [d,c]=await Promise.all([api('/bootstrap'),api('/library/continue')]);setData({videos:d.videos||[],channels:d.channels||[],integrations:d.integrations||{},settings:d.settings||{}});setContinueItems(c.items||[]);setError('');}catch(e){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const latest=data.videos;
  const popular=[...latest].sort((a,b)=>Number(b.view_count)-Number(a.view_count)).slice(0,8);
  const projects=latest.filter(v=>v.is_project);
  return <div className="page-wrap">
    <section className="hero-banner"><div className="hero-content"><span className="eyebrow"><Sparkles size={14}/> مساحتك للتعلّم</span><h1>المعرفة المفيدة،<br/><em>في مكانها الصحيح.</em></h1><p>تابع قنواتك التعليمية، واجمع المحتوى الذي يهمك في مكتبة واحدة منظمة.</p><div className="hero-buttons"><Link to="/channels" className="primary-button"><Plus size={17}/> أضف قناتك الأولى</Link><Link to="/explore" className="light-link">استكشف مكتبتي <ArrowLeft size={16}/></Link></div></div><div className="hero-visual"><div className="hero-glow"/><div className="hero-tile tile-a"><PlayCircle size={27}/><b>تعلّم باستمرار</b><small>خطوة كل يوم</small></div><div className="hero-tile tile-b"><FolderOpen size={25}/><b>معرفة منظمة</b><small>كل شيء في مكانه</small></div><div className="hero-tile tile-c"><Sparkles size={25}/><b>جيمناوي</b><small>اسأل وافهم أكثر</small></div></div></section>
    <div className="welcome-strip"><div><b>أهلًا بيك في خلاصة المفيد 👋</b><span>{data.channels.length?`تتابع ${data.channels.length} قناة داخل مكتبتك.`:'ابدأ بإضافة قنواتك التعليمية ليظهر محتواها هنا.'}</span></div><Link to="/channels">إدارة القنوات <ArrowLeft size={15}/></Link></div>
    {!data.integrations.youtube&&<div className="integration-alert"><span>!</span><div><b>واجهة المكتبة جاهزة، لكن YouTube API غير مفعّل</b><small>أضف YOUTUBE_API_KEY على الخادم لتبحث عن القنوات وتجلب فيديوهاتها.</small></div></div>}
    {data.settings?.sections?.latest!==false&&<section className="content-section"><div className="section-heading"><div><span className="section-kicker">مكتبتك</span><h2>أحدث الفيديوهات</h2><p>فيديوهات القنوات التي أضفتها فقط.</p></div><button className="text-action" onClick={load}><RefreshCw size={15}/> تحديث</button></div>
      {error?<div className="error-panel">{error}</div>:loading?<div className="loading-grid">{Array.from({length:4},(_,i)=><div className="skeleton" key={i}/>)}</div>:<VideoGrid items={latest} onUpdate={load} empty="لسه مفيش فيديوهات في مكتبتك."/>}
    </section>}
    {data.settings?.sections?.popular!==false&&popular.length>0&&<section className="content-section"><div className="section-heading"><div><span className="section-kicker">داخل مكتبتك</span><h2><TrendingUp size={20}/> الأكثر مشاهدة</h2></div></div><VideoGrid items={popular.slice(0,4)} onUpdate={load}/></section>}
    {data.settings?.sections?.projects!==false&&projects.length>0&&<section className="content-section"><div className="section-heading"><div><span className="section-kicker">تطبيق عملي</span><h2>مشاريع تستحق التجربة</h2></div><Link className="text-action" to="/explore">عرض الكل <ArrowLeft size={15}/></Link></div><VideoGrid items={projects} onUpdate={load}/></section>}
    {data.settings?.sections?.continue!==false&&continueItems.length>0&&<section className="content-section"><div className="section-heading"><div><span className="section-kicker">تابع من حيث توقفت</span><h2>استكمال المشاهدة</h2></div></div><VideoGrid items={continueItems} onUpdate={load}/></section>}
    <section className="content-section"><div className="section-heading"><div><span className="section-kicker">قنواتك</span><h2><Radio size={20}/> القنوات المضافة</h2></div><Link className="text-action" to="/channels">إدارة القنوات <ArrowLeft size={15}/></Link></div>
      {data.channels.length?<div className="channel-grid">{data.channels.slice(0,6).map(c=><Link to={`/channels/${c.id}`} className="channel-card" key={c.id}><img src={c.thumbnail||'/assets/logo.svg'}/><div><b>{c.title}</b><small>{c.user_category||c.category}</small></div></Link>)}</div>:<div className="add-channel-box"><Radio size={25}/><div><b>مكتبتك لسه فاضية</b><p>أضف قناة تعليمية وسيتم جلب أحدث فيديوهاتها.</p></div><Link to="/channels" className="primary-button small">إضافة قناة <Plus size={15}/></Link></div>}
    </section>
  </div>;
}
