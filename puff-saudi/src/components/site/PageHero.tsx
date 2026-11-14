import { SplitText } from "@/components/ui/Reveal";
import { TLink } from "./Transition";

/** ترويسة الصفحات الداخلية: مسار التنقل + عنوان كبير متحرك */
export function PageHero({
  eyebrow,
  title,
  accentWords,
  description,
  crumbs = [],
  count,
  bg,
}: {
  eyebrow?: string;
  title: string;
  accentWords?: string[];
  description?: string | null;
  crumbs?: { href?: string; label: string }[];
  count?: number;
  bg?: string;
}) {
  return (
    <header className="pb-8 pt-[calc(var(--header-h)+2rem)] md:pb-12 md:pt-[calc(var(--header-h)+4rem)]" style={bg ? { backgroundColor: bg } : undefined}>
      <div className="wrap">
        {crumbs.length > 0 && (
          <nav aria-label="مسار التنقل" className="mb-5 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
            <TLink href="/" className="link-draw">
              الرئيسية
            </TLink>
            {crumbs.map((c) => (
              <span key={c.label} className="flex items-center gap-2">
                <span aria-hidden>/</span>
                {c.href ? (
                  <TLink href={c.href} className="link-draw">
                    {c.label}
                  </TLink>
                ) : (
                  <span className="text-ink">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="t-eyebrow mb-3 text-ink-mute">{eyebrow}</p>}
        <div className="flex items-start gap-3">
          <SplitText as="h1" className="t-h1" text={title} accentWords={accentWords} immediate />
          {typeof count === "number" && (
            <span className="num t-accent mt-2 text-xl text-ink-mute md:mt-4 md:text-3xl">({count})</span>
          )}
        </div>
        {description && <p className="mt-4 max-w-2xl leading-loose text-ink-mute md:text-lg">{description}</p>}
      </div>
    </header>
  );
}
