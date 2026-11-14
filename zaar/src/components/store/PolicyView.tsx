"use client";

import { SLink, useStore } from "./ctx";
import { PageTitle, useT } from "./ui";

const LINKS = [
  { href: "/pages/shipping", label: "الشحن والتوصيل" },
  { href: "/pages/returns", label: "الاستبدال والاسترجاع" },
  { href: "/pages/guarantee", label: "ضمان زار" },
  { href: "/pages/privacy", label: "الخصوصية" },
];

export function PolicyView({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  const { store } = useStore();
  const t = useT();
  return (
    <div className={t.page}>
      <div className="mx-auto max-w-3xl">
        <PageTitle eyebrow={store.name} title={title} />
        <div className="space-y-5 text-[1.05rem] leading-loose opacity-90">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <nav className="mt-12 flex flex-wrap gap-2 border-t border-ink/10 pt-6" aria-label="السياسات">
          {LINKS.map((l) => (
            <SLink key={l.href} href={l.href} className={l.label === title ? t.chipOn : t.chip}>
              {l.label}
            </SLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
