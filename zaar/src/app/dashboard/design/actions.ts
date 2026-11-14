"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { stores } from "@/db/schema";
import type { ActionState } from "@/components/dash/client";
import { merchantStore } from "@/lib/auth";
import { PALETTE_IDS, resolvePalette } from "@/lib/themes";

const text = (max: number) => z.string().trim().max(max);
const Design = z.object({
  theme: z.enum(["bold", "soft"]),
  palette: z.enum(PALETTE_IDS as [string, ...string[]]),
  nameLatin: z.string().trim().max(9).regex(/^[A-Za-z0-9]*$/, "الكلمة اللاتينية أحرف إنجليزية وأرقام فقط"),
  h1: text(18),
  h2: text(18),
  h3: text(18),
  heroText: text(180),
  manifesto: text(420),
  accentWords: text(80),
  announcement: text(90),
  ctaTitle: text(60),
  ctaText: text(140),
  marquee: text(240),
});

export async function saveDesign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await merchantStore();
  if (!ctx) return { ok: false, error: "سجّل دخولك من جديد" };
  const parsed = Design.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;
  const list = (s: string, n: number, len: number) => s.split(/[،,\n]/).map((x) => x.trim().slice(0, len)).filter(Boolean).slice(0, n);
  const headline = [d.h1, d.h2, d.h3].filter(Boolean);
  await db
    .update(stores)
    .set({
      theme: d.theme,
      palette: resolvePalette(d.palette, d.theme),
      nameLatin: d.nameLatin.toUpperCase(),
      content: {
        ...ctx.store.content,
        headline: headline.length ? headline : ctx.store.content.headline,
        heroText: d.heroText,
        manifesto: d.manifesto,
        accentWords: list(d.accentWords, 4, 24),
        announcement: d.announcement,
        ctaTitle: d.ctaTitle,
        ctaText: d.ctaText,
        marquee: list(d.marquee, 8, 28),
      },
      updatedAt: new Date(),
    })
    .where(eq(stores.id, ctx.store.id));
  revalidatePath(`/s/${ctx.store.slug}`, "layout");
  revalidatePath("/dashboard/design");
  return { ok: true, message: "تم حفظ التصميم — حدّث المعاينة لتشوفه" };
}
