import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth";
import { PageHero } from "@/components/site/PageHero";
import { RegisterForm } from "../AuthForms";

export const metadata: Metadata = { title: "إنشاء حساب", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCustomer()) redirect("/account");
  return (
    <>
      <PageHero eyebrow="Account" title={"حساب\nجديد."} accentWords={["جديد"]} description="أنشئ حسابًا لتتابع طلباتك وتُكمل الشراء أسرع في المرات القادمة." />
      <div className="wrap pb-24 md:pb-32">
        <div className="max-w-md">
          <RegisterForm />
        </div>
      </div>
    </>
  );
}
