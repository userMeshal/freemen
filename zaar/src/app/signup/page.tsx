import { redirect } from "next/navigation";
import { signupAction } from "@/app/auth-actions";
import { AuthCard } from "@/components/platform/AuthCard";
import { getMerchant } from "@/lib/auth";
import { currentDraft } from "@/lib/stores";

export const metadata = { title: "انشر متجرك" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getMerchant()) redirect("/dashboard");
  const draft = await currentDraft();
  return <AuthCard mode="signup" action={signupAction} draftName={draft?.name ?? null} />;
}
