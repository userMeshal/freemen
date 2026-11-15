import "server-only";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { siteUrl } from "@/lib/settings";

/**
 * إشعارات الطلبات على جوال التاجر مباشرة (Web Push) — بلا تطبيق خارجي ولا حساب.
 *
 * التاجر يضيف لوحة التحكم إلى الشاشة الرئيسية ويضغط «تفعيل الإشعارات»؛ المتصفح يعطينا اشتراكًا
 * (endpoint + مفاتيح تشفير) نحفظه هنا، ثم نرسل له رسالة مشفّرة عند كل طلب مؤكَّد.
 *
 * مفاتيح VAPID تُولَّد تلقائيًا عند أول استخدام وتُحفظ مع الأجهزة في صف مستقل (settings.key = "webpush")
 * لا تقرؤه الواجهة. المفتاح العام فقط يُرسَل للمتصفح.
 */

const KEY = "webpush";
const MAX_DEVICES = 20;

export type PushDevice = { id: string; endpoint: string; keys: { p256dh: string; auth: string }; label: string; addedAt: string };
type PushConfig = { publicKey: string; privateKey: string; devices: PushDevice[] };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

async function load(): Promise<PushConfig | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  const v = rows[0]?.value as Partial<PushConfig> | undefined;
  if (!v?.publicKey || !v.privateKey) return null;
  return { publicKey: v.publicKey, privateKey: v.privateKey, devices: Array.isArray(v.devices) ? v.devices : [] };
}

/** يقرأ الإعداد وينشئ مفاتيح VAPID إن لم توجد (آمن لو تزامن طلبان: الأول يفوز والثاني يقرأ نتيجته) */
async function readPush(): Promise<PushConfig> {
  const existing = await load();
  if (existing) return existing;
  const keys = webpush.generateVAPIDKeys();
  const fresh: PushConfig = { publicKey: keys.publicKey, privateKey: keys.privateKey, devices: [] };
  await db.insert(settings).values({ key: KEY, value: fresh }).onConflictDoNothing();
  return (await load()) ?? fresh;
}

async function write(config: PushConfig) {
  await db.insert(settings).values({ key: KEY, value: config }).onConflictDoUpdate({ target: settings.key, set: { value: config } });
}

export const pushDeviceId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 24);

/** ما تحتاجه صفحة الإعدادات: المفتاح العام وقائمة الأجهزة بلا أسرارها */
export async function pushOverview(): Promise<{ publicKey: string; devices: { id: string; label: string; addedAt: string }[] }> {
  const c = await readPush();
  return { publicKey: c.publicKey, devices: c.devices.map((d) => ({ id: d.id, label: d.label, addedAt: d.addedAt })) };
}

/** نقبل عناوين خدمات الإشعارات المعروفة فقط، حتى لا يُستعمل الإرسال للاتصال بعناوين أخرى */
function endpointAllowed(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol === "https:") {
    return /(^|\.)(fcm\.googleapis\.com|push\.apple\.com|push\.services\.mozilla\.com|notify\.windows\.com)$/.test(url.hostname);
  }
  // للاختبار المحلي فقط: خادم إشعارات وهمي عندما يعمل المتجر نفسه على localhost
  return url.protocol === "http:" && url.hostname === "127.0.0.1" && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(siteUrl());
}

export class PushError extends Error {}

export async function addPushDevice(sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }, label: string): Promise<string> {
  const endpoint = typeof sub.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub.keys?.auth === "string" ? sub.keys.auth : "";
  const b64url = /^[A-Za-z0-9_-]+=*$/;
  if (endpoint.length > 1000 || !endpointAllowed(endpoint) || !b64url.test(p256dh) || !b64url.test(auth) || p256dh.length > 200 || auth.length > 100) {
    throw new PushError("تعذّر تسجيل هذا الجهاز للإشعارات");
  }
  const config = await readPush();
  const id = pushDeviceId(endpoint);
  const others = config.devices.filter((d) => d.id !== id);
  if (others.length >= MAX_DEVICES) throw new PushError(`الحد الأقصى ${MAX_DEVICES} جهازًا — أزل جهازًا قديمًا أولًا`);
  const device: PushDevice = { id, endpoint, keys: { p256dh, auth }, label: label.slice(0, 60) || "جهاز", addedAt: new Date().toISOString() };
  await write({ ...config, devices: [...others, device] });
  return id;
}

export async function removePushDevice(id: string) {
  const config = await readPush();
  if (config.devices.some((d) => d.id === id)) await write({ ...config, devices: config.devices.filter((d) => d.id !== id) });
}

/** يرسل الإشعار لكل الأجهزة. يحذف الأجهزة التي ألغت اشتراكها. يرجع عدد من وصلهم. */
export async function sendPush(payload: PushPayload): Promise<number> {
  const config = await readPush();
  if (!config.devices.length) return 0;
  const site = siteUrl();
  const vapidDetails = {
    // أبل ترفض subject غير صالح؛ رابط المتجر (https) مقبول، ومحليًا نستعمل قيمة شكلية
    subject: site.startsWith("https://") ? site : "mailto:store@localhost.test",
    publicKey: config.publicKey,
    privateKey: config.privateKey,
  };
  const body = JSON.stringify(payload);
  const gone: string[] = [];
  const results = await Promise.all(
    config.devices.map(async (d) => {
      try {
        const req = webpush.generateRequestDetails({ endpoint: d.endpoint, keys: d.keys }, body, { vapidDetails, TTL: 60 * 60 * 24, urgency: "high" });
        const res = await fetch(req.endpoint, {
          method: req.method,
          headers: req.headers as Record<string, string>,
          body: req.body ? new Uint8Array(req.body) : undefined,
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        if (res.status === 404 || res.status === 410) gone.push(d.id);
        else if (!res.ok) console.error("[push] delivery refused", res.status, new URL(d.endpoint).hostname);
        return res.ok;
      } catch (e) {
        console.error("[push] delivery failed", e);
        return false;
      }
    }),
  );
  if (gone.length) {
    const latest = await readPush();
    await write({ ...latest, devices: latest.devices.filter((d) => !gone.includes(d.id)) });
  }
  return results.filter(Boolean).length;
}
