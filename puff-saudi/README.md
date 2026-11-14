# PUFF SAUDI — المتجر الإلكتروني

متجر إلكتروني متكامل لعلامة **PUFF SAUDI** مبني بـ Next.js 15 (App Router) و TypeScript و Tailwind CSS، بقاعدة بيانات PostgreSQL ولوحة تحكم إدارية كاملة، وتكامل دفع EdfaPay.

> هذا المشروع يعيش في مجلد `puff-saudi/` داخل المستودع ولا يمسّ أي شيء خارجه. عند النشر على Vercel اضبط **Root Directory = `puff-saudi`**.

## ما الذي يحتويه

| الجزء | التفاصيل |
| --- | --- |
| الواجهة | صفحة رئيسية سينمائية (كلمة PUFF العملاقة، تثبيت بالتمرير، رحلة أفقية بين العائلات، جدار الألوان)، المتجر مع فلاتر فورية، التصنيفات، البحث الفوري، صفحة المنتج، السلة، إتمام الطلب، تتبع الطلب، حساب العميل، صفحات السياسات |
| الحركة | GSAP + ScrollTrigger للتمرير، Motion (Framer Motion) للتفاعلات والانتقالات، Lenis للتمرير الناعم (سطح المكتب فقط)، ستارة انتقال بين الصفحات، ويحترم `prefers-reduced-motion` |
| الخطوط | Unbounded + Alexandria للعناوين، IBM Plex Sans Arabic للنص، Aref Ruqaa + Instrument Serif للّمسات — كلها مستضافة محليًا في `public/fonts` |
| البيانات | 125 منتجًا و234 متغيرًا و11 تصنيفًا منقولة من `puffsaudi.cc` (في `data/catalog.json` + `public/media`) |
| الطلبات | تسعير على الخادم فقط، كوبونات (نسبة / مبلغ / شحن مجاني)، طرق شحن، مخزون (غير محدود افتراضيًا)، سجل أحداث لكل طلب، تتبع برقم الطلب + الجوال |
| الدفع | EdfaPay Hosted Checkout (مدى / Visa / Mastercard / Apple Pay بحسب تفعيل حسابك) + الدفع عند الاستلام (اختياري) |
| لوحة التحكم | `/admin` — لوحة معلومات، الطلبات، المنتجات والمتغيرات والمخزون والصور، التصنيفات، العملاء، الكوبونات، الشحن، الصفحات، الإعدادات والمدراء |
| التسويق | Meta Pixel و TikTok Pixel (PageView, ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase) |
| SEO | Metadata لكل صفحة، Open Graph، JSON-LD (Product / Organization / WebSite)، `sitemap.xml`، `robots.txt`، وتحويلات 301 من روابط المتجر القديم |
| الأمان | ترويسات أمان و CSP، جلسات JWT في كوكيز httpOnly، تجزئة كلمات المرور بـ scrypt، تحديد معدل المحاولات، تحقق zod لكل مدخل، التحقق من توقيع الـ webhook |

## التشغيل محليًا

```bash
cd puff-saudi
npm install
cp .env.example .env.local      # ثم عبّئ القيم
npm run db:setup                # ينشئ الجداول ويستورد الكتالوج وينشئ حساب المدير
npm run dev                     # http://localhost:3000  — اللوحة: /admin
```

تحتاج قاعدة PostgreSQL (محلية أو Neon / Supabase / Vercel Postgres).

## متغيرات البيئة

| المتغير | الوصف |
| --- | --- |
| `DATABASE_URL` | رابط PostgreSQL (استخدم رابط الـ pooled connection في الإنتاج) |
| `AUTH_SECRET` | نص عشوائي 32 حرفًا على الأقل: `openssl rand -base64 48` |
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع النهائي بدون `/` في الآخر |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | حساب المدير الأول (كلمة المرور 10 أحرف على الأقل). يُنشأ مرة واحدة عند أول `db:seed` |
| `EDFAPAY_ENV` | `sandbox` أو `production` |
| `EDFAPAY_API_KEY` | مفتاح API من لوحة EdfaPay |
| `EDFAPAY_WEBHOOK_SECRET` | السر الذي تضعه في لوحة EdfaPay ← Configuration ← Webhook |
| `BLOB_READ_WRITE_TOKEN` | (اختياري) لرفع صور المنتجات من اللوحة عبر Vercel Blob |

## النشر على Vercel

