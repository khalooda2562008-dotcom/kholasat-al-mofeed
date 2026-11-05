import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('واجهة لوحة المالك تعرض إدارة مفاتيح YouTube وGemini', () => {
  const source = read('src/pages/Admin.jsx');
  assert.match(source, /YouTube Data API v3/);
  assert.match(source, /Google Gemini API/);
  assert.match(source, /اختبار الاتصال/);
});

test('الخادم يخزن المفاتيح بتشفير موثق ولا يعيد القيمة الكاملة', () => {
  const source = read('server/secrets.js');
  assert.match(source, /aes-256-gcm/);
  assert.match(source, /last_four/);
  assert.match(source, /getApiSecretMeta/);
});

test('عمليات إدارة مفاتيح API محمية بجلسة المالك', () => {
  const source = read('server/index.js');
  assert.match(source, /app\.get\('\/api\/admin\/integrations',\s*requireAdmin/);
  assert.match(source, /app\.put\('\/api\/admin\/integrations\/:provider',\s*requireAdmin/);
  assert.match(source, /app\.delete\('\/api\/admin\/integrations\/:provider',\s*requireAdmin/);
});

test('ملفات الأسرار وقاعدة البيانات مستثناة من Git', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^data\/\*\.sqlite$/m);
});

test('صفحة الإعدادات توفر مدخلًا واضحًا لإعدادات مفاتيح API', () => {
  const source = read('src/pages/Settings.jsx');
  assert.match(source, /ربط خدمات المنصة/);
  assert.match(source, /to=\"\/admin\"/);
});
