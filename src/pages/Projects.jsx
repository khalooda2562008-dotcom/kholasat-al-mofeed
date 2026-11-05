import { useEffect,useState } from 'react';
import { Code2 } from 'lucide-react';
import { api } from '../api';
import { VideoGrid } from '../components/VideoCard';
export default function Projects(){const [items,setItems]=useState([]),[error,setError]=useState('');useEffect(()=>{api('/videos?project=1&limit=60').then(d=>setItems(d.items)).catch(e=>setError(e.message))},[]);return <div className="page-wrap"><div className="page-title-row"><div><span className="section-kicker">من المشاهدة إلى التطبيق</span><h1><Code2 size={26}/> المشاريع العملية</h1><p>فيديوهات رُصدت كمشاريع بناءً على عناوينها وأوصافها. راجع التصنيف يدويًا.</p></div></div>{error&&<div className="error-panel">{error}</div>}<VideoGrid items={items} empty="لم يتم اكتشاف مشاريع حتى الآن. أضف قنوات برمجة أو مهارات عملية."/></div>}
