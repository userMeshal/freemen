import Link from "next/link";

export default function Nav() {
  return (
    <header className="topbar">
      <nav className="nav">
        <Link className="brand" href="/"><span className="logo">F</span> فريمان</Link>
        <div className="navlinks">
          <Link href="/store/swan">متجر تجريبي</Link>
          <Link href="/dashboard">لوحة التاجر</Link>
          <Link href="/admin">إدارة المنصة</Link>
          <Link href="/register">افتح متجرك</Link>
        </div>
        <div className="actions-nav">
          <Link className="btn secondary nav-btn" href="/login">دخول</Link>
          <Link className="btn nav-btn" href="/register">ابدأ الآن</Link>
        </div>
      </nav>
    </header>
  );
}
