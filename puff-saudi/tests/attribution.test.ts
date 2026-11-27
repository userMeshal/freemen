/**
 * فحص كشف مصدر الطلب (lib/attribution.ts):  npx tsx tests/attribution.test.ts
 */
import assert from "node:assert/strict";
import { cleanAttribution, detectAttribution, sourceText } from "../src/lib/attribution";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const d = (url: string, referrer = "", userAgent = IPHONE) => detectAttribution({ url: `https://puffsa.com${url}`, referrer, userAgent, ownHost: "puffsa.com" });

// معرّفات النقرات
assert.deepEqual([d("/p/a?ttclid=abc").platform, d("/p/a?ttclid=abc").paid, d("/p/a?ttclid=abc").via], ["tiktok", true, "click_id"]);
assert.equal(d("/?ScCid=xyz").platform, "snapchat");
assert.equal(d("/?gclid=1").platform, "google");
assert.equal(d("/?gbraid=1").paid, true);
assert.equal(d("/?twclid=1").platform, "x");
assert.equal(d("/?epik=1").platform, "pinterest");
// fbclid يأتي مع المنشورات العادية أيضًا: المنصة ميتا لكن «إعلان» فقط إن قال UTM ذلك
assert.deepEqual([d("/?fbclid=1").platform, d("/?fbclid=1").paid], ["meta", false]);
assert.equal(d("/?fbclid=1&utm_medium=paid_social").paid, true);
// معرّف النقرة أقوى من UTM المتعارض
assert.equal(d("/?ttclid=1&utm_source=facebook").platform, "tiktok");

// UTM
const utm = d("/shop?utm_source=Snapchat&utm_medium=cpc&utm_campaign=white-friday&utm_content=video1");
assert.deepEqual([utm.platform, utm.paid, utm.via, utm.campaign, utm.content, utm.landing], ["snapchat", true, "utm", "white-friday", "video1", "/shop"]);
assert.deepEqual([d("/?utm_source=ig&utm_medium=bio").platform, d("/?utm_source=ig&utm_medium=bio").paid], ["meta", false]);
assert.deepEqual([d("/?utm_source=newsletter").platform, d("/?utm_source=newsletter").source], ["other", "newsletter"]);
// «ads» كلمة مستقلة فقط
assert.equal(d("/?utm_source=x&utm_medium=broadcast").paid, false);

// متصفح التطبيق بلا أي معاملات
assert.deepEqual([d("/", "", IPHONE + " musical_ly_38.0.0 BytedanceWebview").platform, d("/", "", IPHONE + " musical_ly_38.0.0").via], ["tiktok", "app"]);
assert.equal(d("/", "", IPHONE + " Instagram 350.0.0").platform, "meta");
assert.equal(d("/", "", IPHONE + " Snapchat/13.0").platform, "snapchat");

// الموقع المُحيل
assert.deepEqual([d("/", "https://www.google.com.sa/").platform, d("/", "https://www.google.com.sa/").paid], ["google", false]);
assert.equal(d("/", "https://l.instagram.com/?u=x").platform, "meta");
assert.equal(d("/", "https://t.co/abc").platform, "x");
assert.deepEqual([d("/", "https://example.org/blog").platform, d("/", "https://example.org/blog").referrer], ["other", "example.org"]);
// التنقل داخل المتجر نفسه ليس مصدرًا
assert.equal(d("/cart", "https://puffsa.com/shop").platform, "direct");
assert.equal(d("/").platform, "direct");

// التنظيف على الخادم
assert.equal(cleanAttribution({ platform: "hacker" }), null);
assert.equal(cleanAttribution("tiktok"), null);
const cleaned = cleanAttribution({ platform: "tiktok", paid: "yes", via: "zzz", campaign: "<script>x</script>" + "a".repeat(300), landing: "https://evil.example", extra: 1, at: "not-a-date" });
assert.deepEqual([cleaned?.paid, cleaned?.via, cleaned?.landing, cleaned?.at, "extra" in (cleaned ?? {})], [false, "none", undefined, undefined, false]);
assert.ok(cleaned?.campaign && !/[<>]/.test(cleaned.campaign) && cleaned.campaign.length <= 120);

assert.equal(sourceText({ platform: "tiktok", paid: true }, true), "تيك توك · إعلان");
assert.equal(sourceText(null), "غير معروف");
console.log("✓ attribution: كل الفحوص نجحت");
