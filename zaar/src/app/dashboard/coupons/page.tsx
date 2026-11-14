import { desc, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { db } from "@/db";
import { coupons, type Coupon } from "@/db/schema";
import { ActionButton } from "@/components/dash/client";
import { CouponForm } from "@/components/dash/merchant/CouponForm";
import { Badge, Card, Empty, Money, PageHead, TableWrap, fmtDate } from "@/components/dash/ui";
import { requireMerchantStore } from "@/lib/auth";
import { deleteCoupon, toggleCoupon } from "./actions";

export const metadata = { title: "الكوبونات" };

function state(c: Coupon): { label: string; tone: "good" | "neutral" | "warn" } {
  if (!c.active) return { label: "موقوف", tone: "neutral" };
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return { label: "منتهي", tone: "warn" };
  if (c.maxUses !== null && c.used >= c.maxUses) return { label: "استُنفد", tone: "warn" };
  return { label: "فعّال", tone: "good" };
}

export default async function CouponsPage() {
  const { store } = await requireMerchantStore();
  const list = await db.select().from(coupons).where(eq(coupons.storeId, store.id)).orderBy(desc(coupons.createdAt), desc(coupons.id));

  return (
    <>
      <PageHead title="الكوبونات" sub="أنشئ أكواد خصم يكتبها العميل في صفحة الدفع: نسبة، مبلغ ثابت، أو شحن مجاني." />

      <Card title="كوبون جديد" className="mb-6">
        <CouponForm />
      </Card>

      {list.length === 0 ? (
        <Empty title="ما عندك كوبونات للحين" text="أنشئ أول كوبون وشاركه مع عملائك في السناب أو الواتساب." />
      ) : (
        <TableWrap>
          <table className="dash-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>الخصم</th>
                <th>الحد الأدنى</th>
                <th>الاستخدام</th>
                <th>ينتهي</th>
                <th>الحالة</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const st = state(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="num font-display font-bold tracking-wide">{c.code}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      {c.type === "percent" ? (
                        <span>
                          <span className="num font-semibold">{c.value}%</span> خصم
                        </span>
                      ) : c.type === "fixed" ? (
                        <span>
                          <Money value={c.value} /> خصم
                        </span>
                      ) : (
                        "شحن مجاني"
                      )}
                    </td>
                    <td>{c.minSubtotal > 0 ? <Money value={c.minSubtotal} /> : <span className="text-ink/45">—</span>}</td>
                    <td className="whitespace-nowrap">
                      <span className="num font-semibold">{c.used}</span>
                      <span className="text-ink/50">
                        {" "}
                        / {c.maxUses === null ? "بدون حد" : <span className="num">{c.maxUses}</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-ink/65">{c.expiresAt ? fmtDate(c.expiresAt) : "—"}</td>
                    <td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <ActionButton action={toggleCoupon} fields={{ id: c.id }}>
                          {c.active ? "إيقاف" : "تفعيل"}
                        </ActionButton>
                        <ActionButton action={deleteCoupon} fields={{ id: c.id }} className="dash-btn dash-btn-danger dash-btn-sm" confirm={`تحذف الكوبون ${c.code} نهائيًا؟`}>
                          <Trash2 size={14} /> حذف
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
