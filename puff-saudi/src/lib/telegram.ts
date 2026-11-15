import "server-only";
import { randomBytes } from "node:crypto";
import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, settings } from "@/db/schema";
import { formatSar } from "@/lib/money";
import { displayPhone } from "@/lib/normalize";
import { siteUrl } from "@/lib/settings";

/**
 * إشعارات الطلبات على جوال التاجر عبر بوت تيليجرام.
 *
 * التاجر ينشئ بوتًا من @BotFather ويلصق رمزه في الإعدادات، ثم يفتح رابط الربط ويضغط Start.
 * الربط يتم برمز سري في الرابط (‎/start <code>‎) فلا يستطيع غريب وجد البوت أن يشترك في الإشعارات.
 *
 * رمز البوت يُحفظ في صف مستقل (settings.key = "telegram") ولا يدخل ضمن إعدادات المتجر التي تقرؤها
 * الواجهة، ولا يُعرض في أي صفحة.
 */

const BASE = () => (process.env.TELEGRAM_BASE_URL || "https://api.telegram.org").replace(/\/$/, "");
const KEY = "telegram";

export type TelegramChat = { id: number; name: string };
export type TelegramConfig = { botToken: string; botUsername: string; linkCode: string; chats: TelegramChat[] };

export class TelegramError extends Error {}

export async function readTelegram(): Promise<TelegramConfig | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, KEY)).limit(1);
  const v = rows[0]?.value as Partial<TelegramConfig> | undefined;
  if (!v?.botToken || !v.botUsername || !v.linkCode) return null;
  return { botToken: v.botToken, botUsername: v.botUsername, linkCode: v.linkCode, chats: Array.isArray(v.chats) ? v.chats : [] };
}

async function write(config: TelegramConfig) {
  await db.insert(settings).values({ key: KEY, value: config }).onConflictDoUpdate({ target: settings.key, set: { value: config } });
}

type TgResponse<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

