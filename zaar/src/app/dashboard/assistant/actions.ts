"use server";

import { z } from "zod";
import { merchantStore } from "@/lib/auth";
import { runAssistant, type AssistantResult } from "@/lib/ai/assistant";
import { rateLimit } from "@/lib/rate-limit";

const History = z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(4000) })).min(1).max(30);

export async function askAssistant(history: unknown): Promise<AssistantResult> {
  const ctx = await merchantStore();
  if (!ctx) return { reply: "انتهت جلستك — سجّل دخولك من جديد.", actions: [] };
  const parsed = History.safeParse(history);
  if (!parsed.success || parsed.data[parsed.data.length - 1].role !== "user") return { reply: "اكتب طلبك.", actions: [] };
  if (!(await rateLimit(`assistant:${ctx.store.id}`, 60, 3600))) return { reply: "وصلت الحد المسموح لهذه الساعة. جرّب لاحقًا.", actions: [] };
  return runAssistant(ctx.store, parsed.data);
}
