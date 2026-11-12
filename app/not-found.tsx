import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container page empty">
      <h1 className="h1">404</h1>
      <p className="lead">هذي الصفحة انبدلت بشي ثاني.</p>
      <Link href="/" className="btn btn-primary btn-lg">ارجع للرئيسية</Link>
    </div>
  );
}
