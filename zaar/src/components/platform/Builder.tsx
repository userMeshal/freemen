"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, ExternalLink, Monitor, RotateCw, Rocket, Smartphone, Sparkles } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { PALETTES } from "@/lib/themes";
import type { BuildStreamEvent } from "@/app/api/ai/build/route";

type Msg = { role: "user" | "zaar"; text: string; meta?: string };
type Draft = Extract<BuildStreamEvent, { type: "partial" }>["draft"];
type Built = { slug: string; name: string; theme: string };

const EASE = [0.16, 1, 0.3, 1] as const;
const IDEAS = ["متجر عطور وبخور فاخر", "قهوة مختصة محمّصة أسبوعيًا", "عبايات بقصّات عصرية", "ستريت وير شبابي", "حلا وبوكسات ضيافة", "إكسسوارات قيمنق"];
const EDITS = ["خل التصميم ناعم", "غيّر الألوان إلى ذهبي", "ارفع الأسعار 10%", "سمّه نَفَس"];

/**
 * صفحة البناء: محادثة على جهة، ومعاينة حية للمتجر على الجهة الأخرى.
 * أثناء البناء تُعرض لوحة «يتكوّن الآن» تمتلئ بالاسم والمنتجات مع وصولها من البث.
 */
export function Builder({ initialIdea, draft, ai }: { initialIdea: string; draft: Built | null; ai: boolean }) {
  const [messages, setMessages] = useState<Msg[]>(
    draft
      ? [{ role: "zaar", text: `رجعنا لمتجرك «${draft.name}». قل لي وش تبي تعدّل، أو انشره على طول.` }]
      : [{ role: "zaar", text: "هلا، أنا زار. قل لي وش تبي تبيع — بجملة وحدة — وأبني لك متجرك كامل: الاسم، التصميم، المنتجات والأسعار." }],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [partial, setPartial] = useState<Draft | null>(null);
  const [built, setBuilt] = useState<Built | null>(draft);
  const [version, setVersion] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [tab, setTab] = useState<"chat" | "preview">("chat");
  const scroller = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setInput("");
      setBusy(true);
      setStatus("…");
      setMessages((m) => [...m, { role: "user", text: message }]);
      if (!built) setPartial({});
      try {
        const res = await fetch("/api/ai/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(j?.error ?? "تعذّر الاتصال. جرّب مرة ثانية.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const ev = JSON.parse(line.slice(6)) as BuildStreamEvent;
            if (ev.type === "status") setStatus(ev.text);
            else if (ev.type === "partial") setPartial(ev.draft);
            else if (ev.type === "error") throw new Error(ev.message);
            else if (ev.type === "done") {
              setBuilt({ slug: ev.slug, name: ev.name, theme: ev.theme });
              setVersion((v) => v + 1);
              setPartial(null);
              setMessages((m) => [
                ...m,
                { role: "zaar", text: ev.reply, meta: ev.edited ? undefined : `${ev.products} منتج · ${ev.categories} تصنيفات · ثيم ${ev.theme === "soft" ? "ناعم" : "جريء"}` },
              ]);
              if (window.innerWidth < 1024) setTab("preview");
            }
          }
        }
      } catch (e) {
        setPartial(null);
        setMessages((m) => [...m, { role: "zaar", text: e instanceof Error ? e.message : "صار خطأ. جرّب مرة ثانية." }]);
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [busy, built],
  );

  // فكرة قادمة من الصفحة الرئيسية: نبدأ البناء فورًا
  useEffect(() => {
    if (started.current || !initialIdea || draft) return;
    started.current = true;
    void send(initialIdea);
  }, [initialIdea, draft, send]);

  const chips = built ? EDITS : IDEAS;

  return (
    <div className="flex h-[100dvh] flex-col bg-ink text-paper">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-paper/10 px-4 md:px-6">
        <Link href="/" className="font-display text-2xl font-black leading-none">
          زار
        </Link>
        <div className="flex rounded-full bg-paper/10 p-1 lg:hidden" role="tablist">
          {(["chat", "preview"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${tab === k ? "bg-paper text-ink" : "text-paper/70"}`}>
              {k === "chat" ? "المحادثة" : "المعاينة"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!built && (
            <Link href="/login" className="hidden text-sm text-paper/60 hover:text-paper sm:block">
              عندي متجر
            </Link>
          )}
          <Link
            href="/signup"
            aria-disabled={!built}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 font-display text-xs font-bold transition-all ${built ? "bg-accent text-on-accent hover:scale-[1.03]" : "pointer-events-none bg-paper/10 text-paper/40"}`}
          >
            <Rocket size={15} /> انشر متجري
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,430px)_1fr]">
        {/* ───── المحادثة ───── */}
        <section className={`min-h-0 flex-col border-paper/10 lg:flex lg:border-e ${tab === "chat" ? "flex" : "hidden"}`} aria-label="المحادثة مع زار">
          <div ref={scroller} className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-5 md:px-5">
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[88%] rounded-3xl px-4 py-3 text-[0.95rem] leading-relaxed ${
                    m.role === "user" ? "rounded-ss-lg bg-accent font-medium text-on-accent" : "rounded-se-lg bg-paper/[0.08] text-paper"
                  }`}
                >
                  {m.text}
                  {m.meta && (
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                      <Check size={13} strokeWidth={3} /> {m.meta}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
            {busy && (
              <div className="flex justify-end">
                <div className="flex items-center gap-3 rounded-3xl rounded-se-lg bg-paper/[0.08] px-4 py-3 text-sm text-paper/80">
                  <span className="z-typing text-accent">
                    <span />
                    <span />
                    <span />
                  </span>
                  <AnimatePresence mode="wait">
                    <motion.span key={status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                      {status}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-5">
            <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
              {chips.map((c) => (
                <button key={c} type="button" disabled={busy} onClick={() => send(c)} className="shrink-0 rounded-full border border-paper/15 px-3.5 py-1.5 text-xs text-paper/75 transition-colors hover:border-accent hover:text-accent disabled:opacity-40">
                  {c}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex items-end gap-2 rounded-[1.75rem] bg-paper/[0.08] p-2 ring-1 ring-paper/10 focus-within:ring-accent"
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
                maxLength={1500}
                placeholder={built ? "قل لي وش تبي تعدّل…" : "مثال: أبي أبيع عطور وبخور، واسم المتجر عبق"}
                aria-label="رسالتك"
                className="max-h-36 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[0.98rem] text-paper outline-none [field-sizing:content] placeholder:text-paper/35"
              />
              <button type="submit" disabled={busy || !input.trim()} aria-label="إرسال" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-transform hover:scale-105 disabled:opacity-30">
                <ArrowUp size={19} strokeWidth={2.6} />
              </button>
            </form>
            <p className="mt-2 text-center text-[0.68rem] text-paper/35">{ai ? "المتجر يبنيه ذكاء اصطناعي — راجع النصوص والأسعار قبل النشر." : "راجع النصوص والأسعار قبل النشر."}</p>
          </div>
        </section>

        {/* ───── المعاينة ───── */}
        <section className={`min-h-0 flex-col bg-[#131314] lg:flex ${tab === "preview" ? "flex" : "hidden"}`} aria-label="معاينة المتجر">
          <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-paper/10 px-4">
            <div className="flex items-center gap-2 text-xs text-paper/55">
              <span className={`h-2 w-2 rounded-full ${built ? "bg-accent" : "bg-paper/25"}`} />
              {built ? <span dir="ltr">zaar.sa/s/{built.slug}</span> : "المعاينة تظهر هنا"}
            </div>
            {built && (
              <div className="flex items-center gap-1">
                <button type="button" aria-label="سطح المكتب" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} className={`hidden h-8 w-8 place-items-center rounded-full lg:grid ${device === "desktop" ? "bg-paper/15" : "text-paper/50"}`}>
                  <Monitor size={15} />
                </button>
                <button type="button" aria-label="الجوال" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} className={`hidden h-8 w-8 place-items-center rounded-full lg:grid ${device === "mobile" ? "bg-paper/15" : "text-paper/50"}`}>
                  <Smartphone size={15} />
                </button>
                <button type="button" aria-label="تحديث المعاينة" onClick={() => setVersion((v) => v + 1)} className="grid h-8 w-8 place-items-center rounded-full text-paper/50 hover:text-paper">
                  <RotateCw size={15} />
                </button>
                <a href={`/s/${built.slug}`} target="_blank" rel="noopener" aria-label="افتح في نافذة جديدة" className="grid h-8 w-8 place-items-center rounded-full text-paper/50 hover:text-paper">
                  <ExternalLink size={15} />
                </a>
              </div>
            )}
          </div>
          <div className="relative min-h-0 flex-1 p-3 md:p-5">
            <AnimatePresence mode="wait">
              {partial ? (
                <motion.div key="forming" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.4 }}>
                  <Forming draft={partial} />
                </motion.div>
              ) : built ? (
                <motion.div
                  key={`frame-${version}`}
                  className={`mx-auto h-full overflow-hidden rounded-[1.4rem] bg-white shadow-2xl ring-1 ring-paper/10 transition-[max-width] duration-700 ease-expo ${device === "mobile" ? "max-w-[390px]" : "max-w-full"}`}
                  initial={{ opacity: 0, y: 30, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, ease: EASE }}
                >
                  <iframe src={`/s/${built.slug}?v=${version}`} title={`معاينة ${built.name}`} className="h-full w-full" />
                </motion.div>
              ) : (
                <motion.div key="empty" className="h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Idle />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </div>
  );
}

