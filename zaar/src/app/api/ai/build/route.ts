import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, getMerchant, sameOrigin } from "@/lib/auth";
import { aiEnabled, buildWithClaude } from "@/lib/ai/claude";
import { localBlueprint, localEdit } from "@/lib/ai/local";
import type { Blueprint } from "@/lib/blueprint";
import { randomToken } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { DRAFT_COOKIE } from "@/lib/session";
import { applyBlueprintToDraft, blueprintFromStore, createStoreFromBlueprint, currentDraft, draftTokens } from "@/lib/stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ message: z.string().trim().min(2).max(1500) });

export type BuildStreamEvent =
  | { type: "status"; text: string }
  | { type: "partial"; draft: PartialDraft }
  | { type: "done"; slug: string; reply: string; name: string; theme: string; products: number; categories: number; engine: "claude" | "local"; edited: boolean }
  | { type: "error"; message: string };

type PartialDraft = { name?: string; nameLatin?: string; tagline?: string; theme?: string; palette?: string; headline?: string[]; categories?: string[]; products?: { name: string; price: number; hue: number; icon: string }[] };

function slim(b: Partial<Blueprint>): PartialDraft {
  return {
    name: b.name,
    nameLatin: b.nameLatin,
    tagline: b.tagline,
    theme: b.theme,
    palette: b.palette,
    headline: b.headline?.filter((h) => typeof h === "string"),
    categories: b.categories?.filter((c) => c?.name).map((c) => c.name),
    products: b.products
      ?.filter((p) => p && typeof p.name === "string" && typeof p.price === "number")
      .map((p) => ({ name: p.name, price: p.price, hue: Number(p.hue) || 0, icon: String(p.icon || "Sparkles") })),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * يبني متجرًا من فكرة التاجر (أو يعدّل مسودته) ويبثّ التقدّم كـ Server-Sent Events.
 * المحرّك: Claude إن كان المفتاح مضبوطًا، وإلا المولّد المحلي — ويتحوّل للمحلي تلقائيًا عند أي تعذّر.
 */
export async function POST(req: Request) {
  if (!(await sameOrigin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "اكتب فكرتك في جملة على الأقل" }, { status: 400 });
  const ip = await clientIp();
  if (!(await rateLimit(`ai-build:${ip}`, 30, 3600))) return NextResponse.json({ error: "وصلت الحد المسموح من المحاولات. جرّب بعد ساعة." }, { status: 429 });

  const message = parsed.data.message;
  const [draft, merchant] = await Promise.all([currentDraft(), getMerchant()]);
  const current = draft ? await blueprintFromStore(draft) : null;
  // رمز الملكية يُرسل ككوكي في ترويسة الرد قبل بدء البث
  const tokens = await draftTokens();
  const newToken = draft ? null : randomToken(24);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: BuildStreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        let blueprint: Blueprint | null = null;
        let engine: "claude" | "local" = "local";

        if (aiEnabled()) {
          send({ type: "status", text: current ? "أطبّق تعديلك…" : "أفهم فكرتك وأختار الهوية…" });
          try {
            for await (const ev of buildWithClaude(current ? { idea: draft!.idea, current, instruction: message } : { idea: message })) {
              if (ev.type === "partial") send({ type: "partial", draft: slim(ev.draft) });
              else blueprint = ev.blueprint;
            }
            engine = "claude";
          } catch (e) {
            console.error("[ai/build] claude failed, falling back to local", e);
            send({ type: "status", text: "أكمل البناء بالمحرّك السريع…" });
          }
        }

        if (!blueprint) {
          blueprint = current ? localEdit(current, message) : localBlueprint(message);
          if (!current) {
            // نعرض مراحل البناء حتى يرى التاجر متجره يتكوّن
            const steps: [string, Partial<Blueprint>][] = [
              ["أفهم فكرتك وأختار الهوية…", { name: blueprint.name, nameLatin: blueprint.nameLatin, tagline: blueprint.tagline }],
              ["أختار الثيم والألوان…", { theme: blueprint.theme, palette: blueprint.palette, headline: blueprint.headline }],
              ["أرتّب التصنيفات…", { categories: blueprint.categories }],
            ];
            let acc: Partial<Blueprint> = {};
            for (const [text, part] of steps) {
              send({ type: "status", text });
              acc = { ...acc, ...part };
              send({ type: "partial", draft: slim(acc) });
              await sleep(420);
            }
            send({ type: "status", text: "أضيف المنتجات والأسعار…" });
            for (let i = 1; i <= blueprint.products.length; i++) {
              send({ type: "partial", draft: slim({ ...acc, products: blueprint.products.slice(0, i) }) });
              await sleep(110);
            }
          }
        }

        send({ type: "status", text: "أجهّز المتجر للمعاينة…" });
        const store = draft
          ? await applyBlueprintToDraft(draft.id, { ...blueprint, slug: draft.slug })
          : (await createStoreFromBlueprint(blueprint, message, null, newToken!)).store;
        // لو كان التاجر مسجّلًا وما عنده متجر، تبقى المسودة باسمه بعد النشر من صفحة التسجيل
        void merchant;
        send({
          type: "done",
          slug: store.slug,
          reply: blueprint.reply,
          name: store.name,
          theme: store.theme,
          products: blueprint.products.length,
          categories: blueprint.categories.length,
          engine,
          edited: Boolean(draft),
        });
      } catch (e) {
        console.error("[ai/build]", e);
        send({ type: "error", message: "صار خطأ وأنا أبني المتجر. جرّب مرة ثانية." });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" });
  if (newToken) {
    const value = [newToken, ...tokens].slice(0, 5).join(".");
    headers.append(
      "Set-Cookie",
      `${DRAFT_COOKIE}=${value}; Path=/; Max-Age=${60 * 60 * 24 * 14}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
    );
  }
  return new Response(stream, { headers });
}
