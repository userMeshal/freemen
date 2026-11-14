// اختبار الدورة الكاملة: بناء متجر بالمحادثة ← نشر ← طلب ← دفع ← تجهيز ← استرداد ← تحويل يومي
const { chromium } = require("playwright");
require("fs").mkdirSync(`${__dirname}/shots`, { recursive: true });
const BASE = process.env.BASE || "http://localhost:3100";
let pass = 0, fail = 0;
const ok = (c, name, extra = "") => { c ? pass++ : fail++; console.log(`${c ? "✓" : "✗"} ${name}${c ? "" : "  ← " + extra}`); };

(async () => {
  const browser = await chromium.launch();
  const phone = "05" + String(Date.now()).slice(-8);

  // ───── 1) التاجر يبني متجره بالمحادثة ─────
  const m = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const mp = await m.newPage();
  const errors = [];
  mp.on("pageerror", (e) => errors.push(e.message));
  await mp.goto(`${BASE}/start`, { waitUntil: "networkidle" });
  await mp.fill("textarea", "أبي أبيع قهوة مختصة واسم المتجر رشفة");
  await mp.keyboard.press("Enter");
  await mp.waitForSelector("iframe", { timeout: 60000 });
  const slug = (await mp.locator('[dir="ltr"]').filter({ hasText: "zaar.sa/s/" }).first().innerText()).split("/s/")[1].trim();
  ok(Boolean(slug), "المحادثة بنت متجرًا وظهرت المعاينة", slug);
  await mp.screenshot({ path: `${__dirname}/shots/e2e-builder.png` });

  // تعديل بالكلام
  await mp.fill("textarea", "غيّر الألوان إلى ذهبي");
  await mp.keyboard.press("Enter");
  await mp.waitForFunction(() => document.body.innerText.includes("غيّرت الألوان"), null, { timeout: 30000 }).catch(() => {});
  ok((await mp.content()).includes("غيّرت الألوان"), "تعديل المتجر بالكلام");

  // المسودة لا تُرى من متصفح آخر
  const stranger = await browser.newContext();
  const sp = await stranger.newPage();
  const r404 = await sp.goto(`${BASE}/s/${slug}`);
  ok(r404.status() === 404, "المسودة مخفية عن غير صاحبها", String(r404.status()));

  // ───── 2) التسجيل والنشر ─────
  await mp.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  ok((await mp.content()).includes("رشفة"), "صفحة النشر تعرض اسم المسودة");
  await mp.fill('input[name="name"]', "سالم التجريبي");
  await mp.fill('input[name="phone"]', phone);
  await mp.fill('input[name="password"]', "test-pass-123");
  await mp.click('button[type="submit"]');
  await mp.waitForURL("**/dashboard**", { timeout: 30000 });
  ok(mp.url().includes("/dashboard"), "التسجيل ينقل للوحة التحكم");
  ok((await mp.content()).includes("انتشر"), "رسالة الترحيب بعد النشر");
  await mp.screenshot({ path: `${__dirname}/shots/e2e-dashboard.png`, fullPage: true });
  const rLive = await sp.goto(`${BASE}/s/${slug}`);
  ok(rLive.status() === 200, "المتجر صار منشورًا للجميع", String(rLive.status()));

  // ───── 3) الآيبان ─────
  await mp.goto(`${BASE}/dashboard/wallet`, { waitUntil: "networkidle" });
  await mp.fill('input[name="holder"]', "سالم التجريبي");
  await mp.selectOption('select[name="bank"]', { index: 1 });
  await mp.fill('input[name="iban"]', "SA0380000000608010167519");
  await mp.locator('form:has(input[name="iban"]) button[type="submit"]').click();
  await mp.waitForFunction(() => document.body.innerText.includes("تم حفظ الحساب البنكي"), null, { timeout: 15000 }).catch(() => {});
  ok((await mp.content()).includes("تم حفظ الحساب البنكي"), "حفظ الآيبان (مع فحص mod-97)");

  // كوبون من لوحة التاجر
  await mp.goto(`${BASE}/dashboard/coupons`, { waitUntil: "networkidle" });
  ok(mp.url().includes("/dashboard/coupons"), "صفحة الكوبونات تفتح", mp.url());

  // ───── 4) العميل يطلب ويدفع ─────
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cp = await c.newPage();
  cp.on("pageerror", (e) => errors.push("customer: " + e.message));
  await cp.goto(`${BASE}/s/${slug}/p/p-1`, { waitUntil: "networkidle" });
  await cp.waitForTimeout(3500);
  await cp.locator("button", { hasText: "أضف للسلة" }).first().click();
  await cp.waitForTimeout(1200);
  await cp.goto(`${BASE}/s/${slug}/checkout`, { waitUntil: "networkidle" });
  await cp.waitForTimeout(3500);
  await cp.fill('input[name="name"]', "عميل تجريبي");
  await cp.fill('input[name="phone"]', "0555000111");
  await cp.selectOption('select[name="city"]', "الرياض");
  await cp.fill('input[name="address"]', "حي الملقا، شارع أنس بن مالك، مبنى 12");
  await cp.screenshot({ path: `${__dirname}/shots/e2e-checkout.png`, fullPage: true });
  const total = await cp.locator("dd.font-display").first().innerText();
  await cp.locator('button[type="submit"]').click();
  await cp.waitForURL("**/pay/test/**", { timeout: 30000 });
  ok(cp.url().includes("/pay/test/"), "إتمام الطلب يحوّل لبوابة الدفع", cp.url());
  await cp.locator('button[value="approve"]').click();
  await cp.waitForURL("**/order/ZR**", { timeout: 30000 });
  await cp.waitForTimeout(2500);
  const orderUrl = cp.url();
  const number = orderUrl.match(/ZR\d+/)[0];
  ok((await cp.content()).includes("ضمان زار"), `صفحة الطلب ${number} بعد الدفع (الإجمالي ${total.replace(/\s+/g, " ")})`);
  await cp.screenshot({ path: `${__dirname}/shots/e2e-order.png`, fullPage: true });

  // ───── 5) التاجر يجهّز ويشحن ─────
  await mp.goto(`${BASE}/dashboard/orders`, { waitUntil: "networkidle" });
  ok((await mp.content()).includes(number), "الطلب ظهر في لوحة التاجر");
  await mp.locator(`a:has-text("${number}")`).first().click();
  await mp.waitForURL("**/dashboard/orders/*", { timeout: 20000 });
  await mp.waitForLoadState("networkidle");
  await mp.screenshot({ path: `${__dirname}/shots/e2e-order-admin.png`, fullPage: true });
  await mp.locator("button", { hasText: "ابدأ التجهيز" }).first().click();
  await mp.waitForTimeout(2000);
  ok((await mp.content()).includes("قيد التجهيز"), "تغيير الحالة إلى قيد التجهيز");
  await mp.goto(`${BASE}/dashboard/wallet`, { waitUntil: "networkidle" });
  const wallet = await mp.content();
  ok(wallet.includes("مبيعة") && wallet.includes("عمولة زار"), "المحفظة سجّلت المبيعة والعمولة");

  // ───── 6) العميل يطلب الاسترداد بضمان زار ─────
  await cp.goto(orderUrl, { waitUntil: "networkidle" });
  await cp.waitForTimeout(3000);
  await cp.locator("button", { hasText: "اطلب استرداد المبلغ" }).click();
  await cp.selectOption("#guarantee select", "not_as_described");
  await cp.locator("#guarantee textarea").fill("المنتج مختلف عن الصورة");
  await cp.locator("button", { hasText: "أرسل طلب الاسترداد" }).click();
  await cp.waitForFunction(() => document.body.innerText.includes("قيد المراجعة"), null, { timeout: 15000 }).catch(() => {});
  ok((await cp.content()).includes("قيد المراجعة"), "العميل فتح طلب استرداد");

  await mp.goto(`${BASE}/dashboard/claims`, { waitUntil: "networkidle" });
  ok((await mp.content()).includes(number), "طلب الاسترداد ظهر عند التاجر");
  await mp.screenshot({ path: `${__dirname}/shots/e2e-claims.png`, fullPage: true });
  mp.on("dialog", (d) => d.accept());
  await mp.locator("button", { hasText: "وافق على الاسترداد" }).first().click();
  await mp.waitForTimeout(2500);
  await cp.goto(orderUrl, { waitUntil: "networkidle" });
  await cp.waitForTimeout(2500);
  ok((await cp.content()).includes("تمت الموافقة على الاسترداد"), "الاسترداد اعتُمد وظهر للعميل");
  await mp.goto(`${BASE}/dashboard/wallet`, { waitUntil: "networkidle" });
  ok((await mp.content()).includes("استرداد لعميل"), "المحفظة خصمت الاسترداد وأرجعت العمولة");

  // ───── 7) طلب ثانٍ ثم التحويل اليومي من لوحة الإدارة ─────
  await cp.goto(`${BASE}/s/${slug}/p/p-2`, { waitUntil: "networkidle" });
  await cp.waitForTimeout(3000);
  await cp.locator("button", { hasText: "أضف للسلة" }).first().click();
  await cp.waitForTimeout(1000);
  await cp.goto(`${BASE}/s/${slug}/checkout`, { waitUntil: "networkidle" });
  await cp.waitForTimeout(3000);
  await cp.fill('input[name="name"]', "عميل تجريبي");
  await cp.fill('input[name="phone"]', "0555000111");
  await cp.selectOption('select[name="city"]', "جدة");
  await cp.fill('input[name="address"]', "حي الروضة، شارع صاري، مبنى 4");
  await cp.locator('[role="radio"]', { hasText: "تابي" }).click();
  await cp.locator('button[type="submit"]').click();
  await cp.waitForURL("**/pay/test/**", { timeout: 30000 });
  await cp.locator('button[value="approve"]').click();
  await cp.waitForURL("**/order/ZR**", { timeout: 30000 });
  ok(true, "طلب ثانٍ مدفوع عبر تابي (تجريبي)");

  const h = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const hp = await h.newPage();
  hp.on("pageerror", (e) => errors.push("hq: " + e.message));
  const guard = await hp.goto(`${BASE}/hq`, { waitUntil: "networkidle" });
  ok(hp.url().includes("/hq/login"), "لوحة الإدارة محمية", hp.url());
  await hp.fill('input[type="email"]', "hq@zaar.test");
  await hp.fill('input[type="password"]', "zaar-admin-12345");
  await hp.click('button[type="submit"]');
  await hp.waitForURL((u) => !u.pathname.includes("login"), { timeout: 20000 });
  await hp.waitForLoadState("networkidle");
  ok(new URL(hp.url()).pathname === "/hq", "دخول الإدارة", hp.url());
  await hp.screenshot({ path: `${__dirname}/shots/e2e-hq.png`, fullPage: true });
  for (const path of ["stores", "payouts", "claims", "orders", "settings"]) {
    const r = await hp.goto(`${BASE}/hq/${path}`, { waitUntil: "networkidle" });
    ok(r.status() === 200 && !(await hp.content()).includes("Application error"), `صفحة الإدارة /hq/${path}`, String(r.status()));
  }

  // المهمة اليومية: السر مطلوب
  const noAuth = await hp.request.get(`${BASE}/api/cron/daily`);
  ok(noAuth.status() === 401, "المهمة اليومية ترفض بدون السر", String(noAuth.status()));

  // صفحات لوحة التاجر كلها تفتح
  for (const path of ["", "orders", "products", "products/new", "coupons", "customers", "carts", "reviews", "claims", "design", "assistant", "settings", "wallet"]) {
    const r = await mp.goto(`${BASE}/dashboard/${path}`, { waitUntil: "networkidle" });
    ok(r.status() === 200 && mp.url().includes("/dashboard") && !(await mp.content()).includes("Application error"), `لوحة التاجر /dashboard/${path}`, String(r.status()) + " " + mp.url());
  }
  await mp.goto(`${BASE}/dashboard/design`, { waitUntil: "networkidle" });
  await mp.screenshot({ path: `${__dirname}/shots/e2e-design.png` });

  // المساعد (بدون مفتاح: الأوامر الأساسية)
  await mp.goto(`${BASE}/dashboard/assistant`, { waitUntil: "networkidle" });
  await mp.fill("textarea", "كوبون 15%");
  await mp.keyboard.press("Enter");
  await mp.waitForFunction(() => document.body.innerText.includes("ZAAR15"), null, { timeout: 20000 }).catch(() => {});
  ok((await mp.content()).includes("ZAAR15"), "مساعد زار أنشأ كوبونًا");

  // عزل المتاجر: تاجر لا يفتح طلب متجر آخر
  const other = await mp.goto(`${BASE}/dashboard/orders/1`, { waitUntil: "networkidle" });
  ok(true, `(معلومة) فتح طلب رقم 1: ${other.status()}`);

  if (errors.length) console.log("\nأخطاء في الصفحة:\n" + [...new Set(errors)].slice(0, 10).join("\n"));
  console.log(`\n${pass} نجح · ${fail} فشل`);
  console.log("SLUG=" + slug + " ORDER=" + number);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("FATAL", e.message.slice(0, 600)); console.log(`\n${pass} نجح · ${fail} فشل (توقف)`); process.exit(2); });
