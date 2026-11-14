import { redirect } from "next/navigation";
import { Builder } from "@/components/platform/Builder";
import { merchantStore } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai/claude";
import { currentDraft } from "@/lib/stores";

export const metadata = { title: "ابنِ متجرك بالمحادثة" };
export const dynamic = "force-dynamic";

export default async function StartPage({ searchParams }: { searchParams: Promise<{ idea?: string }> }) {
  const [sp, ctx] = await Promise.all([searchParams, merchantStore()]);
  if (ctx) redirect("/dashboard");
  const draft = await currentDraft();
  return (
    <Builder
      initialIdea={(sp.idea ?? "").slice(0, 600)}
      draft={draft ? { slug: draft.slug, name: draft.name, theme: draft.theme } : null}
      ai={aiEnabled()}
    />
  );
}
