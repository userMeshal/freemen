/**
 * بوابة EdfaPay وهمية للاختبار المحلي فقط — تحاكي: initiate، صفحة الدفع، الـ webhook الموقّع، و Status API.
 * التشغيل:  node tests/mock-edfapay.mjs   (المنفذ 4010)
 * ثم شغّل المتجر بـ:
 *   EDFAPAY_API_KEY=test-key EDFAPAY_BASE_URL=http://127.0.0.1:4010/api/v1 EDFAPAY_WEBHOOK_SECRET=whsec_test npm run dev
 */
import http from "node:http";
import { createHmac, randomUUID } from "node:crypto";

const PORT = 4010;
const STORE = process.env.STORE_URL || "http://localhost:3000";
const SECRET = process.env.EDFAPAY_WEBHOOK_SECRET || "whsec_test";
const sessions = new Map();
const transactions = new Map();

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === "POST" && url.pathname === "/api/v1/payment-gateway/initiate") {
      if (req.headers["x-api-key"] !== "test-key") return json(res, 401, { code: 401, message: "Unauthorized" });
      let body = "";
      for await (const c of req) body += c;
      const data = JSON.parse(body);
      const sessionId = randomUUID();
      sessions.set(sessionId, data);
      console.log("[mock] initiate", data.orderId, data.amount);
      return json(res, 200, { code: 200, message: "Success", errorCode: null, data: { redirectUrl: `http://127.0.0.1:${PORT}/pay/checkout?sessionId=${sessionId}` } });
    }
    if (req.method === "GET" && url.pathname === "/pay/checkout") {
      const s = sessions.get(url.searchParams.get("sessionId"));
      if (!s) return json(res, 404, { message: "no session" });
      const result = url.searchParams.get("result");
      if (!result) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(`<h1>Mock EdfaPay</h1><p>${s.orderId} — ${s.amount} SAR</p>
          <a id="approve" href="${url.pathname}?sessionId=${url.searchParams.get("sessionId")}&result=approve">Approve</a> |
          <a id="decline" href="${url.pathname}?sessionId=${url.searchParams.get("sessionId")}&result=decline">Decline</a>`);
      }
      const approved = result === "approve";
      const transactionId = randomUUID();
      const tx = {
        transactionId,
        orderId: s.orderId,
        amount: Number(s.amount).toFixed(2),
        currencyCode: "682",
        transactionStatus: approved ? "SUCCESS" : "FAILED",
        paymentStatus: approved ? "APPROVED" : "DECLINED",
        transactionType: "PURCHASE",
      };
      transactions.set(transactionId, tx);
      const payload = JSON.stringify({
        transactionId,
        orderId: s.orderId,
        amount: Number(s.amount),
        currencyCode: "682",
        cardScheme: "mada",
        status: approved ? "Approved" : "Declined",
        channel: "Payment Gateway",
        type: "Purchase",
        pgDetails: { reason: approved ? null : "Payment declined" },
      });
      const signature = createHmac("sha256", SECRET).update(payload).digest("hex");
      const hook = await fetch(`${STORE}/api/webhooks/edfapay`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-edfapay-signature": signature },
        body: payload,
      });
      console.log("[mock] webhook", s.orderId, approved ? "approved" : "declined", "→", hook.status);
      res.writeHead(302, { location: approved ? s.successUrl : s.failureUrl });
      return res.end();
    }
    if (req.method === "GET" && url.pathname === "/api/v1/transactions/filterTransaction") {
      const tx = transactions.get(url.searchParams.get("id"));
      return json(res, 200, { code: 200, message: "Success", data: { content: tx ? [tx] : [] } });
    }
    json(res, 404, { message: "not found" });
  })
  .listen(PORT, () => console.log(`[mock] EdfaPay mock on :${PORT}`));
