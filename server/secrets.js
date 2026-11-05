import crypto from 'node:crypto';
import { db } from './db.js';

// API keys are encrypted at rest. Keep SESSION_SECRET / ADMIN_SESSION_SECRET stable;
// changing it makes previously stored encrypted keys unreadable.
db.exec(`
  CREATE TABLE IF NOT EXISTS api_secrets (
    provider TEXT PRIMARY KEY,
    cipher_text TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    last_four TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const ENV_NAMES = {
  youtube: 'YOUTUBE_API_KEY',
  gemini: 'GEMINI_API_KEY'
};

function encryptionKey() {
  const master = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || '';
  if (master.length < 16) {
    throw new Error('لا يمكن حفظ المفاتيح بأمان. اضبط SESSION_SECRET أو ADMIN_SESSION_SECRET بقيمة طويلة وثابتة في إعدادات الخادم.');
  }
  return crypto.createHash('sha256').update(master, 'utf8').digest();
}

function decrypt(row) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.cipher_text, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function getApiSecret(provider) {
  const envName = ENV_NAMES[provider];
  if (!envName) throw new Error('نوع تكامل غير مدعوم.');
  const row = db.prepare('SELECT * FROM api_secrets WHERE provider=?').get(provider);
  if (row) return decrypt(row);
  return String(process.env[envName] || '').trim();
}

export function getApiSecretMeta(provider) {
  const envName = ENV_NAMES[provider];
  if (!envName) throw new Error('نوع تكامل غير مدعوم.');
  const row = db.prepare('SELECT last_four,updated_at FROM api_secrets WHERE provider=?').get(provider);
  if (row) {
    return { configured: true, source: 'database', masked: `••••${row.last_four}`, updatedAt: row.updated_at };
  }
  const envValue = String(process.env[envName] || '').trim();
  return envValue
    ? { configured: true, source: 'environment', masked: `••••${envValue.slice(-4)}`, updatedAt: null }
    : { configured: false, source: 'missing', masked: '', updatedAt: null };
}

export function saveApiSecret(provider, rawValue) {
  if (!ENV_NAMES[provider]) throw new Error('نوع تكامل غير مدعوم.');
  const value = String(rawValue || '').trim();
  if (value.length < 20 || value.length > 256 || /[\r\n\0]/.test(value)) {
    throw new Error('المفتاح غير صالح. تأكد من نسخه كاملًا دون مسافات أو أسطر جديدة.');
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  db.prepare(`INSERT INTO api_secrets(provider,cipher_text,iv,auth_tag,last_four,updated_at)
    VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(provider) DO UPDATE SET cipher_text=excluded.cipher_text,iv=excluded.iv,
      auth_tag=excluded.auth_tag,last_four=excluded.last_four,updated_at=CURRENT_TIMESTAMP`)
    .run(provider, encrypted.toString('base64'), iv.toString('base64'), cipher.getAuthTag().toString('base64'), value.slice(-4));
  return getApiSecretMeta(provider);
}

export function deleteStoredApiSecret(provider) {
  if (!ENV_NAMES[provider]) throw new Error('نوع تكامل غير مدعوم.');
  db.prepare('DELETE FROM api_secrets WHERE provider=?').run(provider);
  return getApiSecretMeta(provider);
}
