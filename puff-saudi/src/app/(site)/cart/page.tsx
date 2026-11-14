import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { CartView } from "./CartView";

export const metadata: Metadata = { title: "سلة المشتريات", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageHero eyebrow="Cart" title="سلّتك." crumbs={[{ label: "السلة" }]} />
      <div className="wrap pb-24 md:pb-32">
        <CartView />
      </div>
    </>
  );
}
