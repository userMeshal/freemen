import Link from "next/link";

export const metadata = { title: "الصفحة غير موجودة" };

export default function NotFound() {
  return (
    <main className="on-ink grid min-h-screen place-items-center bg-ink px-6 text-center text-paper">
      <div>
        <p dir="ltr" className="t-mega text-[clamp(7rem,34vw,24rem)] text-lime">
          404
        </p>
        <h1 className="t-h2 mt-4">
          هذه الصفحة <span className="t-accent text-lime">تبخّرت.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-loose text-paper/65">الرابط غير صحيح أو أن الصفحة نُقلت. جرّب العودة للمتجر.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-lime">
            الرئيسية
          </Link>
          <Link href="/shop" className="btn btn-ghost">
            المتجر
          </Link>
        </div>
      </div>
    </main>
  );
}
