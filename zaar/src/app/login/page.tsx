import { redirect } from "next/navigation";
import { loginAction } from "@/app/auth-actions";
import { AuthCard } from "@/components/platform/AuthCard";
import { getMerchant } from "@/lib/auth";

export const metadata = { title: "تسجيل الدخول" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getMerchant()) redirect("/dashboard");
  return <AuthCard mode="login" action={loginAction} />;
}
