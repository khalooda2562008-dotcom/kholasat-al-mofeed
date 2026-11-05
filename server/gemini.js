import { logUsage } from './db.js';
import { createHash } from 'node:crypto';
import { getApiSecret } from './secrets.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
let modelCache = { model: '', at: 0, keyHash: '' };

async function listModels() {
  const key = getApiSecret('gemini');
  if (!key) throw new Error('أضف GEMINI_API_KEY في متغيرات البيئة لتفعيل جيمناوي.');
  const response = await fetch(`${BASE}/models?key=${encodeURIComponent(key)}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || 'تعذر جلب قائمة موديلات Gemini.');
  return body.models || [];
}

export async function chooseModel(force = false) {
  const key = getApiSecret('gemini');
  if (!key) throw new Error('أضف مفتاح Gemini من لوحة المالك أو من متغيرات البيئة.');
  const keyHash = createHash('sha256').update(key).digest('hex').slice(0, 16);
  if (!force && modelCache.model && modelCache.keyHash === keyHash && Date.now() - modelCache.at < 30 * 60 * 1000) return modelCache.model;
  const models = await listModels();
  const usable = models.filter(m => (m.supportedGenerationMethods || []).includes('generateContent'));
  const configured = process.env.GEMINI_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL;
  const byName = name => usable.find(m => m.name === (name?.startsWith('models/') ? name : `models/${name}`));
  let selected = byName(configured);
  if (!selected) selected = usable.filter(m => /flash/i.test(m.name) && !/(preview|experimental|exp)/i.test(m.name)).sort((a,b) => b.name.localeCompare(a.name))[0];
  if (!selected) selected = byName(fallback) || usable.find(m => !/(preview|experimental|exp)/i.test(m.name));
  if (!selected) throw new Error('لم يتم العثور على موديل مستقر يدعم generateContent في هذا المفتاح.');
  modelCache = { model: selected.name.replace(/^models\//, ''), at: Date.now(), keyHash };
  return modelCache.model;
}

export async function generateContent(prompt, options = {}) {
  const key = getApiSecret('gemini');
  if (!key) throw new Error('جيمناوي غير مفعّل: أضف GEMINI_API_KEY إلى Secrets.');
  const model = options.model || await chooseModel();
  const call = async name => {
    const response = await fetch(`${BASE}/models/${name}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 1800 }
      })
    });
    const body = await response.json().catch(() => ({}));
    logUsage('gemini', 'generate_content', Number(body.usageMetadata?.totalTokenCount || 0), response.ok ? 'success' : 'failed');
    if (!response.ok) throw new Error(body?.error?.message || `فشل Gemini (${response.status})`);
    const text = (body.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
    if (!text) throw new Error('لم يرجع Gemini نصًا صالحًا.');
    return { text, model: name, usage: body.usageMetadata || null };
  };
  try { return await call(model); }
  catch (firstError) {
    const fallback = process.env.GEMINI_FALLBACK_MODEL?.replace(/^models\//, '');
    if (fallback && fallback !== model) return call(fallback);
    throw firstError;
  }
}
