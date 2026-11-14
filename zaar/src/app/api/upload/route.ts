import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { merchantStore, sameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024;

const json = (error: string, status: number) => NextResponse.json({ error }, { status });

/** نوع الصورة من بايتاتها الأولى — لا نثق بالامتداد ولا بالنوع الذي يرسله المتصفح */
function sniff(b: Uint8Array): { ext: string; type: string } | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return { ext: "png", type: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  return null;
}

export async function POST(req: Request) {
  if (!(await sameOrigin())) return json("طلب غير مسموح", 403);
  const ctx = await merchantStore();
  if (!ctx) return json("سجّل دخولك من جديد", 401);
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json("رفع الصور يحتاج ربط مخزن الصور (Vercel Blob) بالمنصة، وهو غير مربوط حاليًا. تقدر تحفظ المنتج بدون صور وتظهر له اللوحة الملوّنة.", 503);
  }
  if (!(await rateLimit(`upload:${ctx.store.id}`, 120, 3600))) return json("رفعت صور كثير هالساعة — جرّب بعد شوي", 429);

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES + 64 * 1024) return json("حجم الصورة أكبر من 4 ميجابايت", 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return json("تعذّر قراءة الملف", 400);
  }
  if (!(file instanceof File) || file.size === 0) return json("اختر صورة للرفع", 400);
  if (file.size > MAX_BYTES) return json("حجم الصورة أكبر من 4 ميجابايت", 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return json("الصيغ المقبولة: JPG أو PNG أو WebP", 415);

  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return json("الملف ليس صورة صالحة (JPG أو PNG أو WebP)", 415);

  try {
    const blob = await put(`stores/${ctx.store.id}/${randomBytes(12).toString("hex")}.${kind.ext}`, bytes, { access: "public", contentType: kind.type });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    console.error("[upload] blob put failed", e);
    return json("تعذّر رفع الصورة الآن — جرّب بعد لحظات", 502);
  }
}
