import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Bookmark, History, PlayCircle, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { VideoGrid } from '../components/VideoCard';
const config={favorites:['المفضلة',Heart,'الفيديوهات التي حفظتها كمفضلة.'], 'watch-later':['مشاهدة لاحقًا',Bookmark,'الفيديوهات التي تريد الرجوع إليها.'],history:['آخر مشاهدة',History,'سجل الفيديوهات التي فتحتها.'],continue:['استكمال المشاهدة',PlayCircle,'الفيديوهات التي لم تكمل مشاهدتها بعد.']};
export default function Library(){const {type}=useParams();const [items,setItems]=useState([]),[error,setError]=useState('');const meta=config[type]||config.favorites;const [title,Icon,desc]=meta;const load=async()=>{try{const d=await api(`/library/${type}`);setItems(d.items);setError('')}catch(e){setError(e.message)}};useEffect(()=>{load()},[type]);return <div className="page-wrap"><div className="page-title-row"><div><span className="section-kicker">مكتبتي الشخصية</span><h1><Icon size={26}/> {title}</h1><p>{desc}</p></div><span className="count-pill">{items.length} فيديو</span></div>{error&&<div className="error-panel">{error}</div>}<VideoGrid items={items} onUpdate={load} empty="لا توجد فيديوهات في هذا القسم حتى الآن."/><div className="back-line"><Link to="/">العودة للرئيسية <ArrowRight size={15}/></Link></div></div>}
