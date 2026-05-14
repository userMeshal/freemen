import DashboardShell from "@/components/DashboardShell";

export default function SettingsPage() {
  return (
    <DashboardShell title="إعدادات المتجر" subtitle="تعديل بيانات المتجر، الروابط، والسياسات العامة.">
      <div className="panel">
        <form className="form">
          <input className="input" defaultValue="Swan Matcha" placeholder="اسم المتجر" />
          <input className="input" defaultValue="swan" placeholder="رابط المتجر" />
          <input className="input" placeholder="رقم واتساب" />
          <input className="input" placeholder="إنستقرام" />
          <textarea className="input full" rows={4} placeholder="سياسة الشحن"></textarea>
          <textarea className="input full" rows={4} placeholder="سياسة الاستبدال والاسترجاع"></textarea>
          <button className="btn full" type="button">حفظ الإعدادات</button>
        </form>
      </div>
    </DashboardShell>
  );
}
