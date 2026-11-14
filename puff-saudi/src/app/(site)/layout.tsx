import { getSettings } from "@/lib/settings";
import { getCategories } from "@/lib/catalog";
import { Header, type NavLink } from "@/components/site/Header";
import { MobileMenu } from "@/components/site/MobileMenu";
import { Footer } from "@/components/site/Footer";
import { CartDrawer } from "@/components/site/CartDrawer";
import { SearchOverlay } from "@/components/site/SearchOverlay";
import { TransitionProvider } from "@/components/site/Transition";
import { SmoothScroll } from "@/components/site/SmoothScroll";
import { Cursor } from "@/components/site/Cursor";
import { Pixels } from "@/components/site/Pixels";
import { Preloader, PRELOADER_SCRIPT } from "@/components/site/Preloader";

const NAV: NavLink[] = [
  { href: "/shop", label: "المتجر", latin: "Shop" },
  { href: "/shop?family=sippy", label: "سيبي", latin: "Sippy" },
  { href: "/shop?family=coffee", label: "كوفي", latin: "Coffee" },
  { href: "/shop?family=flippy", label: "فليبي", latin: "Flippy" },
  { href: "/shop?family=special", label: "إصدارات خاصة", latin: "Special" },
];

function socialUrl(kind: "instagram" | "tiktok" | "snapchat" | "x", value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^https:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "");
  if (!/^[\w.]{1,40}$/.test(handle)) return null;
  const base = {
    instagram: "https://instagram.com/",
    tiktok: "https://tiktok.com/@",
    snapchat: "https://snapchat.com/add/",
    x: "https://x.com/",
  }[kind];
  return base + handle;
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const liveCats = categories.filter((c) => c.count > 0);

  const socials = [
    { label: "Instagram", href: socialUrl("instagram", settings.instagram) },
    { label: "TikTok", href: socialUrl("tiktok", settings.tiktok) },
    { label: "Snapchat", href: socialUrl("snapchat", settings.snapchat) },
    { label: "X", href: socialUrl("x", settings.x) },
    {
      label: "WhatsApp",
      href: settings.whatsapp ? `https://wa.me/${settings.whatsapp.replace(/\D/g, "")}` : null,
    },
  ].filter((s): s is { label: string; href: string } => Boolean(s.href));

  const secondary: NavLink[] = [
    { href: "/account", label: "حسابي" },
    { href: "/track", label: "تتبّع طلبك" },
    { href: "/pages/shipping", label: "الشحن" },
    { href: "/pages/returns", label: "الاسترجاع" },
    { href: "/pages/contact", label: "تواصل معنا" },
  ];

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRELOADER_SCRIPT }} />
      <Preloader />
      <TransitionProvider>
        <SmoothScroll />
        <Cursor />
        <a
          href="#main"
          className="fixed start-4 top-4 z-[300] -translate-y-24 rounded-full bg-ink px-5 py-3 text-sm text-paper transition-transform focus:translate-y-0"
        >
          تخطَّ إلى المحتوى
        </a>
        <Header links={NAV} />
        <MobileMenu links={[...NAV, { href: "/track", label: "تتبّع طلبك", latin: "Track" }]} secondary={secondary} />
        <main id="main" className="relative">
          {children}
        </main>
        <Footer
          cols={[
            {
              title: "المتجر",
              links: [{ href: "/shop", label: "كل المنتجات" }, ...liveCats.map((c) => ({ href: `/c/${c.slug}`, label: c.name }))],
            },
            {
              title: "المساعدة",
              links: [
                { href: "/track", label: "تتبّع طلبك" },
                { href: "/account", label: "حسابي" },
                { href: "/pages/shipping", label: "الشحن والتوصيل" },
                { href: "/pages/returns", label: "الاستبدال والاسترجاع" },
                { href: "/pages/contact", label: "تواصل معنا" },
              ],
            },
            {
              title: "السياسات",
              links: [
                { href: "/pages/privacy", label: "سياسة الخصوصية" },
                { href: "/pages/terms", label: "شروط الخدمة" },
              ],
            },
          ]}
          info={{
            email: settings.email,
            phone: settings.phone,
            crNumber: settings.crNumber,
            vatNumber: settings.vatNumber,
            tagline: settings.tagline,
          }}
          socials={socials}
        />
        <CartDrawer />
        <SearchOverlay />
      </TransitionProvider>
      <Pixels metaPixelId={settings.metaPixelId} tiktokPixelId={settings.tiktokPixelId} />
    </>
  );
}
