import type { Metadata } from "next";
import { PageHero } from "@/components/site/PageHero";
import { TrackForm } from "./TrackForm";

export const metadata: Metadata = {
  title: "تتبّع طلبك",
  description: "تابع حالة طلبك من بف السعودية برقم الطلب ورقم الجوال.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return (
    <>
      <PageHero
        eyebrow="Track"
        title={"تتبّع\nطلبك."}
        accentWords={["طلبك"]}
        description="أدخل رقم الطلب ورقم الجوال الذي استخدمته عند الشراء لعرض حالة الطلب ورقم الشحنة."
        crumbs={[{ label: "تتبّع طلبك" }]}
      />
      <div className="wrap pb-24 md:pb-32">
        <TrackForm />
      </div>
    </>
  );
}
