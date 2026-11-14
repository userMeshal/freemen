"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { createCoupon } from "@/app/dashboard/coupons/actions";
import { SafeForm, SafeSubmit } from "./SafeForm";

type CouponType = "percent" | "fixed" | "free_shipping";

export function CouponForm() {
  const [type, setType] = useState<CouponType>("percent");
  return (
    <SafeForm action={createCoupon} onSuccess={() => setType("percent")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block">
          <span className="dash-label">كود الخصم</span>
          <input name="code" className="dash-input num uppercase" dir="ltr" required minLength={3} maxLength={20} pattern="[A-Za-z0-9]{3,20}" placeholder="WELCOME10" autoComplete="off" autoCapitalize="characters" />
          <span className="mt-1.5 block text-xs text-ink/50">حروف إنجليزية وأرقام فقط، من 3 إلى 20.</span>
        </label>
        <label className="block">
          <span className="dash-label">نوع الخصم</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value as CouponType)} className="dash-input">
            <option value="percent">نسبة مئوية %</option>
            <option value="fixed">مبلغ ثابت (ر.س)</option>
            <option value="free_shipping">شحن مجاني</option>
          </select>
        </label>
        {type !== "free_shipping" && (
          <label className="block">
            <span className="dash-label">{type === "percent" ? "نسبة الخصم (1 – 90)" : "مبلغ الخصم (ر.س)"}</span>
            <input key={type} name="value" className="dash-input num" dir="ltr" required inputMode={type === "percent" ? "numeric" : "decimal"} maxLength={type === "percent" ? 2 : 10} placeholder={type === "percent" ? "10" : "25"} />
          </label>
        )}
        <label className="block">
          <span className="dash-label">الحد الأدنى للطلب (ر.س)</span>
          <input name="minSubtotal" className="dash-input num" dir="ltr" inputMode="decimal" maxLength={10} placeholder="0" />
          <span className="mt-1.5 block text-xs text-ink/50">اتركه فاضي إذا ما فيه حد أدنى.</span>
        </label>
        <label className="block">
          <span className="dash-label">أقصى عدد استخدامات</span>
          <input name="maxUses" className="dash-input num" dir="ltr" inputMode="numeric" maxLength={7} placeholder="بدون حد" />
        </label>
        <label className="block">
          <span className="dash-label">تاريخ الانتهاء</span>
          <input name="expires" type="date" className="dash-input num" dir="ltr" />
          <span className="mt-1.5 block text-xs text-ink/50">اختياري — يشتغل الكوبون لآخر هذا اليوم.</span>
        </label>
      </div>
      <div className="mt-5">
        <SafeSubmit pendingText="لحظة…">
          <Plus size={16} /> أنشئ الكوبون
        </SafeSubmit>
      </div>
    </SafeForm>
  );
}
