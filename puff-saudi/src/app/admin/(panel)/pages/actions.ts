"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/normalize";
import { fail, firstError, ok, str, type ActionState } from "@/lib/admin-utils";

const schema = z.object({
  slug: z.enum(["privacy", "returns", "shipping", "terms", "contact"], { message: "صفحة غير معروفة" }),
  title: z.string().min(1, "عنوان الصفحة مطلوب").max(160, "العنوان طويل جدًا"),
  bodyHtml: z.string().max(60000, "المحتوى طويل جدًا"),
});

export async function savePageAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    slug: str(fd, "slug"),
    title: str(fd, "title"),
    bodyHtml: String(fd.get("bodyHtml") ?? ""),
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const bodyHtml = sanitizeHtml(parsed.data.bodyHtml).trim();
  const now = new Date();
  await db
    .insert(pages)
    .values({ slug: parsed.data.slug, title: parsed.data.title, bodyHtml, updatedAt: now })
    .onConflictDoUpdate({ target: pages.slug, set: { title: parsed.data.title, bodyHtml, updatedAt: now } });
  revalidateTag("pages");
  revalidatePath("/admin/pages");
  return ok("تم حفظ الصفحة ونشرها");
}
