import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم — PUFF SAUDI", template: "%s — لوحة تحكم PUFF" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <AdminShell adminName={admin.name} adminEmail={admin.email} logoutAction={logoutAction}>
      {children}
    </AdminShell>
  );
}
