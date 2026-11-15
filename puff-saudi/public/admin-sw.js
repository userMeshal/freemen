/* PUFF SAUDI — إشعارات الطلبات للوحة التحكم. لا يعترض أي طلبات شبكة؛ يعرض الإشعار ويفتح الطلب عند الضغط عليه. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  // يجب عرض إشعار دائمًا: آيفون يلغي الاشتراك إن وصلت رسائل بلا إشعار ظاهر
  event.waitUntil(
    self.registration.showNotification(data.title || "PUFF SAUDI", {
      body: data.body || "",
      icon: "/admin-icon-192.png",
      badge: "/admin-badge.png",
      tag: data.tag,
      dir: "rtl",
      lang: "ar",
      data: { url: data.url || "/admin/orders" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/admin/orders", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).pathname.startsWith("/admin")) {
          await client.focus().catch(() => {});
          if ("navigate" in client) await client.navigate(target).catch(() => self.clients.openWindow(target));
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
