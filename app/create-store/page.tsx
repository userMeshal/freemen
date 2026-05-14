import Link from "next/link";

export default function CreateStorePage() {
  return (
    <main className="wrap">
      <section>
        <span className="badge">إعداد المتجر</span>
        <h1>أنشئ متجرك الأول</h1>
        <p className="lead">اختر اسم المتجر والرابط والتصنيف. بعدها تدخل لوحة التحكم مباشرة.</p>

        <div className="steps">
          <div className="step"><b>1</b><h3>بيانات المتجر</h3><p>الاسم، الرابط، التصنيف.</p></div>
          <div className="step"><b>2</b><h3>إضافة منتجات</h3><p>ارفع الصور وحدد السعر والمخزون.</p></div>
          <div className="step"><b>3</b><h3>استقبال الطلبات</h3><p>تابع الطلبات والتحويلات من اللوحة.</p></div>
        </div>

        <div className="panel">
          <form className="form">
            <div>
              <label className="label">اسم المتجر</label>
              <input className="input" placeholder="مثال: Swan Matcha" />
            </div>
            <div>
              <label className="label">رابط المتجر</label>
              <input className="input" placeholder="swan" />
            </div>
            <div>
              <label className="label">تصنيف المتجر</label>
              <select className="input">
                <option>ماتشا وقهوة</option>
                <option>ملابس</option>
                <option>مكياج</option>
                <option>هدايا</option>
                <option>منتجات يدوية</option>
              </select>
            </div>
            <div>
              <label className="label">الباقة</label>
              <select className="input">
                <option>Free</option>
                <option>Pro</option>
                <option>Business</option>
              </select>
            </div>
            <div className="full">
              <label className="label">وصف قصير</label>
              <textarea className="input" rows={4} placeholder="اكتب وصف بسيط يظهر للعميل"></textarea>
            </div>
            <Link className="btn full" href="/dashboard">إنشاء المتجر</Link>
          </form>
        </div>
      </section>
    </main>
  );
}