async function call<T>(token: string, method: string, body: Record<string, unknown> = {}): Promise<T> {
  let json: TgResponse<T> | null = null;
  try {
    const res = await fetch(`${BASE()}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    json = (await res.json().catch(() => null)) as TgResponse<T> | null;
  } catch {
    throw new TelegramError("تعذّر الاتصال بتيليجرام");
  }
  if (!json?.ok || json.result === undefined) throw new TelegramError(json?.description ?? "رد غير متوقع من تيليجرام");
  return json.result;
}

export const telegramLink = (c: Pick<TelegramConfig, "botUsername" | "linkCode">, group = false) =>
  `https://t.me/${c.botUsername}?${group ? "startgroup" : "start"}=${c.linkCode}`;

/** يتحقق من رمز البوت لدى تيليجرام ويحفظه. يبقي الجوالات المربوطة إن كان البوت نفسه. */
export async function saveBotToken(token: string): Promise<TelegramConfig> {
  if (!/^\d{5,15}:[A-Za-z0-9_-]{25,}$/.test(token)) throw new TelegramError("الرمز غير صحيح — انسخه كما أعطاك إياه BotFather");
  const me = await call<{ username?: string }>(token, "getMe").catch(() => {
    throw new TelegramError("تيليجرام لم يقبل هذا الرمز — تأكد أنك نسخته كاملًا");
  });
  if (!me.username) throw new TelegramError("تعذّر قراءة اسم البوت");
  // الربط يقرأ الرسائل بـ getUpdates، وهذا لا يعمل إن كان للبوت webhook مسجّل
  await call(token, "deleteWebhook").catch(() => {});
  const current = await readTelegram();
  const same = current?.botUsername === me.username;
  const config: TelegramConfig = {
    botToken: token,
    botUsername: me.username,
    linkCode: same ? current.linkCode : randomBytes(12).toString("hex"),
    chats: same ? current.chats : [],
  };
  await write(config);
  return config;
}

type Update = {
  update_id: number;
  message?: { text?: string; chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string } };
};

/** يبحث في رسائل البوت عن ‎/start <code>‎ ويضيف أصحابها. يرجع أسماء من أُضيفوا الآن. */
export async function linkPendingChats(): Promise<string[]> {
  const config = await readTelegram();
  if (!config) throw new TelegramError("أضف رمز البوت أولًا");
  const updates = await call<Update[]>(config.botToken, "getUpdates", { limit: 100, timeout: 0, allowed_updates: ["message"] });
  const added: TelegramChat[] = [];
  for (const u of updates) {
    const m = /^\/start(?:@\w+)?\s+(\S+)/.exec(u.message?.text ?? "");
    if (!m || m[1] !== config.linkCode || !u.message) continue;
    const chat = u.message.chat;
    if (config.chats.some((c) => c.id === chat.id) || added.some((c) => c.id === chat.id)) continue;
    const name = (chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || String(chat.id)).slice(0, 60);
    added.push({ id: chat.id, name });
  }
  // نُعلِم تيليجرام أننا قرأنا هذه الرسائل حتى لا تُعاد في المرة القادمة
  if (updates.length) {
    await call(config.botToken, "getUpdates", { offset: updates[updates.length - 1].update_id + 1, limit: 1, timeout: 0 }).catch(() => {});
  }
  if (!added.length) return [];
  await write({ ...config, chats: [...config.chats, ...added] });
  await Promise.allSettled(
    added.map((c) =>
      call(config.botToken, "sendMessage", {
        chat_id: c.id,
        text: "✅ تم الربط. ستصلك هنا إشعارات الطلبات الجديدة في PUFF SAUDI.",
      }),
    ),
  );
  return added.map((c) => c.name);
}

export async function removeTelegramChat(chatId: number) {
  const config = await readTelegram();
  if (!config) return;
  await write({ ...config, chats: config.chats.filter((c) => c.id !== chatId) });
}

export async function disconnectTelegram() {
  await db.delete(settings).where(eq(settings.key, KEY));
}

/** يرسل النص لكل الجوالات المربوطة. يرجع عدد من وصلتهم الرسالة. */
async function broadcast(config: TelegramConfig, html: string): Promise<number> {
  const results = await Promise.allSettled(
    config.chats.map((c) =>
      call(config.botToken, "sendMessage", { chat_id: c.id, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
    ),
  );
  return results.filter((r) => r.status === "fulfilled").length;
}

export async function sendTelegramTest(): Promise<number> {
  const config = await readTelegram();
  if (!config?.chats.length) throw new TelegramError("لا يوجد جوال مربوط بعد");
  return broadcast(config, "🔔 <b>إشعار تجريبي</b>\nهكذا سيصلك إشعار كل طلب جديد في PUFF SAUDI.");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** إشعار «طلب جديد» — يُستدعى عند تأكيد الدفع الإلكتروني أو إنشاء طلب دفع عند الاستلام. لا يرمي أخطاء. */
export async function notifyNewOrder(orderId: number): Promise<void> {
  try {
    const config = await readTelegram();
    if (!config?.chats.length) return;
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) return;
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const lines = items.slice(0, 12).map((i) => `• ${i.qty} × ${esc(i.name)}${i.optionValue ? ` (${esc(i.optionValue)})` : ""}`);
    if (items.length > 12) lines.push(`• و${items.length - 12} منتجات أخرى`);
    const address = order.address as { city?: string } | null;
    const text = [
      `🛍 <b>طلب جديد ${esc(order.number)}</b>`,
      `المبلغ: <b>${esc(formatSar(order.total))}</b>`,
      order.paymentMethod === "cod" ? "الدفع: عند الاستلام" : "الدفع: مدفوع إلكترونيًا ✅",
      "",
      `العميل: ${esc(order.customerName)} — ${esc(displayPhone(order.customerPhone))}`,
      address?.city ? `المدينة: ${esc(address.city)}` : null,
      "",
      ...lines,
      "",
      `<a href="${siteUrl()}/admin/orders/${order.id}">فتح الطلب في لوحة التحكم</a>`,
    ]
      .filter((l) => l !== null)
      .join("\n");
    await broadcast(config, text);
  } catch (e) {
    console.error("[telegram] order notification failed", e);
  }
}

/** يرسل الإشعار بعد انتهاء الرد على العميل حتى لا يتأخر عليه شيء */
export function queueOrderNotification(orderId: number) {
  try {
    after(() => notifyNewOrder(orderId));
  } catch {
    void notifyNewOrder(orderId);
  }
}
