"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql as dsql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orderEvents, orders, type OrderStatus } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { cancelOrder } from "@/lib/orders";
import { bool, fail, firstError, ok, str, type ActionState } from "@/lib/admin-utils";

const idSchema = z.coerce.number().int().positive();

const STATUS_NOTE: Record<Exclude<OrderStatus, "cancelled">, string> = {
  pending: "أُعيد الطلب إلى حالة «قيد المراجعة»",
  processing: "جارٍ تجهيز طلبك",
  shipped: "تم شحن طلبك",
  delivered: "تم توصيل طلبك. شكرًا لتسوقك من PUFF",
};

function refresh(id: number) {
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
}

async function loadOrder(id: number) {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateOrderStatusAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ id: idSchema, status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]) })
    .safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return fail("طلب غير صالح");
  const { id, status } = parsed.data;
  const order = await loadOrder(id);
  if (!order) return fail("الطلب غير موجود");
  if (order.status === "cancelled") return fail("الطلب ملغي ولا يمكن تغيير حالته (تمت إعادة المخزون).");
  if (order.status === status) return fail("الطلب على هذه الحالة مسبقًا");

  if (status === "cancelled") {
    const reason = str(fd, "reason");
    const done = await cancelOrder(id, reason ? `تم إلغاء الطلب: ${reason}` : "تم إلغاء الطلب", admin.email);
    refresh(id);
    return done ? ok("تم إلغاء الطلب وإعادة المخزون") : fail("تعذر إلغاء الطلب");
  }

  await db.update(orders).set({ status, updatedAt: new Date() }).where(eq(orders.id, id));
  let note = STATUS_NOTE[status];
  if (status === "shipped" && order.trackingNumber) {
    note += ` — رقم التتبع: ${order.trackingNumber}${order.trackingCarrier ? ` (${order.trackingCarrier})` : ""}`;
  }
  await db.insert(orderEvents).values({ orderId: id, type: status, note, isPublic: true, actor: admin.email });
  refresh(id);
  return ok("تم تحديث حالة الطلب");
}

const trackingSchema = z.object({
  id: idSchema,
  carrier: z.string().trim().max(80),
  number: z.string().trim().max(80),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\//i.test(v), "رابط التتبع يجب أن يبدأ بـ https://"),
});

export async function setTrackingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = trackingSchema.safeParse({
    id: fd.get("id"),
    carrier: str(fd, "carrier"),
    number: str(fd, "number"),
    url: str(fd, "url"),
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, carrier, number, url } = parsed.data;
  const order = await loadOrder(id);
  if (!order) return fail("الطلب غير موجود");
  if (order.status === "cancelled") return fail("لا يمكن إضافة تتبع لطلب ملغي");

  const markShipped = bool(fd, "markShipped") && Boolean(number) && ["pending", "processing"].includes(order.status);
  await db
    .update(orders)
    .set({
      trackingCarrier: carrier || null,
      trackingNumber: number || null,
      trackingUrl: url || null,
      ...(markShipped ? { status: "shipped" as const } : {}),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  const trackingText = number ? `رقم التتبع: ${number}${carrier ? ` (${carrier})` : ""}` : "";
  if (markShipped) {
    await db.insert(orderEvents).values({
      orderId: id,
      type: "shipped",
      note: `تم شحن طلبك — ${trackingText}`,
      isPublic: true,
      actor: admin.email,
    });
  } else if (number && (number !== order.trackingNumber || carrier !== (order.trackingCarrier ?? ""))) {
    await db.insert(orderEvents).values({
      orderId: id,
      type: "tracking",
      note: `تم تحديث معلومات الشحن — ${trackingText}`,
      isPublic: true,
      actor: admin.email,
    });
  }
  refresh(id);
  return ok(markShipped ? "تم حفظ التتبع وتحويل الطلب إلى «تم الشحن»" : "تم حفظ معلومات التتبع");
}

export async function markPaidAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(fd.get("id"));
  if (!parsed.success) return fail("طلب غير صالح");
  const id = parsed.data;
  const order = await loadOrder(id);
  if (!order) return fail("الطلب غير موجود");
  if (order.status === "cancelled") return fail("الطلب ملغي");
  if (order.paymentStatus === "paid") return fail("الطلب مدفوع مسبقًا");

  const isCod = order.paymentMethod === "cod";
  const res = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      paidAt: new Date(),
      updatedAt: new Date(),
      // الدفع الإلكتروني المؤكَّد يدويًا ينقل الطلب للتجهيز مثل تأكيد البوابة
      ...(!isCod && order.status === "pending" ? { status: "processing" as const } : {}),
    })
    .where(and(eq(orders.id, id), dsql`${orders.paymentStatus} <> 'paid'`))
    .returning({ id: orders.id });
  if (!res.length) return fail("الطلب مدفوع مسبقًا");
  await db.insert(orderEvents).values({
    orderId: id,
    type: "paid",
    note: isCod ? "تم استلام المبلغ عند التسليم" : "تم تأكيد الدفع",
    isPublic: true,
    actor: admin.email,
  });
  if (!isCod) {
    await db.insert(orderEvents).values({
      orderId: id,
      type: "note",
      note: "تأكيد الدفع تم يدويًا من لوحة التحكم (ليس عبر إشعار بوابة الدفع)",
      isPublic: false,
      actor: admin.email,
    });
  }
  refresh(id);
  return ok("تم تسجيل الطلب كمدفوع");
}

export async function markRefundedAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(fd.get("id"));
  if (!parsed.success) return fail("طلب غير صالح");
  const id = parsed.data;
  const res = await db
    .update(orders)
    .set({ paymentStatus: "refunded", updatedAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.paymentStatus, "paid")))
    .returning({ id: orders.id });
  if (!res.length) return fail("يمكن تسجيل الاسترداد للطلبات المدفوعة فقط");
  await db.insert(orderEvents).values({
    orderId: id,
    type: "refunded",
    note: "تم استرداد المبلغ",
    isPublic: true,
    actor: admin.email,
  });
  refresh(id);
  return ok("تم تسجيل الاسترداد. (تنبيه: إرجاع المبلغ الفعلي يتم من لوحة بوابة الدفع أو يدويًا)");
}

export async function addOrderNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ id: idSchema, note: z.string().trim().min(1, "اكتب نص الملاحظة").max(1000, "الملاحظة طويلة جدًا") })
    .safeParse({ id: fd.get("id"), note: str(fd, "note") });
  if (!parsed.success) return fail(firstError(parsed.error));
  const order = await loadOrder(parsed.data.id);
  if (!order) return fail("الطلب غير موجود");
  const isPublic = bool(fd, "isPublic");
  await db.insert(orderEvents).values({
    orderId: parsed.data.id,
    type: "note",
    note: parsed.data.note,
    isPublic,
    actor: admin.email,
  });
  refresh(parsed.data.id);
  return ok(isPublic ? "أُضيفت الملاحظة وستظهر للعميل في صفحة التتبع" : "أُضيفت الملاحظة الداخلية");
}

export async function saveAdminNoteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z
    .object({ id: idSchema, adminNote: z.string().trim().max(2000, "الملاحظة طويلة جدًا") })
    .safeParse({ id: fd.get("id"), adminNote: str(fd, "adminNote") });
  if (!parsed.success) return fail(firstError(parsed.error));
  await db
    .update(orders)
    .set({ adminNote: parsed.data.adminNote || null })
    .where(eq(orders.id, parsed.data.id));
  refresh(parsed.data.id);
  return ok("تم حفظ الملاحظة");
}
