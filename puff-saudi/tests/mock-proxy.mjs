/**
 * وسيط HTTP بسيط للاختبار المحلي فقط (المنفذ 4012) — يحاكي خدمة «عنوان IP ثابت».
 * يدعم CONNECT (أنفاق HTTPS/HTTP) ويتحقق من اسم المستخدم وكلمة المرور: proxyuser / proxypass
 * العدّاد: GET http://127.0.0.1:4012/__count
 */
import http from "node:http";
import net from "node:net";

let count = 0;
const AUTH = "Basic " + Buffer.from("proxyuser:proxypass").toString("base64");

const server = http.createServer((req, res) => {
  if (req.url === "/__count") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ count }));
  }
  // طلب HTTP عادي عبر الوسيط (العنوان كامل في سطر الطلب) — يُستخدم مع البوابة الوهمية المحلية (http)
  if (!/^http:\/\//.test(req.url)) {
    res.writeHead(400);
    return res.end("proxy requests only");
  }
  if (req.headers["proxy-authorization"] !== AUTH) {
    res.writeHead(407);
    return res.end();
  }
  const target = new URL(req.url);
  const headers = { ...req.headers, host: target.host };
  delete headers["proxy-authorization"];
  delete headers["proxy-connection"];
  const up = http.request({ host: target.hostname, port: target.port || 80, path: target.pathname + target.search, method: req.method, headers }, (r) => {
    count++;
    console.log("[mock-proxy] HTTP", req.method, target.pathname);
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(up);
});
server.on("connect", (req, client, head) => {
  if (req.headers["proxy-authorization"] !== AUTH) {
    client.write("HTTP/1.1 407 Proxy Authentication Required\r\n\r\n");
    return client.destroy();
  }
  const [host, port] = req.url.split(":");
  const upstream = net.connect(Number(port) || 443, host, () => {
    count++;
    console.log("[mock-proxy] CONNECT", req.url);
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head.length) upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on("error", () => client.destroy());
  client.on("error", () => upstream.destroy());
});
server.listen(4012, () => console.log("[mock-proxy] on :4012"));