1. من Vercel: **Add New → Project** واختر المستودع، ثم **Root Directory = `puff-saudi`**.
2. أنشئ قاعدة بيانات (Storage → Neon Postgres مثلًا) وأضف `DATABASE_URL`.
3. أضف بقية متغيرات البيئة من الجدول أعلاه.
4. Deploy. أمر البناء `vercel-build` يطبّق الترحيلات ويستورد الكتالوج تلقائيًا إن كانت القاعدة فارغة (لا يكرر ولا يمسح بيانات موجودة).
5. ادخل `/admin` بحساب المدير، ثم من **الإعدادات**: راجع بيانات المتجر، معرّفات البكسل، وطرق الدفع. ومن **الشحن**: اضبط سعر الشحن الفعلي.
6. لرفع الصور من اللوحة: Storage → Blob → Connect (يضيف `BLOB_READ_WRITE_TOKEN` تلقائيًا).

> ربط الدومين `puffsaudi.cc` بالمشروع الجديد خطوة منفصلة تتم يدويًا من Vercel → Domains عندما تقرر الانتقال. المتجر القديم لا يتأثر بأي شيء هنا.

## ربط EdfaPay

1. ضع `EDFAPAY_API_KEY` و `EDFAPAY_ENV` (ابدأ بـ `sandbox`).
2. في لوحة EdfaPay ← Configuration ← Webhook أضف الرابط الظاهر في **لوحة التحكم ← الإعدادات ← حالة ربط EdfaPay** (`https://your-domain/api/webhooks/edfapay`) واختر أحداث Transaction، وضع Webhook Secret ثم انسخه إلى `EDFAPAY_WEBHOOK_SECRET`.
3. جرّب طلبًا ببطاقات الاختبار، ثم بدّل إلى `production` بمفاتيح الإنتاج.

سير الدفع: إنشاء الطلب ← `POST /payment-gateway/initiate` ← تحويل العميل لصفحة الدفع ← EdfaPay يرسل الـ webhook ← نتحقق من التوقيع (HMAC-SHA256) ومن حالة العملية عبر Status API ومن تطابق المبلغ ← يتحول الطلب إلى «مدفوع / قيد التجهيز». طلبات الدفع الإلكتروني التي لم يكتمل دفعها خلال ساعتين تُلغى ويُعاد مخزونها (يُنفَّذ التنظيف عند وصول أي إشعار دفع أو فتح لوحة المعلومات). Apple Pay ومدى يظهران في صفحة الدفع بحسب ما هو مفعّل في حسابك لدى EdfaPay (Apple Pay لا يعمل في بيئة sandbox).

## الاختبار

```bash
node tests/mock-edfapay.mjs &                        # بوابة دفع وهمية محلية
EDFAPAY_API_KEY=test-key EDFAPAY_BASE_URL=http://127.0.0.1:4010/api/v1 \
EDFAPAY_WEBHOOK_SECRET=whsec_test npm run dev        # أو: npm run build && npm start
node tests/e2e.cjs                                   # يحتاج Playwright
```

الاختبار يغطي 53 فحصًا: دخول المدير، الإعدادات، الكوبونات، المخزون، التصفح على الجوال، السلة، حساب الإجماليات، الدفع عند الاستلام، الدفع الإلكتروني (رفض ← إعادة محاولة ← قبول)، رفض الـ webhook المزوّر، التتبع، حساب العميل، وإلغاء الطلب مع إعادة المخزون.

## بنية المشروع

```
data/catalog.json        الكتالوج المنقول من المتجر الأصلي
drizzle/                 ترحيلات قاعدة البيانات
public/media/            صور المنتجات (webp) والصور المقصوصة للعرض الافتتاحي
scripts/                 migrate.ts و seed.ts
src/db/schema.ts         مخطط القاعدة (Drizzle ORM)
src/lib/                 التسعير، الطلبات، EdfaPay، المصادقة، الإعدادات، الكتالوج
src/app/(site)/          واجهة المتجر
src/app/admin/           لوحة التحكم
src/app/api/webhooks/    webhook الدفع
src/components/home/     أقسام الصفحة الرئيسية (Hero, Manifesto, Families, ColorWall…)
src/components/site/     الهيدر، السلة، البحث، الانتقالات، بطاقة وصفحة المنتج
```

## ملاحظات عن البيانات المنقولة

- كل المبالغ مخزّنة بالهللة، والأسعار شاملة ضريبة القيمة المضافة (15% قابلة للتعديل من الإعدادات).
- مخزون كل المتغيرات **غير محدود** (`stock = null`) ويُعدَّل من اللوحة لكل متغير أو جماعيًا.
- منتج «بف سيبي — 450 مل» (متعدد الألوان): صفحته في المتجر الأصلي تعطي 404، فأُعيد تركيبه من منتجاته المفردة الـ27 بنفس السعة (نفس الأسعار والصور)، ورموز SKU لمتغيراته مولّدة (`PUFF-SIPPY-450-Vnn`).
- نصوص السياسات منقولة حرفيًا وما زالت تذكر Shopify و SUY / Suysaudi.co — عدّلها من **اللوحة ← الصفحات**.
- لإعادة استيراد الكتالوج من الصفر (يحذف المنتجات الحالية): `npm run db:seed -- --force`.
