"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Sparkles, Star, Trash2, X } from "lucide-react";
import { describeProduct, saveProduct } from "@/app/dashboard/products/actions";
import { Art } from "@/components/ui/Art";
import type { ProductArt, ProductOption } from "@/lib/types";
import { IconGrid } from "./IconPicker";
import { SafeForm, SafeSubmit } from "./SafeForm";

export type ProductFormValue = {
  id: number;
  name: string;
  description: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  categoryId: number | null;
  option: ProductOption | null;
  isFeatured: boolean;
  status: "active" | "hidden";
  art: ProductArt;
  images: string[];
};

const MAX_IMAGES = 6;
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const RANGE =
  "h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink [&::-moz-range-track]:bg-transparent";
const HUE_TRACK = "linear-gradient(to right, hsl(0 90% 72%), hsl(60 90% 72%), hsl(120 90% 72%), hsl(180 90% 72%), hsl(240 90% 72%), hsl(300 90% 72%), hsl(360 90% 72%))";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="dash-card p-5 md:p-6">
      <h2 className="font-display text-base font-bold">{title}</h2>
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink/55">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function ProductForm({ product, categories }: { product: ProductFormValue | null; categories: { id: number; name: string }[] }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [hue, setHue] = useState(product?.art.hue ?? 28);
  const [icon, setIcon] = useState(product?.art.icon ?? "Sparkles");
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [values, setValues] = useState<string[]>(product?.option?.values ?? []);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const addValues = (raw: string) => {
    const next = raw
      .split(/[,،\n]/)
      .map((v) => v.trim().slice(0, 30))
      .filter(Boolean);
    if (next.length) setValues((cur) => [...new Set([...cur, ...next])].slice(0, 8));
    setDraft("");
  };

  const writeWithAi = () => {
    setAiError(null);
    startAi(async () => {
      try {
        const res = await describeProduct({ name, hints: description });
        if (res.ok && res.text) setDescription(res.text);
        else setAiError(res.error ?? "ما قدرنا نكتب الوصف — جرّب مرة ثانية");
      } catch {
        setAiError("تعذّر الاتصال — تأكد من الإنترنت وجرّب مرة ثانية");
      }
    });
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    const room = MAX_IMAGES - images.length;
    const picked = [...files].slice(0, room);
    if (files.length > room) setUploadError(`الحد الأقصى ${MAX_IMAGES} صور — رفعنا أول ${room} فقط`);
    setUploading(true);
    try {
      for (const file of picked) {
        if (!TYPES.includes(file.type)) {
          setUploadError("الصيغ المقبولة: JPG أو PNG أو WebP");
          continue;
        }
        if (file.size > MAX_BYTES) {
          setUploadError(`«${file.name}» أكبر من 4 ميجابايت — صغّرها وجرّب`);
          continue;
        }
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
          setUploadError(data?.error ?? "تعذّر رفع الصورة — جرّب مرة ثانية");
          if (res.status === 503 || res.status === 401) break;
          continue;
        }
        const url = data.url;
        setImages((cur) => (cur.includes(url) || cur.length >= MAX_IMAGES ? cur : [...cur, url]));
      }
    } catch {
      setUploadError("تعذّر الاتصال — تأكد من الإنترنت وجرّب مرة ثانية");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <SafeForm action={saveProduct} resetOnSuccess={false}>
      {product && <input type="hidden" name="id" value={product.id} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <Section title="بيانات المنتج">
            <label className="block">
              <span className="dash-label">اسم المنتج</span>
              <input name="name" value={name} onChange={(e) => setName(e.target.value)} className="dash-input" required minLength={2} maxLength={80} placeholder="مثال: عطر عود ملكي 100 مل" />
            </label>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="product-description" className="dash-label !mb-0">
                  الوصف
                </label>
                <button type="button" onClick={writeWithAi} disabled={aiPending} className="dash-btn dash-btn-ghost dash-btn-sm">
                  {aiPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {aiPending ? "يكتب…" : "اكتب الوصف بالذكاء"}
                </button>
              </div>
              <textarea
                id="product-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="dash-input !min-h-32 leading-relaxed"
                maxLength={2000}
                placeholder="وش يميّز المنتج؟ اكتب كم كلمة وخلّ الذكاء يكمّل، أو اكتبه كامل بنفسك."
              />
              {aiError && (
                <p role="alert" className="mt-2 rounded-2xl bg-amber-500/15 px-4 py-2.5 text-xs font-medium leading-relaxed text-amber-900">
                  {aiError}
                </p>
              )}
            </div>
            <label className="block">
              <span className="dash-label">التصنيف</span>
              <select name="categoryId" defaultValue={product?.categoryId ?? ""} className="dash-input">
                <option value="">بدون تصنيف</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          <Section title="السعر والمخزون" hint="الأسعار بالريال وشاملة ضريبة القيمة المضافة.">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="dash-label">سعر البيع (ر.س)</span>
                <input name="price" defaultValue={product?.price ?? ""} className="dash-input num" dir="ltr" inputMode="decimal" required maxLength={12} placeholder="0" />
              </label>
              <label className="block">
                <span className="dash-label">السعر قبل الخصم</span>
                <input name="compareAtPrice" defaultValue={product?.compareAtPrice ?? ""} className="dash-input num" dir="ltr" inputMode="decimal" maxLength={12} placeholder="اختياري" />
              </label>
              <label className="block">
                <span className="dash-label">المخزون</span>
                <input name="stock" defaultValue={product?.stock ?? ""} className="dash-input num" dir="ltr" inputMode="numeric" maxLength={6} placeholder="غير محدود" />
              </label>
            </div>
            <p className="text-xs leading-relaxed text-ink/50">اترك المخزون فاضي إذا الكمية غير محدودة. السعر قبل الخصم يظهر مشطوبًا ولازم يكون أعلى من سعر البيع.</p>
          </Section>

          <Section title="خيار المنتج" hint="خيار واحد اختياري يختار منه العميل، مثل المقاس أو اللون أو الحجم (من قيمتين إلى 8).">
            <label className="block">
              <span className="dash-label">اسم الخيار</span>
              <input name="optionName" defaultValue={product?.option?.name ?? ""} className="dash-input" maxLength={30} placeholder="مثال: المقاس" />
            </label>
            <div>
              <span className="dash-label">القيم</span>
              {values.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {values.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-paper">
                      <input type="hidden" name="optionValues" value={v} />
                      {v}
                      <button type="button" onClick={() => setValues((cur) => cur.filter((x) => x !== v))} aria-label={`حذف ${v}`} className="-me-1 grid h-4 w-4 place-items-center rounded-full hover:bg-paper/20">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* ما لم يُؤكَّد بـ Enter يُرسل أيضًا مع النموذج والخادم يفصله بالفواصل */}
              <input
                name="optionValues"
                value={draft}
                onChange={(e) => (/[,،\n]/.test(e.target.value) ? addValues(e.target.value) : setDraft(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addValues(draft);
                  }
                }}
                onBlur={() => addValues(draft)}
                disabled={values.length >= 8}
                className="dash-input"
                maxLength={120}
                placeholder={values.length >= 8 ? "وصلت الحد الأقصى (8 قيم)" : "اكتب قيمة واضغط Enter أو افصل بفاصلة: صغير، وسط، كبير"}
              />
            </div>
          </Section>

          <Section title="الصور" hint={`حتى ${MAX_IMAGES} صور (JPG / PNG / WebP، 4 ميجا للصورة). أول صورة هي الرئيسية. بدون صور نعرض اللوحة الملوّنة.`}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((url, i) => (
                <div key={url} className="group relative aspect-square overflow-hidden rounded-2xl border border-ink/10 bg-ink/5">
                  <input type="hidden" name="images" value={url} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`صورة ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 ? (
                    <span className="absolute bottom-1.5 start-1.5 rounded-full bg-ink px-2 py-0.5 text-[0.65rem] font-semibold text-paper">الرئيسية</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setImages((cur) => [url, ...cur.filter((u) => u !== url)])}
                      title="اجعلها الرئيسية"
                      aria-label="اجعلها الصورة الرئيسية"
                      className="absolute bottom-1.5 start-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-ink shadow hover:bg-accent hover:text-on-accent"
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImages((cur) => cur.filter((u) => u !== url))}
                    aria-label="حذف الصورة"
                    className="absolute end-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-red-600 shadow hover:bg-red-600 hover:text-white"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid aspect-square place-items-center rounded-2xl border-[1.5px] border-dashed border-ink/25 text-ink/60 transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
                >
                  <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
                    {uploading ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
                    {uploading ? "يرفع…" : "أضف صورة"}
                  </span>
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={TYPES.join(",")} multiple hidden onChange={(e) => upload(e.target.files)} />
            {uploadError && (
              <p role="alert" className="rounded-2xl bg-amber-500/15 px-4 py-3 text-xs font-medium leading-relaxed text-amber-900">
                {uploadError}
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="اللوحة الملوّنة" hint="تظهر مكان الصورة إذا ما رفعت صور للمنتج.">
            <div className="mx-auto aspect-square w-full max-w-60 overflow-hidden rounded-3xl border border-ink/10">
              <Art art={{ hue, icon }} alt={name || "معاينة المنتج"} />
            </div>
            <label className="block">
              <span className="dash-label !flex items-center justify-between">
                درجة اللون <span className="num text-ink/50">{hue}°</span>
              </span>
              <input
                type="range"
                name="hue"
                min={0}
                max={360}
                step={1}
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                dir="ltr"
                className={RANGE}
                style={{ background: HUE_TRACK }}
              />
            </label>
            <div>
              <span className="dash-label">الأيقونة</span>
              <input type="hidden" name="icon" value={icon} />
              <div className="no-scrollbar max-h-52 overflow-y-auto rounded-2xl border border-ink/10 bg-white p-2">
                <IconGrid value={icon} onChange={setIcon} className="grid-cols-7 lg:grid-cols-6" />
              </div>
            </div>
          </Section>

          <Section title="الظهور">
            <label className="block">
              <span className="dash-label">حالة المنتج</span>
              <select name="status" defaultValue={product?.status ?? "active"} className="dash-input">
                <option value="active">ظاهر في المتجر</option>
                <option value="hidden">مخفي</option>
              </select>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink/[0.04] px-4 py-3">
              <input type="checkbox" name="isFeatured" defaultChecked={product?.isFeatured ?? false} className="mt-0.5 h-5 w-5 shrink-0 accent-ink" />
              <span>
                <span className="block text-sm font-semibold">منتج مميّز</span>
                <span className="block text-xs leading-relaxed text-ink/55">يظهر في واجهة المتجر ضمن المنتجات المختارة.</span>
              </span>
            </label>
          </Section>

          <div className="flex flex-col gap-2">
            <SafeSubmit className="dash-btn dash-btn-ink w-full" pendingText="يحفظ…">
              {product ? "حفظ التعديلات" : "أضف المنتج"}
            </SafeSubmit>
            <Link href="/dashboard/products" className="dash-btn dash-btn-ghost w-full">
              رجوع للمنتجات
            </Link>
          </div>
        </div>
      </div>
    </SafeForm>
  );
}
