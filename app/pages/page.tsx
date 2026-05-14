import DashboardShell from "@/components/DashboardShell";

const storePages = ["سياسة الشحن", "سياسة الاستبدال والاسترجاع", "سياسة الخصوصية", "من نحن", "تواصل معنا"];

export default function PagesPage() {
  return (
    <DashboardShell title="الصفحات والسياسات" subtitle="جهز صفحات المتجر الأساسية للعميل.">
      <div className="page-list">
        {storePages.map((p) => (
          <div className="page-item" key={p}><b>{p}</b><button className="btn small">تعديل</button></div>
        ))}
      </div>
    </DashboardShell>
  );
}
