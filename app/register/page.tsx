import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <span className="badge">ابدأ كتاجر</span>
        <h1>افتح متجرك في فريمان</h1>
        <p>سجل بياناتك الأساسية، وبعدها تنشئ متجرك وتبدأ تضيف منتجاتك.</p>

        <form className="form">
          <div>
            <label className="label">اسمك</label>
            <input className="input" placeholder="مثال: مشعل" />
          </div>
          <div>
            <label className="label">رقم الجوال</label>
            <input className="input" placeholder="05xxxxxxxx" />
          </div>
          <div className="full">
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" placeholder="you@example.com" />
          </div>
          <div className="full">
            <label className="label">كلمة المرور</label>
            <input className="input" type="password" placeholder="••••••••" />
          </div>
          <Link className="btn full" href="/create-store">إنشاء الحساب والمتابعة</Link>
        </form>

        <p className="help">
          عندك حساب؟ <Link href="/login">سجل دخولك</Link>
        </p>
      </div>
    </main>
  );
}
