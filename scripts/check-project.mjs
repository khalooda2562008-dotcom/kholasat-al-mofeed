import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'package.json', '.env.example', 'index.html', 'vite.config.js',
  'server/index.js', 'server/db.js', 'server/auth.js', 'server/secrets.js',
  'server/youtube.js', 'server/gemini.js', 'src/App.jsx', 'src/api.js',
  'src/pages/Admin.jsx', 'src/pages/admin-integrations.css', 'src/styles.css',
  'README_AR.md'
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('ملفات أساسية مفقودة:', missing.join(', '));
  process.exit(1);
}
const admin = fs.readFileSync(path.join(root, 'src/pages/Admin.jsx'), 'utf8');
const secrets = fs.readFileSync(path.join(root, 'server/secrets.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server/index.js'), 'utf8');
const checks = [
  ['واجهة ربط YouTube وGemini', /youtube[\s\S]*gemini/.test(admin)],
  ['تشفير AES-256-GCM', /aes-256-gcm/.test(secrets)],
  ['مسارات إدارة المفاتيح محمية', /app\.put\('\/api\/admin\/integrations\/:provider',\s*requireAdmin/.test(server)],
  ['اختبار اتصال YouTube', /integrations\/youtube\/test/.test(server)],
  ['اختبار اتصال Gemini', /integrations\/gemini\/test/.test(server)]
];
const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failed.length) process.exit(1);
console.log(`فحص بنية المشروع نجح: ${required.length} ملفًا أساسيًا موجودة.`);
