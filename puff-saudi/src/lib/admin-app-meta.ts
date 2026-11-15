import type { Metadata } from "next";

/** يجعل لوحة التحكم قابلة للإضافة إلى الشاشة الرئيسية كتطبيق مستقل باسم «PUFF طلبات» */
export const ADMIN_APP_META: Pick<Metadata, "manifest" | "appleWebApp" | "icons"> = {
  manifest: "/admin-app.webmanifest",
  appleWebApp: { capable: true, title: "PUFF طلبات", statusBarStyle: "default" },
  icons: { apple: "/admin-icon-180.png" },
};
