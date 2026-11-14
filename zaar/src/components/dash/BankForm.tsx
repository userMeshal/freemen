"use client";

import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import type { FormAction } from "@/components/dash/client";

const BANKS = ["مصرف الراجحي", "البنك الأهلي السعودي", "بنك الرياض", "مصرف الإنماء", "بنك البلاد", "البنك السعودي الأول (ساب)", "البنك العربي الوطني", "البنك السعودي الفرنسي", "بنك الجزيرة", "البنك السعودي للاستثمار", "بنك الخليج الدولي", "STC Bank", "D360", "أخرى"];

export function BankForm({ action, holder, bank, iban }: { action: FormAction; holder: string; bank: string; iban: string }) {
  return (
    <SafeForm action={action} resetOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="dash-label">اسم صاحب الحساب</span>
        <input name="holder" required defaultValue={holder} className="dash-input" placeholder="كما هو مسجّل في البنك" />
      </label>
      <label className="block">
        <span className="dash-label">البنك</span>
        <select name="bank" required defaultValue={bank} className="dash-input">
          <option value="" disabled>
            اختر البنك
          </option>
          {BANKS.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </label>
      <label className="block sm:col-span-2">
        <span className="dash-label">رقم الآيبان</span>
        <input name="iban" required defaultValue={iban} dir="ltr" className="dash-input num !text-end tracking-wider" placeholder="SA00 0000 0000 0000 0000 0000" maxLength={34} />
      </label>
      <div className="sm:col-span-2">
        <SafeSubmit>حفظ الحساب البنكي</SafeSubmit>
      </div>
    </SafeForm>
  );
}
