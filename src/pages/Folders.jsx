import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Folder, Plus, Trash2, ArrowRight, X } from 'lucide-react';
import { api } from '../api';
import { VideoGrid } from '../components/VideoCard';
export default function Folders(){
 const {id}=useParams(),navigate=useNavigate();const [items,setItems]=useState([]),[videos,setVideos]=useState([]),[name,setName]=useState(''),[description,setDescription]=useState(''),[error,setError]=useState('');
 const load=async()=>{try{if(id){const d=await api(`/folders/${id}/videos`);setVideos(d.items)}else{const d=await api('/folders');setItems(d.items)}}catch(e){setError(e.message)}};
 useEffect(()=>{load()},[id]);
 const create=async e=>{e.preventDefault();try{const d=await api('/folders',{method:'POST',body:JSON.stringify({name,description})});setName('');setDescription('');navigate(`/folders/${d.folder.id}`)}catch(e){setError(e.message)}};
 const remove=async f=>{if(!confirm(`حذف مجلد «${f.name}»؟ لن تُحذف الفيديوهات الأصلية.`))return;try{await api(`/folders/${f.id}`,{method:'DELETE'});await load()}catch(e){setError(e.message)}};
 if(id)return <div className="page-wrap"><div className="page-title-row"><div><button className="back-button" onClick={()=>navigate('/folders')}><ArrowRight size={15}/> كل المجلدات</button><h1><Folder size={25}/> محتويات المجلد</h1></div></div><VideoGrid items={videos} empty="هذا المجلد فارغ. أضف إليه فيديو من صفحة الفيديو."/><div className="back-line"><button onClick={()=>navigate('/folders')} className="text-action">العودة للمجلدات</button></div></div>;
 return <div className="page-wrap"><div className="page-title-row"><div><span className="section-kicker">نظّم المحتوى</span><h1>مجلداتي</h1><p>اجمع الفيديوهات في مجموعات تناسب أهدافك التعليمية.</p></div><span className="count-pill">{items.length} مجلد</span></div>
  <form className="panel folder-create" onSubmit={create}><div className="panel-title"><div className="panel-icon"><Plus/></div><div><b>إنشاء مجلد جديد</b><small>مثال: تعلم Python من الصفر</small></div></div><div className="folder-form-row"><input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المجلد" maxLength={80}/><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="وصف اختياري" maxLength={250}/><button className="primary-button"><Plus size={17}/> إنشاء</button></div>{error&&<div className="error-text">{error}</div>}</form>
  {items.length?<div className="folder-grid">{items.map(f=><div className="folder-card" key={f.id}><button className="folder-open" onClick={()=>navigate(`/folders/${f.id}`)}><div className="folder-illustration"><Folder size={34}/></div><b>{f.name}</b><small>{f.description||'مجموعة فيديوهات تعليمية'}</small><span>{f.video_count} فيديو</span></button><button className="icon-button danger folder-delete" onClick={()=>remove(f)} title="حذف المجلد"><Trash2 size={16}/></button></div>)}</div>:<div className="empty-state"><Folder size={34}/><b>أنشئ أول مجلد لك</b><p>رتّب الفيديوهات حسب الكورس أو المهارة التي تتعلمها.</p></div>}
 </div>;
}
