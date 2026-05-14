import Link from "next/link";

export default function Nav() {
  return (
    <header className="topbar">
      <nav className="nav">
        <Link className="brand" href="/">
          <span className="logo">F</span>
          فريمان
        </Link>
        <div className="navlinks">
          <Link href="/pricing">الباقات</Link>
          <Link href="/dashboard">لوحة التاجر</Link>
          <Link href="/products">المنتجات</Link>
          <Link href="/store/swan">متجر تجريبي</Link>
        </div>
        <div className="actions-nav">
          <Link className="btn secondary nav-btn" href="/login">دخول</Link>
          <Link className="btn nav-btn" href="/register">افتح متجرك</Link>
        </div>
      </nav>
    </header>
  );
}
