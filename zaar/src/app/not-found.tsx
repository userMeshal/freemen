import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink p-6 text-center text-paper">
      <div>
        <p className="t-mega text-[32vw] leading-none text-accent md:text-[16rem]">404</p>
        <h1 className="t-h3 mt-4">الصفحة اللي تدوّرها مو موجودة</h1>
        <p className="mt-2 text-paper/60">يمكن الرابط تغيّر أو المتجر لسا ما انتشر.</p>
        <Link href="/" className="btn btn-accent mt-8">
          ارجع لزار
        </Link>
      </div>
    </main>
  );
}
