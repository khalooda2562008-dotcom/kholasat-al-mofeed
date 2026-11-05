import { useEffect, useState } from 'react';
import {
  Shield, LockKeyhole, Users, Radio, Video, Folder, BookOpen, Activity,
  LogOut, RefreshCw, BrainCircuit, Youtube, KeyRound, Save, Trash2,
  Eye, EyeOff, CheckCircle2, AlertCircle, LoaderCircle, ExternalLink
} from 'lucide-react';
import { api } from '../api';
import './admin-integrations.css';

const PROVIDERS = {
  youtube: {
    title: 'YouTube Data API v3',
    description: 'للبحث عن القنوات والتحقق منها وجلب الفيديوهات الجديدة.',
    placeholder: 'الصق مفتاح YouTube API هنا',
    help: 'أنشئ المفتاح من Google Cloud Console وفعّل YouTube Data API v3.',
    icon: Youtube,
    helpUrl: 'https://console.cloud.google.com/apis/library/youtube.googleapis.com'
  },
  gemini: {
    title: 'Google Gemini API',
    description: 'لتشغيل جيمناوي والتلخيص وتحليل النصوص وتوليد الإجابات.',
    placeholder: 'الصق مفتاح Gemini API هنا',
    help: 'أنشئ المفتاح من Google AI Studio. سيختبر التطبيق دعم generateContent.',
    icon: BrainCircuit,
    helpUrl: 'https://aistudio.google.com/app/apikey'
  }
};

const emptyMeta = { configured: false, source: 'missing', masked: '', updatedAt: null };

