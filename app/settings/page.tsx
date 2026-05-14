export default function SettingsPage() {
  return (
    <main className="wrap">
      <section>
        <h1>إعدادات المتجر</h1>
        <p className="lead">تعديل بيانات المتجر، السياسات، وروابط التواصل.</p>

        <div className="panel">
          <form className="form">
            <div>
              <label className="label">اسم المتجر</label>
              <input className="input" defaultValue="Swan Matcha" />
            </div>
            <div>
              <label className="label">رابط المتجر</label>
              <input className="input" defaultValue="swan" />
            </div>
            <div>
              <label className="label">رقم واتساب</label>
              <input className="input" placeholder="05xxxxxxxx" />
            </div>
            <div>
              <label className="label">إنستقرام</label>
              <input className="input" placeholder="@username" />
            </div>
            <div className="full">
              <label className="label">سياسة الشحن</label>
              <textarea className="input" rows={4} placeholder="مثال: الشحن خلال 2-5 أيام عمل"></textarea>
            </div>
            <div className="full">
              <label className="label">سياسة الاستبدال والاسترجاع</label>
              <textarea className="input" rows={4} placeholder="اكتب سياسة المتجر"></textarea>
            </div>
            <button className="btn full" type="button">حفظ الإعدادات</button>
          </form>
        </div>
      </section>
    </main>
  );
}
