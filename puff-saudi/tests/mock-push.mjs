/**
 * خدمة إشعارات (Web Push) وهمية للاختبار المحلي فقط — تستقبل ما يرسله المتجر لأجهزة التاجر.
 *
 *   node tests/mock-push.mjs            (المنفذ 4014)
 *
 * POST /push/<device> يحفظ الترويسات والمحتوى المشفّر ، وأي مسار فيه "gone" يرد 410 (اشتراك ملغى).
 * GET /__received يعرض ما وصل (المحتوى base64) ليفكّه الاختبار بمفتاح الجهاز.
 */
import http from "node:http";

const PORT = 4014;
const received = [];

http
  .createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (req.url === "/__received") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(received));
      }
      if (req.method === "POST" && req.url.startsWith("/push/")) {
        if (req.url.includes("gone")) {
          res.writeHead(410);
          return res.end();
        }
        received.push({ path: req.url, headers: req.headers, body: Buffer.concat(chunks).toString("base64") });
        res.writeHead(201);
        return res.end();
      }
      res.writeHead(404);
      res.end();
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock push on :${PORT}`));
