"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Sparkles } from "lucide-react";
import { askAssistant } from "@/app/dashboard/assistant/actions";

type Turn = { role: "user" | "assistant"; text: string; actions?: string[] };

const FULL = ["كم بعت هذا الأسبوع؟", "أضف منتج جديد يناسب متجري", "سوِّ كوبون خصم 15% لأول طلب", "نزّل سعر أغلى منتج 10%", "خل شريط الإعلان: شحن مجاني اليوم"];
const BASIC = ["كم مبيعاتي؟", "كوبون 10%", "غيّر الألوان إلى ذهبي", "خل التصميم ناعم"];

export function AssistantChat({ storeName, ai }: { storeName: string; ai: boolean }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", text: `هلا، أنا مساعد زار لمتجر «${storeName}». وش تبي أسوي لك؟` }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: message }];
    setTurns(next);
    setInput("");
    setBusy(true);
    try {
      const res = await askAssistant(next.map(({ role, text: t }) => ({ role, text: t })));
      setTurns((t) => [...t, { role: "assistant", text: res.reply, actions: res.actions }]);
      if (res.actions.length) router.refresh();
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "تعذّر الاتصال. جرّب مرة ثانية." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dash-card flex h-[calc(100dvh-15rem)] min-h-[26rem] flex-col overflow-hidden">
      {!ai && (
        <p className="border-b border-ink/10 bg-amber-500/10 px-5 py-2.5 text-xs leading-relaxed text-amber-900">
          المساعد يعمل الآن بالأوامر الأساسية (تقرير المبيعات، كوبون بنسبة، الثيم والألوان). المساعد الكامل يتفعّل عند ربط الذكاء الاصطناعي في المنصة.
        </p>
      )}
      <div ref={box} className="flex-1 space-y-3 overflow-y-auto p-4 md:p-6">
        {turns.map((t, i) => (
          <div key={i} className={`flex ${t.role === "user" ? "justify-start" : "justify-end"}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-3 text-[0.95rem] leading-relaxed ${t.role === "user" ? "rounded-ss-lg bg-ink text-paper" : "rounded-se-lg bg-ink/[0.06]"}`}>
              {t.role === "assistant" && i === 0 && <Sparkles size={15} className="mb-1.5 text-emerald-600" />}
              {t.text}
              {t.actions?.map((a) => (
                <span key={a} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <Check size={13} strokeWidth={3} /> {a}
                </span>
              ))}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <span className="z-typing rounded-3xl bg-ink/[0.06] px-4 py-3.5">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>
      <div className="border-t border-ink/10 p-3 md:p-4">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {(ai ? FULL : BASIC).map((c) => (
            <button key={c} type="button" disabled={busy} onClick={() => send(c)} className="shrink-0 rounded-full border border-ink/15 px-3.5 py-1.5 text-xs transition-colors hover:border-ink disabled:opacity-40">
              {c}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="اكتب طلبك…"
            aria-label="رسالتك للمساعد"
            className="dash-input !max-h-36 flex-1 resize-none !rounded-3xl [field-sizing:content]"
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="إرسال" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-accent transition-transform hover:scale-105 disabled:opacity-30">
            <ArrowUp size={19} strokeWidth={2.6} />
          </button>
        </form>
      </div>
    </div>
  );
}
