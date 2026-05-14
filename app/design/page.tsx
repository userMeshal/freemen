import DashboardShell from "@/components/DashboardShell";

export default function DesignPage() {
  return (
    <DashboardShell title="تصميم المتجر" subtitle="عدل الهوية، الألوان، البانر، وشكل المنتجات.">
      <div className="two-col">
        <div className="panel">
          <form className="form">
            <input className="input" placeholder="اسم المتجر" defaultValue="Swan Matcha" />
            <input className="input" placeholder="لون الهوية" defaultValue="أسود وأبيض" />
            <input className="input full" placeholder="نص البانر الرئيسي" defaultValue="ماتشا فاخر ومنتجات هدايا ناعمة" />
            <select className="input full"><option>ثيم كلاسيك أسود وأبيض</option><option>ثيم ناعم</option><option>ثيم فخم</option></select>
            <button className="btn full" type="button">حفظ التصميم</button>
          </form>
        </div>
        <div className="theme-preview">
          <div className="theme-top"><h2>Swan Matcha</h2><p>ماتشا فاخر ومنتجات هدايا ناعمة</p></div>
          <div className="theme-body"><div className="theme-box"></div><div className="theme-box"></div><div className="theme-box"></div></div>
        </div>
      </div>
    </DashboardShell>
  );
}
