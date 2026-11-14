import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payouts, stores } from "@/db/schema";
import { getHq } from "@/lib/auth";
import { riyadhDay } from "@/lib/platform";

export const dynamic = "force-dynamic";

/**
 * تحييد حقن الصيغ في Excel/Sheets: الخلية التي تبدأ بـ = + - @ (أو tab / سطر جديد)
 * تُسبق بفاصلة عليا فتُقرأ نصًّا. ثم تُحاط بعلامتي تنصيص مع مضاعفة ما بداخلها.
 */
function cell(value: string | number): string {
  let s = String(value ?? "").replace(/\r?\n|\r/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** ملف التحويلات المعلّقة لفريق المالية (يُفتح في Excel مباشرة بفضل BOM) */
export async function GET() {
  if (!(await getHq())) {
    return new Response("غير مصرّح", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const rows = await db
    .select({
      id: payouts.id,
      store: stores.name,
      holder: payouts.bankHolder,
      bank: payouts.bankName,
      iban: payouts.iban,
      amount: payouts.amount,
      day: payouts.day,
    })
    .from(payouts)
    .innerJoin(stores, eq(stores.id, payouts.storeId))
    .where(eq(payouts.status, "pending"))
    .orderBy(asc(payouts.id));

  const header = ["رقم التحويل", "المتجر", "صاحب الحساب", "البنك", "الآيبان", "المبلغ (ر.س)", "يوم التسوية"];
  const lines = [
    header.map(cell).join(","),
    ...rows.map((r) => [cell(r.id), cell(r.store), cell(r.holder), cell(r.bank), cell(r.iban), cell((r.amount / 100).toFixed(2)), cell(r.day)].join(",")),
  ];

  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="zaar-payouts-${riyadhDay()}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
