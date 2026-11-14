import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth";
import { PageHero } from "@/components/site/PageHero";
import { LoginForm } from "../AuthForms";

export const metadata: Metadata = { title: "تسجيل الدخول", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCustomer()) redirect("/account");
  return (
    <>
      <PageHero eyebrow="Account" title={"أهلًا\nبعودتك."} accentWords={["بعودتك"]} />
      <div className="wrap pb-24 md:pb-32">
        <div className="max-w-md">
          <LoginForm />
        </div>
      </div>
    </>
  );
}
