import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Sparkles, LibraryBig, UserRound } from 'lucide-react';
import { api, getUser, setUserName } from '../api';
export default function Welcome() {
  const [name,setName] = useState(getUser().name==='ضيف'?'':getUser().name), [error,setError] = useState(''), [busy,setBusy] = useState(false);
  const navigate = useNavigate();
  const enter = async guest => {
    setBusy(true); setError('');
    try {
      const user=setUserName(guest?'ضيف':name.trim());
      if (!guest && !user.name) throw new Error('اكتب اسمك أو ادخل كضيف.');
      if (!guest) await api('/profile',{method:'PATCH',body:JSON.stringify({name:user.name})});
      else await api('/bootstrap');
      localStorage.setItem('km_entered_v1','yes'); navigate('/',{replace:true});
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="welcome-page"><div className="welcome-orb orb-one"/><div className="welcome-orb orb-two"/>
    <div className="welcome-card">
      <div className="welcome-brand"><img src="/assets/logo.svg"/><span>خلاصة المفيد</span></div>
      <div className="welcome-art"><div className="art-book"><BookOpen size={70}/><Sparkles className="art-spark" size={28}/></div><div className="art-lines"><i/><i/><i/><i/></div></div>
      <span className="eyebrow">مكتبتك التعليمية الذكية</span>
      <h1>كل المعرفة التي تحتاجها،<br/><em>منظمة في مكان واحد.</em></h1>
      <p className="welcome-copy">اجمع فيديوهات قنواتك المفضلة، رتّبها في مجالات ومجلدات، وتعلّم بتركيز بمساعدة جيمناوي.</p>
      <label className="field-label">اسمك (اختياري)</label>
      <div className="name-field"><UserRound size={18}/><input value={name} onChange={e=>setName(e.target.value)} placeholder="اكتب اسمك هنا" maxLength={60}/></div>
      {error&&<div className="error-text">{error}</div>}
      <button className="primary-button wide" disabled={busy} onClick={()=>enter(false)}>{busy?'جارٍ الدخول':'ابدأ الآن'}<ArrowLeft size={18}/></button>
      <button className="ghost-button wide" disabled={busy} onClick={()=>enter(true)}>الدخول كضيف</button>
      <div className="welcome-features"><span><LibraryBig size={15}/> مكتبة خاصة</span><span><Sparkles size={15}/> مساعد ذكي</span><span><BookOpen size={15}/> تعلّم منظم</span></div>
      <small className="privacy-note">الدخول بالاسم تعريف محلي للجهاز وليس حسابًا آمنًا أو وسيلة لمزامنة بياناتك بين الأجهزة.</small>
    </div>
  </div>;
}
