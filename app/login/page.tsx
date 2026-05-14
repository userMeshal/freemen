import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <span className="badge">دخول التاجر</span>
        <h1>ادخل لوحة فريمان</h1>
        <p>هذه واجهة تجريبية. الربط الحقيقي يكون لاحقًا مع Supabase Auth.</p>

        <form className="form">
          <div className="full">
            <label className="label">البريد الإلكتروني</label>
            <input className="input" type="email" placeholder="you@example.com" />
          </div>
          <div className="full">
            <label className="label">كلمة المرور</label>
            <input className="input" type="password" placeholder="••••••••" />
          </div>
          <Link className="btn full" href="/dashboard">دخول</Link>
        </form>

        <p className="help">
          ما عندك حساب؟ <Link href="/register">افتح متجرك الآن</Link>
        </p>
      </div>
    </main>
  );
}