export default function Admin() {
  const [password, setPassword] = useState('');
  const [logged, setLogged] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState('');
  const [keys, setKeys] = useState({ youtube: '', gemini: '' });
  const [showKey, setShowKey] = useState({ youtube: false, gemini: false });
  const [integrationMeta, setIntegrationMeta] = useState({ youtube: emptyMeta, gemini: emptyMeta });
  const [integrationBusy, setIntegrationBusy] = useState({});
  const [integrationMessage, setIntegrationMessage] = useState({});

  const load = async () => {
    try {
      const [status, integrations] = await Promise.all([
        api('/admin/status'),
        api('/admin/integrations')
      ]);
      setData(status);
      setIntegrationMeta(integrations.integrations || { youtube: emptyMeta, gemini: emptyMeta });
      setLogged(true);
      setError('');
    } catch (e) {
      setLogged(false);
      setError(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const login = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      setPassword('');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    try { await api('/admin/logout', { method: 'POST' }); } finally {
      setLogged(false);
      setData(null);
    }
  };

  const runIntegration = async (provider, action) => {
    setIntegrationBusy(s => ({ ...s, [provider]: action }));
    setIntegrationMessage(s => ({ ...s, [provider]: null }));
    try {
      let result;
      if (action === 'save') {
        const key = keys[provider].trim();
        if (!key) throw new Error('أدخل المفتاح أولًا.');
        result = await api(`/admin/integrations/${provider}`, {
          method: 'PUT', body: JSON.stringify({ key })
        });
        setKeys(s => ({ ...s, [provider]: '' }));
        setIntegrationMessage(s => ({ ...s, [provider]: { type: 'success', text: result.message || 'تم حفظ المفتاح.' } }));
      } else if (action === 'test') {
        result = await api(`/admin/integrations/${provider}/test`, { method: 'POST', body: JSON.stringify({}) });
        setIntegrationMessage(s => ({ ...s, [provider]: { type: 'success', text: provider === 'gemini' ? `${result.message} الموديل: ${result.model}` : `${result.message} (وحدة حصة تقديرية للاختبار)` } }));
      } else if (action === 'delete') {
        result = await api(`/admin/integrations/${provider}`, { method: 'DELETE' });
        setIntegrationMessage(s => ({ ...s, [provider]: { type: 'success', text: result.message || 'تم حذف المفتاح المحفوظ.' } }));
      }
      const latest = await api('/admin/integrations');
      setIntegrationMeta(latest.integrations || { youtube: emptyMeta, gemini: emptyMeta });
      const status = await api('/admin/status');
      setData(status);
    } catch (e) {
      setIntegrationMessage(s => ({ ...s, [provider]: { type: 'error', text: e.message } }));
    } finally {
      setIntegrationBusy(s => ({ ...s, [provider]: '' }));
    }
  };

  const checkModel = async () => {
    setBusy(true);
    setModel('');
    try {
      const d = await api('/admin/model-check');
      setModel(`الموديل المتاح: ${d.model}`);
    } catch (e) {
      setModel(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!logged) {
    return <div className="page-wrap admin-login-wrap">
      <form className="panel admin-login" onSubmit={login}>
        <div className="admin-lock"><LockKeyhole size={30}/></div>
        <span className="section-kicker">منطقة خاصة</span>
        <h1>لوحة المالك</h1>
        <p>هذه اللوحة محمية من الخادم بكلمة مرور مستقلة، وليست مجرد رابط مخفي.</p>
        <label className="field"><span>كلمة مرور المالك</span><input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/></label>
        {error && <div className="error-text">{error}</div>}
        <button className="primary-button wide" disabled={busy}>{busy ? 'جارٍ التحقق' : 'تسجيل الدخول'}</button>
      </form>
    </div>;
  }

  const metrics = [
    ['المستخدمون', data.metrics.users, Users], ['القنوات', data.metrics.channels, Radio],
    ['الفيديوهات', data.metrics.videos, Video], ['المجلدات', data.metrics.folders, Folder],
    ['الملخصات', data.metrics.summaries, BookOpen], ['الإشعارات', data.metrics.notifications, Activity]
  ];

  return <div className="page-wrap">
    <div className="page-title-row">
      <div><span className="section-kicker">إدارة النظام</span><h1><Shield size={26}/> لوحة المالك</h1><p>إدارة مفاتيح الخدمات ومراقبة تشغيل المنصة.</p></div>
      <div className="admin-head-actions"><button className="ghost-button" onClick={load}><RefreshCw size={15}/> تحديث</button><button className="ghost-button" onClick={logout}><LogOut size={16}/> خروج</button></div>
    </div>

    <div className="stats-grid admin-stats">{metrics.map(([label, value, Icon]) => <div className="stat-card" key={label}><Icon/><b>{Number(value).toLocaleString('ar-EG')}</b><span>{label}</span></div>)}</div>

    <section className="panel admin-integrations">
      <div className="section-heading"><div><h2>ربط مفاتيح API</h2><p>أدخل مفاتيح المنصة هنا بدل تعديل ملفات الكود في كل مرة.</p></div><KeyRound size={22}/></div>
      <div className="api-key-grid">
        {Object.entries(PROVIDERS).map(([provider, config]) => {
          const Icon = config.icon;
          const meta = integrationMeta[provider] || emptyMeta;
          const message = integrationMessage[provider];
          const action = integrationBusy[provider];
          return <article className="api-key-card" key={provider}>
            <div className="api-key-title-row">
              <span className={`api-key-icon ${provider}`}><Icon size={22}/></span>
              <div className="api-key-title"><h3>{config.title}</h3><p>{config.description}</p></div>
              <span className={`api-status ${meta.configured ? 'is-connected' : 'is-missing'}`}>
                {meta.configured ? 'مربوط' : 'غير مربوط'}
              </span>
            </div>
            {meta.configured && <div className="api-key-current">
              <CheckCircle2 size={16}/><span>المفتاح الحالي: <b dir="ltr">{meta.masked}</b></span>
              <small>{meta.source === 'database' ? 'محفوظ مشفّرًا في قاعدة البيانات' : 'مأخوذ من متغيرات بيئة الخادم'}</small>
            </div>}
            <label className="api-key-input-label" htmlFor={`${provider}-api-key`}>مفتاح API {meta.configured ? '(أدخل قيمة جديدة للاستبدال)' : ''}</label>
            <div className="api-key-input-wrap">
              <input id={`${provider}-api-key`} type={showKey[provider] ? 'text' : 'password'} dir="ltr" autoComplete="new-password" spellCheck="false" placeholder={config.placeholder} value={keys[provider]} onChange={e => setKeys(s => ({ ...s, [provider]: e.target.value }))}/>
              <button type="button" className="api-eye-button" aria-label={showKey[provider] ? 'إخفاء المفتاح' : 'إظهار المفتاح'} onClick={() => setShowKey(s => ({ ...s, [provider]: !s[provider] }))}>{showKey[provider] ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </div>
            <div className="api-key-actions">
              <button className="primary-button" disabled={Boolean(action) || !keys[provider].trim()} onClick={() => runIntegration(provider, 'save')}>
                {action === 'save' ? <LoaderCircle className="spin" size={15}/> : <Save size={15}/>} حفظ المفتاح
              </button>
              <button className="secondary-button" disabled={Boolean(action) || !meta.configured} onClick={() => runIntegration(provider, 'test')}>
                {action === 'test' ? <LoaderCircle className="spin" size={15}/> : <Activity size={15}/>} اختبار الاتصال
              </button>
              {meta.source === 'database' && <button className="danger-outline-button" disabled={Boolean(action)} onClick={() => { if (window.confirm('حذف المفتاح المحفوظ لهذا التكامل؟')) runIntegration(provider, 'delete'); }}><Trash2 size={15}/> حذف</button>}
            </div>
            {message && <div className={`api-feedback ${message.type}`}><IconForFeedback type={message.type}/><span>{message.text}</span></div>}
            <p className="api-key-help">{config.help} <a href={config.helpUrl} target="_blank" rel="noreferrer">فتح صفحة المفاتيح <ExternalLink size={12}/></a></p>
          </article>;
        })}
      </div>
      <div className="api-security-note"><Shield size={17}/><span>المفاتيح لا تُرسل إلى واجهة المستخدم بعد حفظها؛ تُشفّر على الخادم باستخدام AES-256-GCM. لا ترفع ملف .env أو المفاتيح إلى GitHub، ولا تغيّر SESSION_SECRET بعد حفظ المفاتيح إلا بعد ترحيلها.</span></div>
    </section>

    <section className="panel admin-integrations">
      <div className="section-heading"><div><h2>حالة الخدمات</h2><p>حالة الإعداد والموديل الفعلي.</p></div><button className="icon-button" onClick={load}><RefreshCw/></button></div>
      <div className="integration-status">
        <div><Youtube/><b>YouTube Data API</b><span className={data.integrations.youtube ? 'status-on' : 'status-off'}>{data.integrations.youtube ? 'مُعدّ' : 'غير مُعدّ'}</span></div>
        <div><BrainCircuit/><b>Gemini API</b><span className={data.integrations.gemini ? 'status-on' : 'status-off'}>{data.integrations.gemini ? 'مُعدّ' : 'غير مُعدّ'}</span></div>
      </div>
      <p className="muted">موديل Gemini المحدد من متغيرات الخادم: {data.modelConfigured}</p>
      <p className="muted">حصة YouTube التقديرية: {Number(data.quota?.used || 0).toLocaleString('ar-EG')} / {Number(data.quota?.budget || 0).toLocaleString('ar-EG')} وحدة · المتبقي التقديري {Number(data.quota?.remaining || 0).toLocaleString('ar-EG')}</p>
      <button className="secondary-button" onClick={checkModel} disabled={busy || !data.integrations.gemini}>{busy ? 'جارٍ الفحص...' : 'فحص الموديلات المتاحة'}</button>
      {model && <div className="success-text">{model}</div>}
    </section>

    <section className="panel">
      <h2>استهلاك API المسجل داخليًا</h2>
      {data.usage.length ? <div className="table-wrap"><table><thead><tr><th>الخدمة</th><th>العملية</th><th>عدد الطلبات</th><th>الوحدات المسجلة</th><th>الفشل</th></tr></thead><tbody>{data.usage.map((u, i) => <tr key={i}><td>{u.provider}</td><td>{u.operation}</td><td>{u.requests}</td><td>{u.units}</td><td>{u.failed}</td></tr>)}</tbody></table></div> : <p className="muted">لا توجد طلبات API مسجلة اليوم.</p>}
    </section>
  </div>;
}

function IconForFeedback({ type }) {
  return type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>;
}