function Idle() {
  return (
    <div className="relative grid h-full place-items-center overflow-hidden rounded-[1.4rem] border border-dashed border-paper/15 text-center">
      <span className="z-glow -left-20 -top-28 h-80 w-80" aria-hidden />
      <div className="relative max-w-sm px-6">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-accent text-on-accent">
          <Sparkles size={28} />
        </span>
        <p className="mt-6 font-display text-2xl font-extrabold">متجرك يطلع هنا</p>
        <p className="mt-2 text-sm leading-relaxed text-paper/55">اكتب فكرتك في المحادثة، وخلال ثوانٍ تشوف متجرك كامل وتتصفحه كأنه منشور.</p>
      </div>
    </div>
  );
}

/** لوحة «يتكوّن الآن»: تمتلئ بما يصل من البث — الاسم، العنوان، ثم المنتجات واحدًا واحدًا */
function Forming({ draft }: { draft: Draft }) {
  const palette = PALETTES[draft.palette ?? ""] ?? PALETTES.mint;
  const word = draft.nameLatin || draft.name || "";
  const products = draft.products ?? [];
  return (
    <div className="relative h-full overflow-hidden rounded-[1.4rem] transition-colors duration-1000" style={{ background: palette.paper, color: palette.ink }}>
      <div className="flex h-12 items-center justify-between px-5 text-sm font-semibold">
        <span className="font-display font-black">{draft.name ?? <span className="z-skeleton inline-block h-4 w-20 rounded-full" />}</span>
        <span className="flex gap-3 text-xs opacity-50">
          {(draft.categories ?? []).slice(0, 4).map((c) => (
            <span key={c} className="z-pop hidden sm:inline">
              {c}
            </span>
          ))}
        </span>
      </div>
      <div className="relative grid h-[38%] place-items-center overflow-hidden px-4">
        {word ? (
          <motion.p key={word} initial={{ y: "60%", opacity: 0, rotate: 4 }} animate={{ y: 0, opacity: 1, rotate: 0 }} transition={{ duration: 1, ease: EASE }} className="font-display font-black leading-none" style={{ fontSize: `min(${Math.min(22, 90 / Math.max(3, word.length))}vw, 9rem)` }} dir="auto">
            {word}
          </motion.p>
        ) : (
          <span className="z-skeleton h-24 w-2/3 rounded-3xl" />
        )}
        {draft.headline && draft.headline.length > 0 && (
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-3 font-display text-base font-bold md:text-xl">
            {draft.headline.join(" ")}
          </motion.p>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 px-5 pb-5 md:grid-cols-4">
        {products.slice(0, 8).map((p, i) => (
          <div key={`${p.name}-${i}`} className="z-pop">
            <div className="p-art aspect-[4/5] overflow-hidden rounded-2xl" style={{ "--h": p.hue } as CSSProperties}>
              <Icon name={p.icon} />
            </div>
            <p className="mt-1.5 truncate text-xs font-medium">{p.name}</p>
            <p className="num text-xs font-bold">{p.price} ر.س</p>
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - products.length) }).map((_, i) => (
          <div key={i}>
            <div className="z-skeleton aspect-[4/5] rounded-2xl" />
            <div className="z-skeleton mt-1.5 h-3 w-3/4 rounded-full" />
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 py-3 text-xs font-semibold" style={{ background: palette.ink, color: palette.accent }}>
        <span className="z-dot" style={{ background: palette.accent }} /> يتكوّن الآن…
      </div>
    </div>
  );
}
