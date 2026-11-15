import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** ملف التحقق من الدومين لـ Apple Pay — محتواه يُلصق في لوحة التحكم ← الإعدادات (يُنزَّل من لوحة ميسر) */
export async function GET() {
  const { applePayDomainFile } = await getSettings();
  if (!applePayDomainFile.trim()) return new Response("Not found", { status: 404 });
  return new Response(applePayDomainFile.trim(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
