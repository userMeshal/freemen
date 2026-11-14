import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAdmin, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function json(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

/** يتحقق من توقيع الملف (magic bytes) حتى لا نثق بنوع المحتوى المرسل من المتصفح فقط */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(4, 8).toString("ascii") === "ftyp" && /avif|avis/.test(buf.subarray(8, 32).toString("ascii"))) return "image/avif";
  return null;
}

export async function POST(req: Request) {
  if (!(await sameOrigin())) return json("طلب غير مسموح", 403);
  const admin = await getAdmin();
  if (!admin) return json("غير مصرح", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json("تعذر قراءة الملف", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return json("لم يتم إرفاق ملف", 400);
  if (file.size <= 0) return json("الملف فارغ", 400);
  if (file.size > MAX_BYTES) return json("حجم الصورة يتجاوز 5 ميجابايت", 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type || !TYPES[type]) return json("الصيغ المسموحة: JPG, PNG, WebP, AVIF", 415);
  const ext = TYPES[type];
  const name = `${Date.now().toString(36)}-${randomBytes(8).toString("hex")}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`products/${name}`, buf, { access: "public", contentType: type, addRandomSuffix: false });
      return NextResponse.json({ ok: true, url: blob.url });
    } catch (e) {
      console.error("blob upload failed", e);
      return json("تعذر رفع الصورة إلى التخزين. تحقق من إعداد Vercel Blob.", 502);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);
    return NextResponse.json({ ok: true, url: `/uploads/${name}` });
  }

  return json(
    "رفع الصور غير مفعّل: أضف متغير البيئة BLOB_READ_WRITE_TOKEN (من Vercel ← Storage ← Blob) ثم أعد النشر.",
    501,
  );
}
