# خلاصة المفيد — KHOLASAT AL MOFEED

منصة عربية (Full-Stack) لتنظيم الفيديوهات التعليمية: تضيف قنواتك، تبني مكتبتك، تتابع تقدّم المشاهدة، وتستخدم **جيمناوي** (مساعد Gemini) للتلخيص والأسئلة.

[![CI](https://github.com/khalooda2562008-dotcom/kholasat-al-mofeed/actions/workflows/ci.yml/badge.svg)](https://github.com/khalooda2562008-dotcom/kholasat-al-mofeed/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

> الدليل العربي المطوّل: [`README_AR.md`](README_AR.md)

---

## المحتويات

- [نظرة عامة](#نظرة-عامة)
- [التقنيات](#التقنيات)
- [التشغيل السريع](#التشغيل-السريع)
- [متغيرات البيئة](#متغيرات-البيئة)
- [السكربتات](#السكربتات)
- [بنية المشروع](#بنية-المشروع)
- [الواجهات البرمجية](#الواجهات-البرمجية)
- [النشر](#النشر)
- [الأمان](#الأمان)
- [المساهمة](#المساهمة)
- [الترخيص](#الترخيص)

## نظرة عامة

| الميزة | الوصف |
| --- | --- |
| مكتبة شخصية | أضف قناة يوتيوب، جلب آخر فيديوهاتها، واعرضها في الرئيسية فقط (بحث YouTube الخارجي لا يلوّث مكتبتك). |
| تنظيم | مجالات، مجلدات مخصّصة، مفضلة، «المشاهدة لاحقًا»، وسجل مشاهدة. |
| متابعة التقدّم | حفظ دوري لموضع المشاهدة واستئنافه من نفس النقطة. |
| جيمناوي | تلخيص ومحادثة عبر Gemini من الخادم فقط، مع سجل محادثات. |
| المالك | لوحة إدارة محمية بـ Cookie موقّع: مقاييس، سجل استهلاك الحصص، فحص الموديل. |
| الخصوصية | تصدير بياناتك JSON وحذف الحساب من داخل التطبيق. |

## التقنيات

- **الواجهة:** React 18 + Vite 6 + React Router، CSS عربي RTL، أيقونات lucide، مشغّل YouTube IFrame الرسمي.
- **الخادم:** Node.js 20+ / Express 4، Helmet، تحديد معدل الطلبات، جدولة مزامنة عبر node-cron.
- **التخزين:** SQLite (better-sqlite3) — ملف واحد في `data/`.
- **التكاملات:** YouTube Data API v3، Gemini API (اكتشاف الموديل من الخادم).

## التشغيل السريع

```bash
git clone https://github.com/khalooda2562008-dotcom/kholasat-al-mofeed.git
cd kholasat-al-mofeed
npm install
cp .env.example .env      # ثم غيّر الأسرار وأضف مفاتيحك
npm run dev               # http://localhost:3000
```

للإنتاج:

```bash
npm run build             # يبني الواجهة إلى dist/
npm start                 # يخدم الواجهة + API من منفذ واحد
```

## متغيرات البيئة

| المتغير | مطلوب | الوصف |
| --- | --- | --- |
| `PORT` | لا | منفذ الخادم (افتراضي 3000). |
| `NODE_ENV` | لا | `production` لخدمة `dist/` مع الكاش. |
| `DATABASE_FILE` | لا | مسار ملف SQLite (افتراضي `./data/kholasat.sqlite`). يجب أن يكون على تخزين دائم عند النشر. |
| `ADMIN_PASSWORD` | للوحة المالك | كلمة مرور طويلة وفريدة؛ بدونها لوحة الإدارة معطّلة. |
| `SESSION_SECRET` | نعم | سر توقيع الجلسات. |
| `ADMIN_SESSION_SECRET` | نعم | سر مختلف لجلسة المالك. |
| `YOUTUBE_API_KEY` | للتكامل | مفتاح YouTube Data API v3. |
| `YOUTUBE_DAILY_QUOTA_BUDGET` | لا | حد استهلاك يومي (افتراضي 10000). |
| `GEMINI_API_KEY` | للتكامل | مفتاح Gemini. |
| `GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` | لا | تثبيت موديل أو بديله بدل الاكتشاف التلقائي. |

> لا ترفع `.env` أبدًا. المستودع يحتوي `.env.example` فقط، والكود لا يحوي أي مفاتيح.

## السكربتات

| الأمر | الوظيفة |
| --- | --- |
| `npm run dev` | خادم + واجهة Vite مع إعادة التحميل. |
| `npm run build` | بناء الواجهة للإنتاج في `dist/`. |
| `npm start` | تشغيل الخادم في وضع الإنتاج. |
| `npm run check` | فحص صياغة كل ملفات الخادم. |

## بنية المشروع

```text
.
├── server/            # Express API + قاعدة البيانات + تكامل YouTube/Gemini
│   ├── index.js       # المسارات، الأمان، تقديم dist/
│   ├── db.js          # مخطط SQLite والاستعلامات
│   ├── youtube.js     # YouTube Data API
│   ├── gemini.js      # Gemini + اكتشاف الموديل
│   └── auth.js        # كوكي المالك الموقّع
├── src/               # React
│   ├── pages/         # الرئيسية، الاستكشاف، المجالات، القنوات، الفيديو، جيمناوي…
│   ├── components/    # Layout، VideoCard
│   ├── api.js         # عميل fetch موحّد
│   └── styles.css
├── public/assets/     # الشعار
├── data/              # ملف SQLite (غير مُتتبَّع في Git)
├── Dockerfile
└── .github/workflows/ci.yml
```

## الواجهات البرمجية

كل المسارات تحت `/api` وتتطلب ترويسة `x-user-id` (UUID) و`x-user-name` اختيارية:

- `GET /health`, `GET /ready` — فحص الحالة.
- `GET /bootstrap` — بيانات المستخدم والإعدادات والقنوات وآخر الفيديوهات.
- `GET /videos`, `GET /videos/:id` — مكتبة الفيديوهات وتفاصيل فيديو.
- `POST /channels/resolve`, `POST /channels`, `POST /channels/:id/sync` — إضافة قناة ومزامنتها.
- `POST /videos/:id/favorite`, `POST /videos/:id/watch-later`, `POST /watch-progress`.
- `GET /library/:type`, `GET /folders`, `POST /folders` … — التنظيم.
- `GET /search`, `GET /search/youtube` — بحث داخلي وخارجي منفصل.
- `POST /ai/chat`, `POST /ai/summarize`, `GET /ai/history` — جيمناوي.
- `POST /export`, `DELETE /account` — الخصوصية.
- `/admin/*` — لوحة المالك (تسجيل دخول، مقاييس، فحص موديل).

## النشر

GitHub يستضيف الكود فقط؛ التطبيق يحتاج عملية Node.js وتخزينًا دائمًا لملف SQLite.

**Docker (أي منصة):**

```bash
docker build -t kholasat .
docker run -p 3000:3000 --env-file .env -v kholasat-data:/app/data kholasat
```

**Render / Railway / Fly.io:** أنشئ خدمة Web، أمر البناء `npm install && npm run build`، أمر التشغيل `npm start`، أضف متغيرات البيئة، واربط قرصًا دائمًا على `/app/data`. ثم أضف رابط النشر إلى `APP_URL`.

## الأمان

- كل الأسرار من متغيرات البيئة، ولا شيء منها في المستودع.
- Helmet + تحديد معدل الطلبات + كوكي موقّع للوحة المالك + تحقق من المدخلات.
- الإبلاغ عن ثغرة: راجع [`SECURITY.md`](SECURITY.md).

## المساهمة

اقرأ [`CONTRIBUTING.md`](CONTRIBUTING.md). سجل التغييرات في [`CHANGELOG.md`](CHANGELOG.md).

## الترخيص

[MIT](LICENSE) © 2026 khalooda2562008-dotcom
