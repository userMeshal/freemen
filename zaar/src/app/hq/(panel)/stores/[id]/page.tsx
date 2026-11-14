import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { ArrowRight, ExternalLink } from "lucide-react";
import { db } from "@/db";
import { merchants, orders, payouts, products, stores } from "@/db/schema";
import { ActionButton, CopyButton } from "@/components/dash/client";
import { Badge, Card, Money, ORDER_TONE, PageHead, Stat, TableWrap, fmtDate } from "@/components/dash/ui";
import { Note, Row } from "@/components/dash/hq/ui";
import { LEDGER_LABEL, PAYOUT_STATUS, STORE_STATUS, THEME_LABEL, prettyIban } from "@/components/dash/hq/util";
import { requireHq } from "@/lib/auth";
import { recentLedger, storeBalance } from "@/lib/ledger";
import { formatAmount } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/orders";
import { storePublicUrl } from "@/lib/stores";
import { deleteDraftStore, suspendStore, unsuspendStore } from "../actions";

export const metadata = { title: "تفاصيل المتجر" };

export default async function HqStorePage({ params }: { params: Promise<{ id: string }> }) {
  await requireHq();
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [row] = await db
    .select({ store: stores, merchant: merchants })
    .from(stores)
    .leftJoin(merchants, eq(merchants.id, stores.merchantId))
    .where(eq(stores.id, id))
    .limit(1);
  if (!row) notFound();
  const { store, merchant } = row;

  const [balance, ledgerRows, payoutRows, orderRows, [productCount]] = await Promise.all([
    storeBalance(store.id),
    recentLedger(store.id),
    db.select().from(payouts).where(eq(payouts.storeId, store.id)).orderBy(desc(payouts.id)).limit(30),
    db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        total: orders.total,
        platformFee: orders.platformFee,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .orderBy(desc(orders.id))
      .limit(20),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.storeId, store.id)),
  ]);

  const url = storePublicUrl(store.slug);
  const st = STORE_STATUS[store.status];
  const canSuspend = store.merchantId !== null && store.status === "live";
  const canUnsuspend = store.merchantId !== null && store.status === "suspended";
  const canDelete = store.merchantId === null && store.status === "draft" && store.createdAt.getTime() < Date.now() - 24 * 3600 * 1000;

  return (
    <>
      <Link href="/hq/stores" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink/60 hover:text-ink">
        <ArrowRight size={14} /> كل المتاجر
      </Link>

      <PageHead title={store.name} sub={store.tagline || undefined}>
        <Badge tone={st.tone}>{st.label}</Badge>
        <a href={url} target="_blank" rel="noopener noreferrer" className="dash-btn dash-btn-ghost dash-btn-sm">
          <ExternalLink size={14} /> فتح المتجر
        </a>
        {canSuspend && (
          <ActionButton
            action={suspendStore}
            fields={{ id: store.id }}
            className="dash-btn dash-btn-danger dash-btn-sm"
            confirm={`إيقاف متجر «${store.name}»؟ يُحجب عن العملاء ولا تُنشأ له تحويلات حتى تعيد تفعيله.`}
          >
            إيقاف المتجر
          </ActionButton>
        )}
        {canUnsuspend && (
          <ActionButton action={unsuspendStore} fields={{ id: store.id }} className="dash-btn dash-btn-ink dash-btn-sm" confirm={`إعادة تفعيل متجر «${store.name}»؟`}>
            إعادة التفعيل
          </ActionButton>
        )}
        {canDelete && (
          <ActionButton
            action={deleteDraftStore}
            fields={{ id: store.id }}
            className="dash-btn dash-btn-danger dash-btn-sm"
            confirm={`حذف مسودة «${store.name}» نهائيًا مع منتجاتها؟ لا يمكن التراجع.`}
          >
            حذف المسودة
          </ActionButton>
        )}
      </PageHead>

      {store.status === "suspended" && (
        <Note tone="bad">هذا المتجر موقوف: محجوب عن العملاء، ولا تُنشأ له تحويلات يومية. رصيده يبقى محفوظًا ويدخل في أول تسوية بعد إعادة التفعيل.</Note>
      )}
      {store.merchantId === null && (
        <Note>مسودة أنشأها مساعد البناء ولم يستلمها أي تاجر بعد. {canDelete ? "يمكن حذفها لأنها أقدم من يوم." : "يمكن حذفها بعد مرور يوم على إنشائها."}</Note>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat accent label="الرصيد غير المحوّل" value={formatAmount(balance.balance)} hint="ر.س · كل الحركات التي لم تدخل في تحويل" />
        <Stat label="يدخل في التحويل القادم" value={formatAmount(balance.nextPayout)} hint="ر.س" />
        <Stat label="تحويلات بانتظار التنفيذ" value={formatAmount(balance.inTransit)} hint="ر.س" />
        <Stat label="إجمالي ما حُوِّل للتاجر" value={formatAmount(balance.paidOut)} hint="ر.س" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="المتجر">
          <dl>
            <Row label="الرابط">
              <a href={url} target="_blank" rel="noopener noreferrer" className="num underline underline-offset-4">
                {store.slug}
              </a>
            </Row>
            <Row label="المجال">{store.vertical}</Row>
            <Row label="الثيم">{THEME_LABEL[store.theme] ?? store.theme}</Row>
            <Row label="المنتجات">
              <span className="num">{productCount.n}</span>
            </Row>
            <Row label="تاريخ الإنشاء">{fmtDate(store.createdAt, true)}</Row>
            <Row label="آخر تحديث">{fmtDate(store.updatedAt, true)}</Row>
          </dl>
          {store.idea && (
            <div className="mt-3 rounded-2xl bg-ink/[0.04] p-3.5">
              <p className="text-xs font-semibold text-ink/55">الفكرة كما كتبها التاجر</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{store.idea}</p>
            </div>
          )}
        </Card>

        <Card title="التاجر">
          {merchant ? (
            <dl>
              <Row label="الاسم">{merchant.name}</Row>
              <Row label="الجوال">
                <a href={`tel:${merchant.phone}`} className="num underline underline-offset-4">
                  {merchant.phone}
                </a>
              </Row>
              <Row label="البريد">{merchant.email ? <span className="num">{merchant.email}</span> : "—"}</Row>
              <Row label="تاريخ التسجيل">{fmtDate(merchant.createdAt)}</Row>
            </dl>
          ) : (
            <p className="text-sm leading-relaxed text-ink/55">لا يوجد تاجر مربوط بهذا المتجر.</p>
          )}
        </Card>

        <Card title="الحساب البنكي">
          {store.iban ? (
            <>
              <dl>
                <Row label="صاحب الحساب">{store.bankHolder || "—"}</Row>
                <Row label="البنك">{store.bankName || "—"}</Row>
                <Row label="الآيبان">
                  <span className="num text-[0.82rem]">{prettyIban(store.iban)}</span>
                </Row>
              </dl>
              <div className="mt-3">
                <CopyButton value={store.iban} label="نسخ الآيبان" />
              </div>
            </>
          ) : merchant ? (
            <p className="rounded-2xl bg-amber-500/15 px-4 py-3 text-sm leading-relaxed text-amber-900">
              لم يُضف التاجر رقم الآيبان، فلن تُنشأ له تحويلات حتى يضيفه من لوحته.
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-ink/55">لا يوجد حساب بنكي — المتجر مسودة بلا تاجر.</p>
          )}
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-bold">التحويلات</h2>
        {payoutRows.length === 0 ? (
          <p className="dash-card px-5 py-8 text-center text-sm text-ink/55">لا توجد تحويلات لهذا المتجر بعد.</p>
        ) : (
          <TableWrap>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>يوم التسوية</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>الطلبات</th>
                  <th>الآيبان</th>
                  <th>المرجع / السبب</th>
                  <th>وقت التحويل</th>
                </tr>
              </thead>
              <tbody>
                {payoutRows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{fmtDate(p.day)}</td>
                    <td>
                      <Money value={p.amount} />
                    </td>
                    <td>
                      <Badge tone={PAYOUT_STATUS[p.status].tone}>{PAYOUT_STATUS[p.status].label}</Badge>
                    </td>
                    <td>
                      <span className="num">{p.ordersCount}</span>
                    </td>
                    <td>
                      <span className="num text-xs">{p.iban}</span>
                    </td>
                    <td className="max-w-[14rem] break-words text-xs">{p.reference || "—"}</td>
                    <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(p.sentAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-bold">آخر حركات المحفظة</h2>
        {ledgerRows.length === 0 ? (
          <p className="dash-card px-5 py-8 text-center text-sm text-ink/55">لا توجد حركات مالية بعد.</p>
        ) : (
          <TableWrap>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>المبلغ</th>
                  <th>الطلب</th>
                  <th>البيان</th>
                  <th>التحويل</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(l.createdAt, true)}</td>
                    <td className="whitespace-nowrap">{LEDGER_LABEL[l.type] ?? l.type}</td>
                    <td>
                      <span className={`num whitespace-nowrap font-semibold ${l.amount < 0 ? "text-red-700" : "text-emerald-700"}`}>
                        {l.amount < 0 ? "−" : "+"}
                        {formatAmount(Math.abs(l.amount))}
                      </span>
                    </td>
                    <td>{l.orderNumber ? <span className="num">{l.orderNumber}</span> : "—"}</td>
                    <td className="max-w-[16rem] break-words text-xs text-ink/70">{l.note || "—"}</td>
                    <td>{l.payoutId ? <span className="num text-xs">#{l.payoutId}</span> : <Badge>غير محوّل</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-display text-base font-bold">آخر 20 طلبًا</h2>
        {orderRows.length === 0 ? (
          <p className="dash-card px-5 py-8 text-center text-sm text-ink/55">لا توجد طلبات لهذا المتجر بعد.</p>
        ) : (
          <TableWrap>
            <table className="dash-table">
              <thead>
                <tr>
                  <th>الطلب</th>
                  <th>العميل</th>
                  <th>المبلغ</th>
                  <th>عمولة زار</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <span className="num font-semibold">{o.number}</span>
                    </td>
                    <td>
                      <span className="block whitespace-nowrap">{o.customerName}</span>
                      <span className="num block text-xs text-ink/55">{o.customerPhone}</span>
                    </td>
                    <td>
                      <Money value={o.total} />
                    </td>
                    <td>
                      <Money value={o.platformFee} className="text-ink/70" />
                    </td>
                    <td>
                      <Badge tone={ORDER_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink/60">{fmtDate(o.createdAt, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </section>
    </>
  );
}
