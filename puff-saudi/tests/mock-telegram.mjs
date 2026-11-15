/**
 * خادم تيليجرام وهمي للاختبار المحلي فقط — يحاكي Bot API: getMe / deleteWebhook / getUpdates / sendMessage.
 *
 *   node tests/mock-telegram.mjs            (المنفذ 4013)
 *   TELEGRAM_BASE_URL=http://127.0.0.1:4013 npm run dev
 *
 * للاختبار: POST /__push {text, chat} يضيف رسالة واردة للبوت ، GET /__sent يعرض ما أرسله المتجر.
 */
import http from "node:http";

const PORT = 4013;
export const TOKEN = "123456789:AAmockTokenForLocalTestsOnly_0123456789";
let nextUpdate = 1;
let updates = [];
const sent = [];

const read = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const body = await read(req);
    if (url.pathname === "/__push") {
      updates.push({ update_id: nextUpdate++, message: { text: body.text, chat: body.chat } });
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/__sent") return json(res, 200, sent);
    const m = /^\/bot([^/]+)\/(\w+)$/.exec(url.pathname);
    if (!m) return json(res, 404, { ok: false, description: "Not Found" });
    if (m[1] !== TOKEN) return json(res, 401, { ok: false, error_code: 401, description: "Unauthorized" });
    switch (m[2]) {
      case "getMe":
        return json(res, 200, { ok: true, result: { id: 123456789, is_bot: true, username: "puff_test_bot" } });
      case "deleteWebhook":
        return json(res, 200, { ok: true, result: true });
      case "getUpdates":
        if (typeof body.offset === "number") updates = updates.filter((u) => u.update_id >= body.offset);
        return json(res, 200, { ok: true, result: updates.slice(0, body.limit ?? 100) });
      case "sendMessage":
        sent.push({ chat_id: body.chat_id, text: body.text, parse_mode: body.parse_mode ?? null });
        return json(res, 200, { ok: true, result: { message_id: sent.length } });
      default:
        return json(res, 404, { ok: false, description: "Method not found" });
    }
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock telegram on :${PORT}`));
