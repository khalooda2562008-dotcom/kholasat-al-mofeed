import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Sparkles, Trash2, Copy, Bot, UserRound, RotateCw } from 'lucide-react';
import { api } from '../api';
export default function AI(){
 const location=useLocation();const initial=location.state||{};const [messages,setMessages]=useState([]),[text,setText]=useState(''),[transcript,setTranscript]=useState(initial.transcript||''),[busy,setBusy]=useState(false),[error,setError]=useState('');const bottom=useRef(null);
 const load=async()=>{try{const d=await api('/ai/history');setMessages(d.items)}catch(e){setError(e.message)}};useEffect(()=>{load()},[]);useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'})},[messages]);
 const send=async(e)=>{e?.preventDefault();if(!text.trim()||busy)return;const question=text.trim();setText('');setMessages(prev=>[...prev,{role:'user',content:question},{role:'assistant',content:'...'}]);setBusy(true);setError('');try{const d=await api('/ai/chat',{method:'POST',body:JSON.stringify({message:question,context:{video:initial.video,transcript}})});setMessages(prev=>[...prev.slice(0,-1),{role:'assistant',content:d.answer}]);}catch(err){setMessages(prev=>prev.slice(0,-1));setError(err.message)}finally{setBusy(false)}};
 const clear=async()=>{if(!confirm('مسح سجل محادثة جيمناوي؟'))return;await api('/ai/history',{method:'DELETE'});setMessages([])};
 const copy=async text=>{try{await navigator.clipboard.writeText(text)}catch{}};
 return <div className="page-wrap ai-page"><div className="page-title-row"><div><span className="section-kicker">مساعدك التعليمي</span><h1><Sparkles size={27}/> جيمناوي</h1><p>اسأل، افهم، لخّص، وحوّل المعرفة إلى خطوات قابلة للتطبيق.</p></div><button className="icon-button" onClick={clear} title="مسح المحادثة"><Trash2/></button></div>
 <div className="ai-layout"><aside className="ai-aside"><div className="ai-orb"><Sparkles size={35}/></div><h3>أهلًا بيك في جيمناوي</h3><p>مساعدك داخل خلاصة المفيد. يجيب اعتمادًا على المعلومات التي توفرها له، ولا يدّعي مشاهدة فيديو لم يحصل على نصه.</p><b>جرّب تسأله:</b>{['اعمل لي خطة لتعلم Python من الصفر','اشرح الفرق بين Frontend وBackend','حوّل هذا الموضوع إلى اختبار قصير','ما أفضل طريقة لمراجعة ما تعلمته؟'].map(s=><button key={s} className="prompt-suggestion" onClick={()=>setText(s)}>{s}</button>)}</aside>
 <section className="chat-panel"><div className="chat-head"><div><span className="online-dot"/><b>جيمناوي</b><small>المساعد الذكي لخلاصة المفيد</small></div><span className="muted">Google Gemini</span></div>
  <div className="chat-messages">{messages.length===0?<div className="chat-empty"><div className="chat-empty-icon"><Bot size={34}/></div><h3>خلينا نبدأ رحلة معرفة جديدة</h3><p>اكتب سؤالك في الأسفل، أو اختر أحد الاقتراحات.</p></div>:messages.map((m,i)=><div className={`chat-message ${m.role==='user'?'from-user':'from-ai'}`} key={i}><span className="message-avatar">{m.role==='user'?<UserRound size={17}/>:<Sparkles size={17}/>}</span><div className="message-bubble"><div className="message-content">{m.content}</div>{m.role==='assistant'&&m.content!=='...'&&<button className="copy-answer" onClick={()=>copy(m.content)}><Copy size={13}/> نسخ الإجابة</button>}</div></div>)}<div ref={bottom}/></div>
  {error&&<div className="error-text chat-error">{error}</div>}
  <form className="chat-compose" onSubmit={send}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="اكتب سؤالك لجيمناوي..." rows={2}/><button className="primary-button" disabled={busy||!text.trim()}>{busy?<RotateCw className="spin"/>:<Send size={18}/>}</button></form>
 </section></div>
 {initial.video&&<div className="panel ai-context-note"><Sparkles size={18}/><div><b>سياق الفيديو مرفق</b><small>{initial.video.title}</small></div></div>}
 {initial.video&&<div className="panel transcript-panel"><b>نص التفريغ (لتحليل أعمق)</b><textarea value={transcript} onChange={e=>setTranscript(e.target.value)} placeholder="الصق نص الفيديو هنا..." rows={3}/></div>}
 </div>
}
