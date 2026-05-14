import DashboardShell from "@/components/DashboardShell";

export default function SupportPage() {
  return (
    <DashboardShell title="الدعم" subtitle="مركز مساعدة للتاجر والعميل.">
      <div className="panel">
        <form className="form">
          <input className="input" placeholder="عنوان التذكرة" />
          <select className="input"><option>مشكلة طلب</option><option>مشكلة دفع</option><option>اقتراح</option></select>
          <textarea className="input full" rows={5} placeholder="اكتب التفاصيل"></textarea>
          <button className="btn full" type="button">إرسال تذكرة</button>
        </form>
      </div>
    </DashboardShell>
  );
}
