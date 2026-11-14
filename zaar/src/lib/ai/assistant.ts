import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { categories, coupons, orders, products, stores, type Store } from "@/db/schema";
import { formatAmount } from "../money";
import { STATUS_LABEL } from "../orders";
import { storeBalance } from "../ledger";
import { dashboardStats } from "../stats";
import { ICONS, PALETTE_IDS, PALETTES, resolvePalette } from "../themes";
import { aiEnabled, aiModel, anthropic, fallbackParams } from "./claude";
import { localEdit } from "./local";
import { blueprintFromStore } from "../stores";

/**
 * «مساعد زار»: التاجر يدير متجره بالكلام. كل أداة مقيّدة بمتجر التاجر الحالي (storeId مثبّت من الجلسة،
 * وليس مما يكتبه النموذج)، والأدوات المتاحة لا تحذف شيئًا ولا تمس الطلبات أو الأموال.
 */

export type ChatTurn = { role: "user" | "assistant"; text: string };
export type AssistantResult = { reply: string; actions: string[] };

const sar = (h: number) => `${formatAmount(h)} ر.س`;

function tools(store: Store, actions: string[]) {
  const touch = () => revalidatePath(`/s/${store.slug}`, "layout");

  return [
    betaZodTool({
      name: "sales_report",
      description: "تقرير المبيعات والزيارات والرصيد لآخر 30 يومًا، وحالة الطلبات. استخدمه لأي سؤال عن الأداء أو الأرباح.",
      inputSchema: z.object({}),
      run: async () => {
        const [s, b] = await Promise.all([dashboardStats(store.id, 30), storeBalance(store.id)]);
        return JSON.stringify({
          today: { sales: sar(s.today.revenue), orders: s.today.orders, visits: s.today.views },
          last7days: { sales: sar(s.week.revenue), orders: s.week.orders },
          last30days: { sales: sar(s.revenue), netAfterZaarFee: sar(s.net), orders: s.ordersCount, averageOrder: sar(s.aov), conversionPercent: s.conversion },
          funnel: s.funnel,
          ordersWaitingFulfilment: s.toFulfil,
          topProducts: s.top.map((t) => ({ name: t.name, sold: t.sold })),
          wallet: { balance: sar(b.balance), nextDailyPayout: sar(b.nextPayout), inTransit: sar(b.inTransit), paidOut: sar(b.paidOut) },
        });
      },
    }),
    betaZodTool({
      name: "list_products",
      description: "قائمة منتجات المتجر (المعرّف، الاسم، السعر، المخزون، الحالة). ابحث بالاسم عبر query.",
      inputSchema: z.object({ query: z.string().nullable().describe("جزء من اسم المنتج أو null للكل") }),
      run: async ({ query }) => {
        const rows = await db
          .select({ id: products.id, name: products.name, price: products.price, stock: products.stock, status: products.status, sold: products.sold })
          .from(products)
          .where(and(eq(products.storeId, store.id), query ? ilike(products.name, `%${query.replace(/[%_\\]/g, "")}%`) : undefined))
          .orderBy(asc(products.position))
          .limit(60);
        return JSON.stringify(rows.map((r) => ({ ...r, price: r.price / 100, stock: r.stock ?? "غير محدود" })));
      },
    }),
    betaZodTool({
      name: "add_product",
      description: "يضيف منتجًا جديدًا للمتجر. السعر بالريال شامل الضريبة.",
      inputSchema: z.object({
        name: z.string(),
        description: z.string().describe("وصف تسويقي من جملتين إلى ثلاث"),
        price: z.number(),
        compareAtPrice: z.number().nullable(),
        category: z.string().nullable().describe("اسم تصنيف موجود، أو null"),
        icon: z.enum(ICONS),
        hue: z.number().describe("درجة اللون 0-360"),
        stock: z.number().nullable().describe("الكمية أو null لمخزون غير محدود"),
      }),
      run: async (p) => {
        const price = Math.round(Math.max(1, Math.min(100000, p.price)) * 100);
        const cats = await db.select().from(categories).where(eq(categories.storeId, store.id));
        const cat = cats.find((c) => c.name === p.category) ?? null;
        const existing = await db.select({ slug: products.slug }).from(products).where(eq(products.storeId, store.id));
        const used = new Set(existing.map((e) => e.slug));
        let n = existing.length + 1;
        while (used.has(`p-${n}`)) n++;
        const [row] = await db
          .insert(products)
          .values({
            storeId: store.id,
            categoryId: cat?.id ?? null,
            slug: `p-${n}`,
            name: p.name.trim().slice(0, 90),
            description: p.description.trim().slice(0, 600),
            price,
            compareAtPrice: p.compareAtPrice && p.compareAtPrice * 100 > price ? Math.round(p.compareAtPrice * 100) : null,
            stock: p.stock === null ? null : Math.max(0, Math.round(p.stock)),
            art: { hue: ((Math.round(p.hue) % 360) + 360) % 360, icon: p.icon },
            position: existing.length,
          })
          .returning({ id: products.id, name: products.name });
        actions.push(`أُضيف المنتج «${row.name}» بسعر ${sar(price)}`);
        touch();
        return JSON.stringify({ ok: true, id: row.id });
      },
    }),
    betaZodTool({
      name: "update_product",
      description: "يعدّل منتجًا موجودًا بمعرّفه. أرسل فقط الحقول المراد تغييرها واترك الباقي null.",
      inputSchema: z.object({
        id: z.number(),
        name: z.string().nullable(),
        description: z.string().nullable(),
        price: z.number().nullable(),
        compareAtPrice: z.number().nullable(),
        stock: z.number().nullable(),
        status: z.enum(["active", "hidden"]).nullable(),
        featured: z.boolean().nullable(),
      }),
      run: async (p) => {
        const patch: Partial<typeof products.$inferInsert> = {};
        if (p.name) patch.name = p.name.trim().slice(0, 90);
        if (p.description) patch.description = p.description.trim().slice(0, 600);
        if (p.price !== null) patch.price = Math.round(Math.max(1, Math.min(100000, p.price)) * 100);
        if (p.compareAtPrice !== null) patch.compareAtPrice = p.compareAtPrice > 0 ? Math.round(p.compareAtPrice * 100) : null;
        if (p.stock !== null) patch.stock = Math.max(0, Math.round(p.stock));
        if (p.status) patch.status = p.status;
        if (p.featured !== null) patch.isFeatured = p.featured;
        if (!Object.keys(patch).length) return JSON.stringify({ ok: false, error: "لا يوجد تغيير" });
        const rows = await db
          .update(products)
          .set(patch)
          .where(and(eq(products.id, p.id), eq(products.storeId, store.id)))
          .returning({ name: products.name });
        if (!rows.length) return JSON.stringify({ ok: false, error: "المنتج غير موجود" });
        actions.push(`عُدّل المنتج «${rows[0].name}»`);
        touch();
        return JSON.stringify({ ok: true });
      },
    }),
    betaZodTool({
      name: "create_coupon",
      description: "ينشئ كوبون خصم. type: percent (value نسبة 1-90)، fixed (value مبلغ بالريال)، free_shipping (value صفر).",
      inputSchema: z.object({
        code: z.string().describe("أحرف لاتينية كبيرة وأرقام، 3-20"),
        type: z.enum(["percent", "fixed", "free_shipping"]),
        value: z.number(),
        minSubtotal: z.number().describe("أقل مبلغ للسلة بالريال، أو 0"),
        maxUses: z.number().nullable(),
      }),
      run: async (c) => {
        const code = c.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
        if (code.length < 3) return JSON.stringify({ ok: false, error: "الكود قصير" });
        const value = c.type === "percent" ? Math.max(1, Math.min(90, Math.round(c.value))) : c.type === "fixed" ? Math.round(Math.max(1, c.value) * 100) : 0;
        const rows = await db
          .insert(coupons)
          .values({ storeId: store.id, code, type: c.type, value, minSubtotal: Math.round(Math.max(0, c.minSubtotal) * 100), maxUses: c.maxUses && c.maxUses > 0 ? Math.round(c.maxUses) : null })
          .onConflictDoNothing({ target: [coupons.storeId, coupons.code] })
          .returning({ id: coupons.id });
        if (!rows.length) return JSON.stringify({ ok: false, error: "يوجد كوبون بنفس الكود" });
        actions.push(`أُنشئ الكوبون ${code}`);
        return JSON.stringify({ ok: true, code });
      },
    }),
    betaZodTool({
      name: "update_design",
      description: "يغيّر تصميم المتجر ونصوص الواجهة. أرسل فقط ما يراد تغييره واترك الباقي null. theme: bold جريء أو soft ناعم.",
      inputSchema: z.object({
        theme: z.enum(["bold", "soft"]).nullable(),
        palette: z.enum(PALETTE_IDS as [string, ...string[]]).nullable().describe(Object.entries(PALETTES).map(([k, v]) => `${k}=${v.name}`).join("، ")),
        announcement: z.string().nullable().describe("نص شريط الإعلان العلوي"),
        headline: z.array(z.string()).nullable().describe("ثلاث كلمات قصيرة للعنوان الافتتاحي"),
        heroText: z.string().nullable(),
        tagline: z.string().nullable(),
      }),
      run: async (d) => {
        const [fresh] = await db.select().from(stores).where(eq(stores.id, store.id)).limit(1);
        const theme = d.theme ?? fresh.theme;
        const content = { ...fresh.content };
        if (d.announcement !== null) content.announcement = d.announcement.trim().slice(0, 90);
        if (d.headline?.length) content.headline = d.headline.map((h) => h.trim().slice(0, 18)).filter(Boolean).slice(0, 3);
        if (d.heroText) content.heroText = d.heroText.trim().slice(0, 180);
        await db
          .update(stores)
          .set({
            theme,
            palette: d.palette || d.theme ? resolvePalette(d.palette ?? fresh.palette.preset, theme) : fresh.palette,
            content,
            ...(d.tagline ? { tagline: d.tagline.trim().slice(0, 90) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(stores.id, store.id));
        actions.push("حُدّث تصميم المتجر");
        touch();
        return JSON.stringify({ ok: true });
      },
    }),
    betaZodTool({
      name: "recent_orders",
      description: "آخر الطلبات مع حالتها ومبلغها.",
      inputSchema: z.object({ limit: z.number().describe("عدد الطلبات، 1-20") }),
      run: async ({ limit }) => {
        const rows = await db
          .select({ number: orders.number, status: orders.status, total: orders.total, customer: orders.customerName, city: orders.city, createdAt: orders.createdAt })
          .from(orders)
          .where(eq(orders.storeId, store.id))
          .orderBy(desc(orders.id))
          .limit(Math.max(1, Math.min(20, Math.round(limit))));
        return JSON.stringify(rows.map((r) => ({ ...r, status: STATUS_LABEL[r.status], total: sar(r.total), createdAt: r.createdAt.toISOString().slice(0, 16) })));
      },
    }),
  ];
}

const system = (store: Store) => `أنت «مساعد زار» داخل لوحة تحكم متجر «${store.name}» على منصة زار للتجارة الإلكترونية في السعودية (مجال المتجر: ${store.vertical}).
تخاطب صاحب المتجر مباشرة، وهو غالبًا بلا خبرة تقنية. نفّذ ما يطلبه بالأدوات المتاحة ثم أخبره بما تم في جملة أو جملتين بلهجة سعودية بيضاء واضحة، بلا قوائم طويلة ولا مصطلحات تقنية.
- عند تعديل منتج بالاسم: ابحث عنه أولًا بـ list_products لتحصل على معرّفه.
- عند إضافة منتجات: اكتب لها أوصافًا واقعية واختر أيقونة ودرجة لون مناسبة، بأسعار منطقية للسوق السعودي إن لم يحدد السعر.
- أسئلة الأداء والأرباح: استخدم sales_report واذكر الأرقام كما هي، ولا تخمّن رقمًا غير موجود.
- ما لا تملك له أداة (حذف منتجات، استرداد طلبات، تغيير الآيبان، شحن الطلبات): دلّه على القسم المناسب في القائمة الجانبية بدل المحاولة.
- معلومات المنصة: الأرباح تُحوَّل يوميًا إلى آيبان التاجر، وكل طلب مشمول بضمان زار (استرداد كامل للعميل).`;

export async function runAssistant(store: Store, history: ChatTurn[]): Promise<AssistantResult> {
  const actions: string[] = [];
  const last = history[history.length - 1]?.text ?? "";
  if (!aiEnabled()) return localAssistant(store, last, actions);

  const messages: Anthropic.Beta.BetaMessageParam[] = history.slice(-12).map((t) => ({ role: t.role, content: t.text.slice(0, 4000) }));
  try {
    const final = await anthropic().beta.messages.toolRunner({
      model: aiModel(),
      max_tokens: 16000,
      system: system(store),
      tools: tools(store, actions),
      messages,
      max_iterations: 8,
      // الحلقة قصيرة، فنرسل المحادثة كاملة كل مرة بدل الاعتماد على ميزة message threads التجريبية
      thread: false,
      output_config: { effort: "low" },
      ...fallbackParams(),
    });
    if (final.stop_reason === "refusal") return { reply: "ما أقدر أساعد في هذا الطلب. جرّب تصيغه بشكل ثاني.", actions };
    const reply = final.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return { reply: reply || (actions.length ? "تم." : "ما قدرت أكمل الطلب، جرّب مرة ثانية."), actions };
  } catch (e) {
    console.error("[assistant]", e);
    if (e instanceof Anthropic.RateLimitError) return { reply: "المساعد مشغول حاليًا. جرّب بعد دقيقة.", actions };
    return { reply: actions.length ? "نفّذت جزءًا من طلبك ثم انقطع الاتصال. راجع التغييرات وجرّب الباقي مرة ثانية." : "تعذّر الاتصال بالمساعد. جرّب مرة ثانية.", actions };
  }
}

/** بدون مفتاح الذكاء: أوامر محدودة تُفهم بالكلمات المفتاحية */
async function localAssistant(store: Store, text: string, actions: string[]): Promise<AssistantResult> {
  if (/مبيعات|أرباح|ارباح|رصيد|كم بعت|تقرير|طلبات/.test(text)) {
    const [s, b] = await Promise.all([dashboardStats(store.id, 30), storeBalance(store.id)]);
    return {
      reply: `اليوم: ${sar(s.today.revenue)} من ${s.today.orders} طلب. آخر 30 يومًا: ${sar(s.revenue)} من ${s.ordersCount} طلب. رصيدك الحالي ${sar(b.balance)}، وتحويل الغد ${sar(b.nextPayout)}. عندك ${s.toFulfil} طلب بانتظار التجهيز.`,
      actions,
    };
  }
  const coupon = text.match(/كوبون.*?(\d{1,2})\s*[%٪]/);
  if (coupon) {
    const code = `ZAAR${coupon[1]}`;
    const rows = await db
      .insert(coupons)
      .values({ storeId: store.id, code, type: "percent", value: Math.min(90, Number(coupon[1])) })
      .onConflictDoNothing({ target: [coupons.storeId, coupons.code] })
      .returning({ id: coupons.id });
    if (rows.length) actions.push(`أُنشئ الكوبون ${code}`);
    return { reply: rows.length ? `سوّيت لك كوبون ${code} بخصم ${coupon[1]}%. تقدر تعدّله من قسم الكوبونات.` : `الكوبون ${code} موجود من قبل.`, actions };
  }
  const current = await blueprintFromStore(store);
  const edited = localEdit(current, text);
  const changed = edited.theme !== current.theme || edited.palette !== current.palette || edited.announcement !== current.announcement;
  if (changed) {
    await db
      .update(stores)
      .set({ theme: edited.theme, palette: resolvePalette(edited.palette, edited.theme), content: { ...store.content, announcement: edited.announcement }, updatedAt: new Date() })
      .where(eq(stores.id, store.id));
    actions.push("حُدّث تصميم المتجر");
    revalidatePath(`/s/${store.slug}`, "layout");
    return { reply: edited.reply, actions };
  }
  return {
    reply: "أقدر الآن أعطيك تقرير مبيعاتك، أسوي كوبون خصم (مثال: «كوبون 10%»)، أو أغيّر الثيم والألوان وشريط الإعلان. باقي التعديلات تلقاها في أقسام اللوحة.",
    actions,
  };
}
