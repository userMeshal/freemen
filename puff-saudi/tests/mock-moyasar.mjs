/**
 * بوابة ميسر (Moyasar) وهمية للاختبار المحلي فقط — تحاكي: Payment Intents، إتمام الدفع، صفحة 3DS،
 * جلب العملية، وإدارة الـ webhooks مع رمز التفعيل.
 *
 *   node tests/mock-moyasar.mjs            (المنفذ 4011)
 *   MOYASAR_PUBLISHABLE_KEY=pk_test_mock MOYASAR_SECRET_KEY=sk_test_mock \
 *   MOYASAR_BASE_URL=http://127.0.0.1:4011/v1 npm run dev
 *
 * نموذج ميسر في المتصفح يتصل دائمًا بـ https://api.moyasar.com ، لذلك يحوّل الاختبار (tests/e2e.cjs)
 * طلبات المتصفح إلى هذا الخادم عبر اعتراض الشبكة في Playwright.
 *
 * البطاقات: أي رقم ينتهي بـ 0002 يُرفض، وغيره يُقبل.
 */
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const PORT = 4011;
const SECRET_KEY = "sk_test_mock";
const PUBLISHABLE_KEY = "pk_test_mock";

function authSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  try {
    return /^AUTH_SECRET=(.*)$/m.exec(readFileSync(".env.local", "utf8"))?.[1]?.replace(/^"|"$/g, "") ?? "";
  } catch {
    return "";
  }
}
// نفس اشتقاق السر في src/lib/moyasar.ts
const webhookSecret = () =>
  process.env.MOYASAR_WEBHOOK_SECRET || createHmac("sha256", authSecret()).update("moyasar-webhook-v1").digest("hex").slice(0, 40);

