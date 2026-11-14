"use client";

import { useState } from "react";
import { Check, RotateCw } from "lucide-react";
import type { FormAction } from "@/components/dash/client";
import { SafeForm, SafeSubmit } from "@/components/dash/merchant/SafeForm";
import { PALETTES, THEMES } from "@/lib/themes";
import type { StoreContent, ThemeId } from "@/lib/types";

type Props = { action: FormAction; slug: string; theme: ThemeId; palette: string; nameLatin: string; content: StoreContent };

/** محرّر التصميم: الثيم واللوحة والنصوص على جهة، ومعاينة حية للمتجر على الجهة الأخرى */
export function DesignForm({ action, slug, theme: t0, palette: p0, nameLatin, content }: Props) {
  const [theme, setTheme] = useState<ThemeId>(t0);
  const [palette, setPalette] = useState(p0);
  const [version, setVersion] = useState(0);
  const area = "dash-input !min-h-0";

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[1fr_minmax(360px,440px)]">
      <SafeForm action={action} resetOnSuccess={false} onSuccess={() => setVersion((v) => v + 1)} className="space-y-5">
        <input type="hidden" name="theme" value={theme} />
        <input type="hidden" name="palette" value={palette} />

        <section className="dash-card p-5 md:p-6">
          <h2 className="mb-4 font-display text-base font-bold">الثيم</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="الثيم">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                onClick={() => setTheme(t.id)}
                className={`relative overflow-hidden rounded-3xl border-2 p-4 text-start transition-colors ${theme === t.id ? "border-ink" : "border-ink/10 hover:border-ink/30"}`}
              >
                <div className={`mb-3 grid h-24 place-items-center overflow-hidden rounded-2xl ${t.id === "bold" ? "bg-[#0B0B0C] text-[#D7FF3E]" : "bg-gradient-to-br from-[#FFE7D6] via-white to-[#E4DBFF] text-[#0d0d0d]"}`}>
                  <span className={`font-display font-black ${t.id === "bold" ? "text-4xl tracking-tighter" : "text-3xl"}`}>{t.id === "bold" ? "BOLD" : "ناعم"}</span>
                </div>
                <p className="font-display text-sm font-bold">
                  {t.name} <span className="text-xs font-medium text-ink/45">— من تصميم {t.origin}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink/60">{t.blurb}</p>
                {theme === t.id && (
                  <span className="absolute end-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-ink text-paper">
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </button>
            ))}
          </div>

          <h2 className="mb-3 mt-6 font-display text-base font-bold">الألوان</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="لوحة الألوان">
            {Object.entries(PALETTES).map(([id, p]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={palette === id}
                onClick={() => setPalette(id)}
                className={`flex items-center gap-2 rounded-full border-2 py-1.5 pe-3.5 ps-1.5 text-xs font-semibold transition-colors ${palette === id ? "border-ink" : "border-ink/10 hover:border-ink/30"}`}
              >
                <span className="flex h-6 w-10 overflow-hidden rounded-full ring-1 ring-ink/10">
                  <span className="flex-1" style={{ background: p.ink }} />
                  <span className="flex-1" style={{ background: p.accent }} />
                  <span className="flex-1" style={{ background: p.paper }} />
                </span>
                {p.name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/50">في الثيم الناعم تحدد اللوحة ألوان الهالات واللمسات، والخلفية تبقى فاتحة أو داكنة.</p>
        </section>

        <section className="dash-card space-y-4 p-5 md:p-6">
          <h2 className="font-display text-base font-bold">نصوص الواجهة</h2>
          <label className="block">
            <span className="dash-label">الكلمة العملاقة (لاتينية، حتى 9 أحرف)</span>
            <input name="nameLatin" defaultValue={nameLatin} maxLength={9} dir="ltr" className="dash-input !text-end font-display font-black uppercase" />
            <span className="mt-1.5 block text-xs text-ink/50">تظهر بحجم الشاشة في الثيم الجريء. اتركها فارغة ليُستخدم اسم المتجر بالعربية.</span>
          </label>
          <div>
            <span className="dash-label">العنوان الافتتاحي (ثلاث كلمات قصيرة)</span>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <input key={i} name={`h${i + 1}`} defaultValue={content.headline[i] ?? ""} maxLength={18} className="dash-input" aria-label={`الكلمة ${i + 1}`} />
              ))}
            </div>
          </div>
          <label className="block">
            <span className="dash-label">الجملة التعريفية</span>
            <textarea name="heroText" defaultValue={content.heroText} maxLength={180} rows={2} className={area} />
          </label>
          <label className="block">
            <span className="dash-label">شريط الإعلان</span>
            <input name="announcement" defaultValue={content.announcement} maxLength={90} className="dash-input" />
          </label>
          <label className="block">
            <span className="dash-label">قصة العلامة</span>
            <textarea name="manifesto" defaultValue={content.manifesto} maxLength={420} rows={4} className={area} />
          </label>
          <label className="block">
            <span className="dash-label">كلمات مميزة من القصة (افصل بينها بفاصلة)</span>
            <input name="accentWords" defaultValue={content.accentWords.join("، ")} maxLength={80} className="dash-input" />
          </label>
          <label className="block">
            <span className="dash-label">كلمات الشريط المتحرك (افصل بينها بفاصلة)</span>
            <input name="marquee" defaultValue={content.marquee.join("، ")} maxLength={240} className="dash-input" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="dash-label">عنوان الدعوة الختامية</span>
              <input name="ctaTitle" defaultValue={content.ctaTitle} maxLength={60} className="dash-input" />
            </label>
            <label className="block">
              <span className="dash-label">نص الدعوة</span>
              <input name="ctaText" defaultValue={content.ctaText} maxLength={140} className="dash-input" />
            </label>
          </div>
          <SafeSubmit>حفظ التصميم</SafeSubmit>
        </section>
      </SafeForm>

      <aside className="xl:sticky xl:top-6">
        <div className="mb-2 flex items-center justify-between text-xs text-ink/55">
          <span>المعاينة (آخر نسخة محفوظة)</span>
          <button type="button" onClick={() => setVersion((v) => v + 1)} className="flex items-center gap-1 font-semibold hover:text-ink">
            <RotateCw size={13} /> تحديث
          </button>
        </div>
        <div className="mx-auto h-[70vh] max-h-[760px] w-full max-w-[400px] overflow-hidden rounded-[2rem] border-[6px] border-ink bg-white shadow-xl">
          <iframe key={version} src={`/s/${slug}?v=${version}`} title="معاينة المتجر" className="h-full w-full" />
        </div>
      </aside>
    </div>
  );
}
