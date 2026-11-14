/**
 * اختبار شامل لدورة المتجر على قاعدة البيانات المحلية.
 * المتطلبات: المتجر يعمل على :3000 مع بوابة EdfaPay الوهمية (انظر tests/mock-edfapay.mjs).
 *   node tests/e2e.cjs
 */
const { chromium, devices } = require("playwright");
const pgmod = require("postgres");
const postgres = pgmod.default || pgmod;

const BASE = process.env.STORE_URL || "http://localhost:3000";
const ADMIN = { email: process.env.ADMIN_EMAIL || "admin@puff.test", password: process.env.ADMIN_PASSWORD || "PuffAdmin-2026-Test" };
const sql = postgres(process.env.DATABASE_URL || "postgres://postgres@127.0.0.1:5432/puff", { max: 1 });

let passed = 0;
const failures = [];
function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function fillCheckout(page, { phone = "0551234567", email = "buyer@example.com" } = {}) {
  await page.fill("#f-name", "عميل تجريبي");
  await page.fill("#f-phone", phone);
  await page.fill("#f-email", email);
  await page.fill("#f-city", "الرياض");
  await page.fill("#f-district", "العليا");
  await page.fill("#f-street", "شارع التحلية، مبنى 12");
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (page, label) => {
    page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${label}: ${m.text().slice(0, 200)}`);
    });
  };

  // ─────────────── 1) لوحة التحكم: دخول + تفعيل الدفع عند الاستلام + كوبون ───────────────
  console.log("\n[1] لوحة التحكم");
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await adminCtx.newPage();
  watch(admin, "admin");
  await admin.goto(`${BASE}/admin`);
  check("غير المسجّل يُحوَّل لصفحة الدخول", admin.url().includes("/admin/login"));
  await admin.fill('input[name="email"]', ADMIN.email);
  await admin.fill('input[name="password"]', "wrong-password-123");
  await admin.click('button[type="submit"]');
  await admin.waitForTimeout(1500);
  check("كلمة مرور خاطئة تُرفض", admin.url().includes("/admin/login"));
  await admin.fill('input[name="password"]', ADMIN.password);
  await admin.click('button[type="submit"]');
  await admin.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 15000 });
  check("دخول المدير", new URL(admin.url()).pathname === "/admin");
  check("لوحة المعلومات تُعرض", (await admin.locator("body").innerText()).includes("الطلبات"));

  await admin.goto(`${BASE}/admin/settings`);
  const cod = admin.locator('input[name="codEnabled"]');
  if (!(await cod.isChecked())) await cod.check();
  await admin.fill('input[name="codFee"]', "10");
  await cod.locator("xpath=ancestor::form").locator('button[type="submit"]').click();
  await admin.waitForTimeout(1800);
  const st = (await sql`select value from settings where key='store'`)[0].value;
  check("حفظ إعدادات الدفع (COD مفعّل برسوم 10 ر.س)", st.codEnabled === true && st.codFee === 1000, JSON.stringify(st));

  await sql`delete from coupons where code = 'TEST20'`;
  await admin.goto(`${BASE}/admin/coupons`);
  const couponForm = admin.locator("form").filter({ has: admin.locator('input[name="code"]') }).first();
  await couponForm.locator('input[name="code"]').fill("test20");
  await couponForm.locator('select[name="type"]').selectOption("percent");
  await couponForm.locator('input[name="value"]').fill("20");
  await couponForm.locator('button[type="submit"]').click();
  await admin.waitForTimeout(1800);
  const cp = await sql`select * from coupons where code = 'TEST20'`;
  check("إنشاء كوبون TEST20 (20%)", cp.length === 1 && cp[0].type === "percent" && cp[0].value === 20);

  // مخزون محدود لمنتج واحد عبر الإجراء الجماعي في اللوحة (لاختبار الخصم من المخزون)
  const straw = (await sql`select v.id from variants v join products p on p.id=v.product_id where p.slug='flippy-straws'`)[0];
  const setStock = async (value) => {
    await admin.goto(`${BASE}/admin/products?q=${encodeURIComponent("ماصات")}`);
    await admin.locator('input[name="ids"]').first().check();
    if (value === null) await admin.getByRole("button", { name: "اجعل المخزون غير محدود" }).click();
    else {
      await admin.fill('input[name="stock"]', String(value));
      await admin.getByRole("button", { name: "تعيين الكمية" }).click();
    }
    await admin.waitForTimeout(1800);
  };
  await setStock(3);
  check("ضبط المخزون من اللوحة (3 حبات)", (await sql`select stock from variants where id = ${straw.id}`)[0].stock === 3);

  // ─────────────── 2) المتجر (جوال): تصفح ← سلة ← كوبون ← دفع عند الاستلام ───────────────
  console.log("\n[2] المتجر — جوال: شراء بالدفع عند الاستلام");
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  const m = await mobile.newPage();
  watch(m, "mobile");
  await m.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await m.waitForTimeout(2800);
  check("الرئيسية: كلمة PUFF العملاقة ظاهرة", await m.locator(".hero-word").isVisible());
  check("لا يوجد تمرير أفقي على الجوال", await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await m.goto(`${BASE}/shop`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1200);
  const cards = await m.locator("article").count();
  check("المتجر يعرض المنتجات", cards >= 12, `(${cards})`);

  // منتج بمتغيرات: اختيار لون ثم إضافة
  await m.goto(`${BASE}/p/sippy-350`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1500);
  const swatches = m.locator('fieldset button[aria-pressed]');
  check("صفحة المنتج: 25 لونًا", (await swatches.count()) === 25, `(${await swatches.count()})`);
  await swatches.nth(4).click();
  await m.waitForTimeout(700);
  check("تغيير اللون يحدّث الرابط", m.url().includes("?v="));
  await m.getByRole("button", { name: /أضف إلى السلة/ }).first().click();
  await m.waitForTimeout(1600);
  check("السلة الجانبية تفتح بعد الإضافة", await m.getByRole("dialog", { name: "سلة المشتريات" }).isVisible());
  await m.getByRole("button", { name: "إغلاق السلة" }).click();
  await m.waitForTimeout(800);

  // منتج محدود المخزون (3 حبات) × 2
  await m.goto(`${BASE}/p/flippy-straws`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1200);
  await m.getByRole("button", { name: "زيادة الكمية" }).first().click();
  await m.getByRole("button", { name: /أضف إلى السلة/ }).first().click();
  await m.waitForTimeout(1500);

  await m.goto(`${BASE}/cart`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1500);
  check("صفحة السلة: بندان", (await m.locator("ul.divide-y > li").count()) === 2);
  await m.fill('input[aria-label="كود الخصم"]', "nope");
  await m.getByRole("button", { name: "تطبيق" }).click();
  await m.waitForTimeout(1500);
  check("كوبون خاطئ يُرفض برسالة", (await m.locator("body").innerText()).includes("الكوبون غير صحيح"));
  await m.fill('input[aria-label="كود الخصم"]', "test20");
  await m.getByRole("button", { name: "تطبيق" }).click();
  await m.waitForTimeout(1500);
  check("كوبون TEST20 يُطبَّق", (await m.locator("body").innerText()).includes("خصم 20%"));

  await m.goto(`${BASE}/checkout`, { waitUntil: "networkidle" });
  await m.waitForTimeout(2000);
  // التحقق من الحقول
  await m.locator('button[type="submit"]').last().click();
  await m.waitForTimeout(1500);
  check("التحقق من الحقول: رسالة خطأ عند ترك البيانات فارغة", (await m.locator('[role="alert"]').count()) > 0);
  await fillCheckout(m);
  await m.locator('input[name="payment"]').last().check(); // الدفع عند الاستلام
  await m.waitForTimeout(1500);
  const bodyBefore = await m.locator("aside").innerText();
  check("رسوم الدفع عند الاستلام تظهر في الملخص", bodyBefore.includes("رسوم الدفع عند الاستلام"));
  // 146 + 2×20 = 186 ، خصم 20% = 37.2 ، شحن 25 ، COD 10 → 183.80
  check("الإجمالي محسوب صحيحًا (183.80)", bodyBefore.includes("183.80"), bodyBefore.replace(/\s+/g, " ").slice(-200));
  await m.locator('button[type="submit"]').last().click();
  await m.waitForURL(/\/order\/PF\d+/, { timeout: 20000 });
  await m.waitForTimeout(2500);
  const codNumber = m.url().match(/PF\d+/)[0];
  const codOrder = (await sql`select * from orders where number = ${codNumber}`)[0];
  check(`إنشاء الطلب ${codNumber} في قاعدة البيانات`, !!codOrder);
  check("إجمالي الطلب في القاعدة 18380 هللة", codOrder.total === 18380, String(codOrder.total));
  check("خصم الكوبون 3720 والشحن 2500 ورسوم COD 1000", codOrder.discount === 3720 && codOrder.shipping === 2500 && codOrder.cod_fee === 1000);
  check("الجوال مخزَّن بصيغة موحدة", codOrder.customer_phone === "966551234567");
  const strawStock = (await sql`select stock from variants where id = ${straw.id}`)[0].stock;
  check("المخزون المحدود نقص من 3 إلى 1", strawStock === 1, String(strawStock));
  check("عدّاد الكوبون زاد", (await sql`select used_count from coupons where code='TEST20'`)[0].used_count === 1);
  check("صفحة الطلب تعرض الشكر ورقم الطلب", (await m.locator("body").innerText()).includes(codNumber));
  check("السلة فُرّغت بعد الطلب", await m.evaluate(() => JSON.parse(localStorage.getItem("puff-cart-v1")).state.items.length === 0));
  check("الطلب بدون الرمز السري غير متاح (404)", (await m.request.get(`${BASE}/order/${codNumber}`)).status() === 404);

  // تجاوز المخزون: بقي 1 فقط
  await m.goto(`${BASE}/p/flippy-straws`, { waitUntil: "networkidle" });
  await m.waitForTimeout(1200);
  check("تنبيه «بقي 1 فقط» للمخزون المنخفض", (await m.locator("body").innerText()).includes("بقي"));

  // ─────────────── 3) تتبع الطلب ───────────────
  console.log("\n[3] تتبع الطلب");
  await m.goto(`${BASE}/track`, { waitUntil: "networkidle" });
  await m.fill("#t-number", codNumber);
  await m.fill("#t-phone", "0559999999");
  await m.getByRole("button", { name: "تتبّع الطلب" }).click();
  await m.waitForTimeout(1500);
  check("التتبع برقم جوال خاطئ يُرفض", (await m.locator("body").innerText()).includes("لم نجد طلبًا"));
  await m.fill("#t-number", codNumber.replace("PF", ""));
  await m.fill("#t-phone", "+966 55 123 4567");
  await m.getByRole("button", { name: "تتبّع الطلب" }).click();
  await m.waitForURL(/\/order\/PF\d+\?t=/, { timeout: 15000 });
  check("التتبع بالبيانات الصحيحة يفتح صفحة الطلب", true);

  // ─────────────── 4) لوحة التحكم: إدارة الطلب والشحن ───────────────
  console.log("\n[4] اللوحة: إدارة الطلب");
  await admin.goto(`${BASE}/admin/orders`);
  check("الطلب يظهر في قائمة الطلبات", (await admin.locator("body").innerText()).includes(codNumber));
  await admin.goto(`${BASE}/admin/orders/${codOrder.id}`);
  await admin.waitForTimeout(800);
  const track = admin.locator("form").filter({ has: admin.locator('input[name="carrier"]') }).first();
  await track.locator('input[name="carrier"]').fill("SMSA");
  await track.locator('input[name="number"]').fill("SMSA123456789");
  await track.locator('button[type="submit"]').first().click();
  let after;
  for (let i = 0; i < 12; i++) {
    await admin.waitForTimeout(700);
    after = (await sql`select status, tracking_number from orders where id = ${codOrder.id}`)[0];
    if (after.tracking_number) break;
  }
  check("حفظ رقم التتبع من اللوحة", after.tracking_number === "SMSA123456789", JSON.stringify(after));
  await m.reload({ waitUntil: "networkidle" });
  check("رقم التتبع يظهر للعميل في صفحة الطلب", (await m.locator("body").innerText()).includes("SMSA123456789"));

  // ─────────────── 5) سطح المكتب: الدفع الإلكتروني (EdfaPay وهمي) ───────────────
  console.log("\n[5] سطح المكتب: دفع إلكتروني عبر EdfaPay");
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desk.newPage();
  watch(d, "desktop");
  await d.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await d.waitForTimeout(3000);
  // انتقال الصفحات عبر الستارة
  await d.locator('header nav a[href="/shop"]').click();
  await d.waitForURL(/\/shop/, { timeout: 15000 });
  await d.waitForTimeout(1500);
  check("انتقال الصفحات (الستارة) يعمل", new URL(d.url()).pathname === "/shop");
  // بحث
  await d.getByRole("button", { name: "بحث" }).click();
  await d.waitForTimeout(600);
  await d.fill('input[aria-label="ابحث في المتجر"]', "بيبي بلو");
  await d.waitForTimeout(1600);
  const hits = await d.locator('[role="dialog"][aria-label="البحث"] li').count();
  check("البحث الفوري يعيد نتائج", hits > 0, `(${hits})`);
  await d.keyboard.press("Escape");
  await d.waitForTimeout(700);

  await d.goto(`${BASE}/p/coffee-450-03`, { waitUntil: "networkidle" });
  await d.waitForTimeout(1200);
  await d.getByRole("button", { name: "اشترِ الآن" }).click();
  await d.waitForURL(/\/checkout/, { timeout: 15000 });
  await d.waitForTimeout(2200);
  await fillCheckout(d, { phone: "0567654321", email: "card@example.com" });
  await d.locator('input[name="payment"]').first().check(); // دفع إلكتروني
  await d.waitForTimeout(1200);
  await d.locator('button[type="submit"]').last().click();
  await d.waitForURL(/127\.0\.0\.1:4010\/pay\/checkout/, { timeout: 20000 });
  check("التحويل إلى صفحة الدفع المستضافة", true);
  const pending = (await sql`select * from orders order by id desc limit 1`)[0];
  check("الطلب محفوظ «غير مدفوع» قبل الدفع", pending.payment_status === "unpaid" && pending.payment_method === "edfapay");
  // رفض ثم إعادة محاولة ثم قبول
  await d.click("#decline");
  await d.waitForURL(/\/checkout\/return/, { timeout: 15000 });
  await d.waitForTimeout(2500);
  check("صفحة فشل الدفع تظهر", (await d.locator("body").innerText()).includes("لم تكتمل عملية الدفع"));
  check("حالة الدفع «failed» بعد الرفض", (await sql`select payment_status from orders where id=${pending.id}`)[0].payment_status === "failed");
  await d.getByRole("button", { name: /إعادة محاولة الدفع/ }).click();
  await d.waitForURL(/127\.0\.0\.1:4010\/pay\/checkout/, { timeout: 20000 });
  await d.click("#approve");
  await d.waitForURL(/\/order\/PF\d+/, { timeout: 25000 });
  await d.waitForTimeout(2000);
  const paid = (await sql`select * from orders where id=${pending.id}`)[0];
  check("الـ webhook أكّد الدفع: الحالة «paid» والطلب «processing»", paid.payment_status === "paid" && paid.status === "processing", JSON.stringify([paid.payment_status, paid.status]));
  check("معرّف عملية البوابة محفوظ", !!paid.gateway_transaction_id);
  check("الإجمالي 188 + 25 شحن = 213 ر.س", paid.total === 21300, String(paid.total));

  // webhook مزوّر (توقيع خاطئ) ومبلغ غير مطابق
  const forged = await d.request.post(`${BASE}/api/webhooks/edfapay`, {
    headers: { "content-type": "application/json", "x-edfapay-signature": "deadbeef" },
    data: { transactionId: "x", orderId: `${codNumber}-1`, amount: 1, status: "Approved", type: "Purchase" },
  });
  check("webhook بتوقيع مزوّر يُرفض (401)", forged.status() === 401);
  check("الطلب COD لم يتأثر بالـ webhook المزوّر", (await sql`select payment_status from orders where number=${codNumber}`)[0].payment_status === "unpaid");

  // ─────────────── 6) حساب العميل ───────────────
  console.log("\n[6] حساب العميل");
  const email = `u${Date.now()}@example.com`;
  await d.goto(`${BASE}/account/register`, { waitUntil: "networkidle" });
  await d.fill("#a-name", "سارة التجريبية");
  await d.fill("#a-phone", `053${String(Date.now()).slice(-7)}`);
  await d.fill("#a-email", email);
  await d.fill("#a-password", "secret-pass-123");
  await d.getByRole("button", { name: "إنشاء الحساب" }).click();
  await d.waitForURL(/\/account$/, { timeout: 15000 });
  check("إنشاء حساب عميل والدخول", (await d.locator("body").innerText()).includes("طلباتي"));
  await d.getByRole("button", { name: "تسجيل الخروج" }).click();
  await d.waitForURL(`${BASE}/`, { timeout: 15000 });
  await d.goto(`${BASE}/account/login`, { waitUntil: "networkidle" });
  await d.fill("#a-email", email);
  await d.fill("#a-password", "bad-password");
  await d.getByRole("button", { name: "تسجيل الدخول" }).click();
  await d.waitForTimeout(1500);
  check("دخول بكلمة مرور خاطئة يُرفض", (await d.locator("body").innerText()).includes("غير صحيحة"));
  check("البريد يبقى في الحقل بعد الخطأ", (await d.inputValue("#a-email")) === email);
  await d.fill("#a-password", "secret-pass-123");
  await d.getByRole("button", { name: "تسجيل الدخول" }).click();
  await d.waitForURL(/\/account$/, { timeout: 15000 });
  check("دخول العميل", true);

  // ─────────────── 7) الإلغاء يعيد المخزون ───────────────
  console.log("\n[7] إلغاء الطلب من اللوحة");
  await admin.goto(`${BASE}/admin/orders/${codOrder.id}`);
  await admin.waitForTimeout(600);
  admin.on("dialog", (dlg) => dlg.accept());
  const cancelBtn = admin.getByRole("button", { name: /إلغاء الطلب/ }).first();
  if (await cancelBtn.count()) {
    await cancelBtn.click();
    await admin.waitForTimeout(800);
    const confirm = admin.getByRole("button", { name: /تأكيد|نعم/ }).first();
    if (await confirm.count()) await confirm.click().catch(() => {});
    await admin.waitForTimeout(2000);
  }
  const cancelled = (await sql`select status from orders where id=${codOrder.id}`)[0].status;
  check("إلغاء الطلب من اللوحة", cancelled === "cancelled", cancelled);
  check("المخزون عاد إلى 3 بعد الإلغاء", (await sql`select stock from variants where id=${straw.id}`)[0].stock === 3);
  check("عدّاد الكوبون عاد إلى 0", (await sql`select used_count from coupons where code='TEST20'`)[0].used_count === 0);

  // إعادة المخزون غير محدود من اللوحة
  await setStock(null);
  check("إعادة المخزون «غير محدود» من اللوحة", (await sql`select stock from variants where id = ${straw.id}`)[0].stock === null);

  console.log(`\n${passed} ناجح، ${failures.length} فاشل`);
  if (failures.length) console.log("الفاشلة:\n - " + failures.join("\n - "));
  if (errors.length) console.log("أخطاء المتصفح:\n - " + [...new Set(errors)].slice(0, 15).join("\n - "));
  await browser.close();
  await sql.end();
  process.exit(failures.length ? 1 : 0);
})().catch(async (e) => {
  console.error("TEST CRASH", e);
  await sql.end();
  process.exit(2);
});