const intents = new Map();
const payments = new Map();
const webhooks = new Map();

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, accept",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json", ...CORS });
  res.end(JSON.stringify(body));
};
const basicUser = (req) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return null;
  return Buffer.from(h.slice(6), "base64").toString().split(":")[0];
};
const readBody = async (req) => {
  let raw = "";
  for await (const c of req) raw += c;
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
};
async function notify(type, data) {
  for (const w of webhooks.values()) {
    if (type !== "webhook_verification" && !w.verified) continue;
    if (type === "webhook_verification" && data.webhook_id !== w.id) continue;
    const body = JSON.stringify({
      id: randomUUID(),
      type,
      created_at: new Date().toISOString(),
      secret_token: w.shared_secret,
      account_name: "Mock",
      live: false,
      data,
    });
    const r = await fetch(w.url, { method: "POST", headers: { "content-type": "application/json" }, body }).catch((e) => ({ status: String(e) }));
    console.log(`[mock-moyasar] webhook ${type} → ${r.status}`);
  }
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const path = url.pathname;
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      return res.end();
    }

    // ───── Payment Intents ─────
    if (req.method === "POST" && path === "/v1/payment_intents") {
      if (basicUser(req) !== SECRET_KEY) return json(res, 403, { type: "authorization_error", message: "secret key required" });
      const b = await readBody(req);
      if (!Number.isInteger(b.amount) || b.amount < 100) return json(res, 400, { type: "validation_error", message: "amount" });
      const intent = {
        id: randomUUID(),
        amount: b.amount,
        currency: b.currency || "SAR",
        description: b.description || null,
        callback_url: b.callback_url || null,
        status: "created",
        client_secret: `pi_secret_${randomUUID().replace(/-/g, "")}`,
        expires_at: new Date(Date.now() + 3600e3).toISOString(),
      };
      intents.set(intent.id, intent);
      console.log("[mock-moyasar] intent", intent.description, intent.amount);
      return json(res, 201, intent);
    }
    const fulfill = /^\/v1\/payment_intents\/([^/]+)\/fulfill$/.exec(path);
    if (req.method === "POST" && fulfill) {
      const intent = intents.get(fulfill[1]);
      const b = await readBody(req);
      // النموذج الرسمي يرسل المفتاح العام داخل الجسم (publishable_api_key)؛ الـ API يقبله أيضًا كـ Basic Auth
      if ((basicUser(req) || b.publishable_api_key) !== PUBLISHABLE_KEY) {
        return json(res, 403, { type: "authorization_error", message: "publishable key required" });
      }
      if (!intent) return json(res, 404, { type: "record_not_found", message: "no such intent" });
      if (b.client_secret !== intent.client_secret) return json(res, 400, { type: "invalid_client_secret", message: "bad client secret" });
      if (intent.status !== "created") return json(res, 400, { type: "intent_not_fulfillable", message: "already used" });
      intent.status = "fulfilled";
      const number = String(b.source?.number || "").replace(/\s/g, "");
      const payment = {
        id: randomUUID(),
        status: "initiated",
        amount: intent.amount, // المبلغ من الـ intent دائمًا مهما أرسل المتصفح
        currency: intent.currency,
        description: intent.description,
        callback_url: intent.callback_url,
        amount_format: `${(intent.amount / 100).toFixed(2)} SAR`,
        source: { type: "creditcard", company: "mada", name: b.source?.name, number: `XXXX-XXXX-XXXX-${number.slice(-4)}`, message: null, transaction_url: null },
        _willFail: number.endsWith("0002"),
      };
      payment.source.transaction_url = `http://127.0.0.1:${PORT}/3ds?pid=${payment.id}`;
      payments.set(payment.id, payment);
      const { _willFail, ...pub } = payment;
      return json(res, 201, pub);
    }

    // ───── صفحة التحقق البنكي (3DS) ─────
    if (req.method === "GET" && path === "/3ds") {
      const p = payments.get(url.searchParams.get("pid"));
      if (!p) return json(res, 404, { message: "no payment" });
      p.status = p._willFail ? "failed" : "paid";
      p.source.message = p._willFail ? "DECLINED" : "APPROVED";
      const { _willFail, ...pub } = p;
      if (url.searchParams.get("silent") !== "1") await notify(p._willFail ? "payment_failed" : "payment_paid", pub);
      const back = new URL(p.callback_url);
      back.searchParams.set("id", p.id);
      back.searchParams.set("status", p.status);
      back.searchParams.set("message", p.source.message);
      // abandon=1 يحاكي عميلًا أغلق المتصفح بعد الدفع ولم يعد للموقع
      if (url.searchParams.get("abandon") === "1") return json(res, 200, { abandoned: true });
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }

    // ───── Payments ─────
    const pay = /^\/v1\/payments\/([^/]+)$/.exec(path);
    if (req.method === "GET" && pay) {
      if (basicUser(req) !== SECRET_KEY) return json(res, 403, { type: "authorization_error", message: "secret key required" });
      const p = payments.get(pay[1]);
      if (!p) return json(res, 404, { type: "record_not_found", message: "no such payment" });
      const { _willFail, ...pub } = p;
      return json(res, 200, pub);
    }

    // ───── Webhooks ─────
    if (path === "/v1/webhooks" && basicUser(req) === SECRET_KEY) {
      if (req.method === "GET") return json(res, 200, { webhooks: [...webhooks.values()].map(({ shared_secret, code, ...w }) => w) });
      if (req.method === "POST") {
        const b = await readBody(req);
        const w = { id: randomUUID(), url: b.url, http_method: "post", events: b.events || [], shared_secret: b.shared_secret, verified: false, code: "482913" };
        webhooks.set(w.id, w);
        setTimeout(() => notify("webhook_verification", { webhook_id: w.id, verification_code: w.code }), 150);
        const { shared_secret, code, ...pub } = w;
        return json(res, 201, pub);
      }
    }
    const verify = /^\/v1\/webhooks\/([^/]+)\/(verify|resend_verification)$/.exec(path);
    if (req.method === "POST" && verify && basicUser(req) === SECRET_KEY) {
      const w = webhooks.get(verify[1]);
      if (!w) return json(res, 404, { type: "record_not_found" });
      if (verify[2] === "resend_verification") {
        setTimeout(() => notify("webhook_verification", { webhook_id: w.id, verification_code: w.code }), 150);
        return json(res, 200, { message: "sent" });
      }
      const b = await readBody(req);
      if (b.code !== w.code) return json(res, 400, { type: "invalid_code" });
      w.verified = true;
      console.log("[mock-moyasar] webhook verified");
      const { shared_secret, code, ...pub } = w;
      return json(res, 200, pub);
    }

    json(res, 404, { type: "not_found", message: `${req.method} ${path}` });
  })
  .listen(PORT, () => console.log(`[mock-moyasar] on :${PORT}`));
