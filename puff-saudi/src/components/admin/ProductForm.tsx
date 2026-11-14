/* eslint-disable @next/next/no-img-element */
"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import type { ActionState, AdminAction } from "@/lib/admin-utils";
import { FAMILY_OPTIONS } from "@/lib/admin-utils";
import { btnCls, Card, Checkbox, Field, Input, inputCls, Select, Textarea } from "./ui";
import { ActionForm, ConfirmButton, Flash, SubmitButton } from "./client";

export type ProductFormImage = { id?: number; key: string; url: string; bg: string; accent: string };
export type ProductFormVariant = {
  id?: number;
  key: string;
  sku: string;
  optionValue: string;
  price: string;
  compareAt: string;
  stock: string;
  isActive: boolean;
  imageKey: string | null;
};
export type ProductFormData = {
  id?: number;
  name: string;
  slug: string;
  family: string;
  capacityMl: string;
  colorName: string;
  optionName: string;
  descriptionHtml: string;
  metaDescription: string;
  status: "active" | "draft";
  isBestSeller: boolean;
  position: string;
  categoryIds: number[];
  images: ProductFormImage[];
  variants: ProductFormVariant[];
};

let counter = 0;
const newKey = (p: string) => `${p}-${Date.now().toString(36)}-${counter++}`;

function toHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/** يستخرج لون الخلفية (من أطراف الصورة) ولون المنتج (من وسطها) لملف مرفوع */
async function sampleColors(file: File): Promise<{ bg: string; accent: string } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(bmp, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const px = (x: number, y: number) => {
      const i = (y * size + x) * 4;
      return [data[i], data[i + 1], data[i + 2]] as const;
    };
    const edge: (readonly [number, number, number])[] = [];
    for (let i = 0; i < size; i += 2) edge.push(px(i, 1), px(i, size - 2), px(1, i), px(size - 2, i));
    const med = [0, 1, 2].map((c) => edge.map((e) => e[c]).sort((a, b) => a - b)[Math.floor(edge.length / 2)]);
    const center: (readonly [number, number, number])[] = [];
    for (let x = Math.floor(size * 0.3); x < size * 0.7; x++)
      for (let y = Math.floor(size * 0.3); y < size * 0.8; y++) {
        const c = px(x, y);
        if (Math.abs(c[0] - med[0]) + Math.abs(c[1] - med[1]) + Math.abs(c[2] - med[2]) > 60) center.push(c);
      }
    const acc = center.length ? [0, 1, 2].map((c) => center.reduce((s, e) => s + e[c], 0) / center.length) : med;
    return { bg: toHex(med[0], med[1], med[2]), accent: toHex(acc[0], acc[1], acc[2]) };
  } catch {
    return null;
  }
}

export function ProductForm({
  initial,
  categories,
  saveAction,
  deleteAction,
  bulkStockAction,
  justSaved,
}: {
  initial: ProductFormData;
  categories: { id: number; name: string }[];
  saveAction: AdminAction;
  deleteAction?: AdminAction;
  bulkStockAction?: AdminAction;
  justSaved?: boolean;
}) {
  const [f, setF] = useState<ProductFormData>(initial);
  const [state, formAction] = useActionState<ActionState, FormData>(saveAction, null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => setF((p) => ({ ...p, [key]: value }));
  const setVariant = (key: string, patch: Partial<ProductFormVariant>) =>
    setF((p) => ({ ...p, variants: p.variants.map((v) => (v.key === key ? { ...v, ...patch } : v)) }));
  const setImage = (key: string, patch: Partial<ProductFormImage>) =>
    setF((p) => ({ ...p, images: p.images.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  function addVariant() {
    setF((p) => {
      const last = p.variants[p.variants.length - 1];
      return {
        ...p,
        variants: [
          ...p.variants,
          {
            key: newKey("v"),
            sku: "",
            optionValue: "",
            price: last?.price ?? "",
            compareAt: last?.compareAt ?? "",
            stock: "",
            isActive: true,
            imageKey: null,
          },
        ],
      };
    });
  }

  function removeVariant(key: string) {
    setF((p) => (p.variants.length <= 1 ? p : { ...p, variants: p.variants.filter((v) => v.key !== key) }));
  }

  function moveImage(index: number, dir: -1 | 1) {
    setF((p) => {
      const next = [...p.images];
      const j = index + dir;
      if (j < 0 || j >= next.length) return p;
      [next[index], next[j]] = [next[j], next[index]];
      return { ...p, images: next };
    });
  }

  function removeImage(key: string) {
    setF((p) => ({
      ...p,
      images: p.images.filter((i) => i.key !== key),
      variants: p.variants.map((v) => (v.imageKey === key ? { ...v, imageKey: null } : v)),
    }));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 12)) {
        if (file.size > 5 * 1024 * 1024) {
          setUploadError(`«${file.name}» أكبر من 5 ميجابايت`);
          continue;
        }
        const colors = await sampleColors(file);
        const body = new FormData();
        body.set("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; message?: string } | null;
        if (!res.ok || !json?.url) {
          setUploadError(json?.message ?? "تعذر رفع الصورة");
          continue;
        }
        const url = json.url;
        setF((p) => ({
          ...p,
          images: [...p.images, { key: newKey("img"), url, bg: colors?.bg ?? "#F5F1E8", accent: colors?.accent ?? "#0B0B0C" }],
        }));
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addUrl() {
    const url = urlInput.trim();
    if (!url) return;
    const allowed =
      /^\/(media|uploads)\/[\w\-./%]+$/.test(url) || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url);
    if (!allowed) {
      setUploadError("الرابط غير مسموح: استخدم مسارًا داخل الموقع (‎/media/...) أو رابط Vercel Blob، أو ارفع الصورة مباشرة.");
      return;
    }
    setUploadError(null);
    setF((p) => ({ ...p, images: [...p.images, { key: newKey("img"), url, bg: "#F5F1E8", accent: "#0B0B0C" }] }));
    setUrlInput("");
  }

  function submit() {
    const payload = {
      ...f,
      images: f.images.map(({ id, key, url, bg, accent }) => ({ id, key, url, bg, accent })),
      variants: f.variants.map(({ id, sku, optionValue, price, compareAt, stock, isActive, imageKey }) => ({
        id,
        sku,
        optionValue,
        price,
        compareAt,
        stock,
        isActive,
        imageKey,
      })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(() => formAction(fd));
  }

  const multi = f.variants.length > 1;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card title="المعلومات الأساسية">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="اسم المنتج" className="md:col-span-2">
              <Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={200} required />
            </Field>
            <Field label="الرابط (slug)" hint="يُولَّد تلقائيًا من الاسم إذا تُرك فارغًا. يظهر في رابط صفحة المنتج ‎/p/…">
              <Input dir="ltr" value={f.slug} onChange={(e) => set("slug", e.target.value)} maxLength={200} />
            </Field>
            <Field label="العائلة">
              <Select value={f.family} onChange={(e) => set("family", e.target.value)}>
                {FAMILY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="السعة (مل)">
              <Input inputMode="numeric" dir="ltr" value={f.capacityMl} onChange={(e) => set("capacityMl", e.target.value)} placeholder="350" />
            </Field>
            <Field label="اسم اللون / التشطيب" hint="للمنتجات بلون واحد">
              <Input value={f.colorName} onChange={(e) => set("colorName", e.target.value)} maxLength={120} />
            </Field>
            <Field label="الوصف" className="md:col-span-2" hint="يدعم وسوم HTML البسيطة: ‎<p> <strong> <ul> <li> <h3> <br>‎ — يُنظَّف تلقائيًا عند الحفظ">
              <Textarea dir="auto" rows={8} value={f.descriptionHtml} onChange={(e) => set("descriptionHtml", e.target.value)} />
            </Field>
            <Field label="وصف محركات البحث (Meta description)" className="md:col-span-2">
              <Textarea rows={2} value={f.metaDescription} onChange={(e) => set("metaDescription", e.target.value)} maxLength={400} />
            </Field>
          </div>
        </Card>

        <Card title={`الصور (${f.images.length})`}>
          {f.images.length ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {f.images.map((img, i) => (
                <li key={img.key} className="flex gap-3 rounded-xl border border-line p-3">
                  <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-line" style={{ background: img.bg }}>
                    <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-semibold text-ink-mute">
                        {i === 0 ? "الرئيسية" : `#${i + 1}`}
                      </span>
                      <button type="button" className={btnCls("ghost", "sm")} onClick={() => moveImage(i, -1)} disabled={i === 0} aria-label="تحريك للأعلى">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className={btnCls("ghost", "sm")}
                        onClick={() => moveImage(i, 1)}
                        disabled={i === f.images.length - 1}
                        aria-label="تحريك للأسفل"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className={btnCls("danger", "sm") + " ms-auto"} onClick={() => removeImage(img.key)} aria-label="حذف الصورة">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-ink-mute">
                      <label className="inline-flex items-center gap-1.5">
                        خلفية
                        <input type="color" value={img.bg} onChange={(e) => setImage(img.key, { bg: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-white p-0.5" />
                      </label>
                      <label className="inline-flex items-center gap-1.5">
                        لون المنتج
                        <input type="color" value={img.accent} onChange={(e) => setImage(img.key, { accent: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-line bg-white p-0.5" />
                      </label>
                    </div>
                    <div className="truncate font-mono text-[10px] text-ink-mute/70" dir="ltr">
                      {img.url}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-mute">لا توجد صور بعد. أضف صورة واحدة على الأقل ليظهر المنتج بشكل صحيح.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              className="hidden"
              onChange={(e) => onFiles(e.target.files)}
            />
            <button type="button" className={btnCls("dark")} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {uploading ? "جارٍ الرفع…" : "رفع صور"}
            </button>
            <div className="flex min-w-[240px] flex-1 items-stretch gap-2">
              <input
                dir="ltr"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addUrl();
                  }
                }}
                placeholder="أو الصق رابط صورة (‎/media/… أو Vercel Blob)"
                className={inputCls}
                aria-label="رابط صورة"
              />
              <button type="button" className={btnCls("outline")} onClick={addUrl}>
                إضافة
              </button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-mute">JPG / PNG / WebP / AVIF حتى 5 ميجابايت. ألوان الخلفية والمنتج تُستخرج تلقائيًا ويمكن تعديلها — تُستخدم لتلوين بطاقات وصفحة المنتج.</p>
          {uploadError ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{uploadError}</p> : null}
        </Card>

        <Card
          title={`المتغيرات (${f.variants.length})`}
          actions={
            <button type="button" className={btnCls("outline", "sm")} onClick={addVariant}>
              <Plus className="h-3.5 w-3.5" /> إضافة متغير
            </button>
          }
        >
          {multi ? (
            <Field label="اسم الخيار" className="mb-4 max-w-xs" hint="مثال: اللون والتشطيب، السعة">
              <Input value={f.optionName} onChange={(e) => set("optionName", e.target.value)} maxLength={80} />
            </Field>
          ) : null}
          <div className="space-y-3">
            {f.variants.map((v, i) => (
              <div key={v.key} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <Field label={multi ? `قيمة الخيار #${i + 1}` : "قيمة الخيار (اختياري)"} className="col-span-2">
                    <Input value={v.optionValue} onChange={(e) => setVariant(v.key, { optionValue: e.target.value })} maxLength={120} />
                  </Field>
                  <Field label="SKU" className="col-span-2">
                    <Input dir="ltr" value={v.sku} onChange={(e) => setVariant(v.key, { sku: e.target.value })} maxLength={80} />
                  </Field>
                  <Field label="السعر (ر.س)">
                    <Input dir="ltr" inputMode="decimal" value={v.price} onChange={(e) => setVariant(v.key, { price: e.target.value })} />
                  </Field>
                  <Field label="قبل الخصم (ر.س)">
                    <Input dir="ltr" inputMode="decimal" value={v.compareAt} onChange={(e) => setVariant(v.key, { compareAt: e.target.value })} placeholder="—" />
                  </Field>
                  <Field label="المخزون" hint="فارغ = غير محدود">
                    <Input dir="ltr" inputMode="numeric" value={v.stock} onChange={(e) => setVariant(v.key, { stock: e.target.value })} placeholder="∞" />
                  </Field>
                  <Field label="الصورة" className="col-span-2">
                    <Select value={v.imageKey ?? ""} onChange={(e) => setVariant(v.key, { imageKey: e.target.value || null })}>
                      <option value="">بدون (الصورة الرئيسية)</option>
                      {f.images.map((img, idx) => (
                        <option key={img.key} value={img.key}>
                          صورة #{idx + 1}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="col-span-2 flex items-end justify-between gap-3 md:col-span-3">
                    <div className="flex items-center gap-3">
                      {v.imageKey ? (
                        <span className="block h-10 w-10 overflow-hidden rounded-lg border border-line">
                          <img src={f.images.find((im) => im.key === v.imageKey)?.url} alt="" className="h-full w-full object-cover" />
                        </span>
                      ) : null}
                      <Checkbox label="مفعّل" checked={v.isActive} onChange={(e) => setVariant(v.key, { isActive: e.target.checked })} />
                    </div>
                    <button
                      type="button"
                      className={btnCls("danger", "sm")}
                      onClick={() => removeVariant(v.key)}
                      disabled={f.variants.length <= 1}
                      title={f.variants.length <= 1 ? "يجب أن يبقى متغير واحد على الأقل" : undefined}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> حذف
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="النشر">
          <div className="space-y-4">
            <Field label="الحالة">
              <Select value={f.status} onChange={(e) => set("status", e.target.value as "active" | "draft")}>
                <option value="active">منشور</option>
                <option value="draft">مسودة (مخفي من المتجر)</option>
              </Select>
            </Field>
            <Checkbox label="ضمن «الأكثر مبيعًا»" checked={f.isBestSeller} onChange={(e) => set("isBestSeller", e.target.checked)} />
            <Field label="الترتيب في المتجر" hint="الرقم الأصغر يظهر أولًا">
              <Input dir="ltr" inputMode="numeric" value={f.position} onChange={(e) => set("position", e.target.value)} />
            </Field>
            <button type="button" onClick={submit} disabled={pending || uploading} className={btnCls("primary") + " w-full"}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {f.id ? "حفظ التغييرات" : "إنشاء المنتج"}
            </button>
            <Flash state={state ?? (justSaved ? { ok: true, message: "تم حفظ المنتج" } : null)} />
          </div>
        </Card>

        <Card title="التصنيفات">
          {categories.length ? (
            <div className="space-y-2">
              {categories.map((c) => (
                <Checkbox
                  key={c.id}
                  className="flex"
                  label={c.name}
                  checked={f.categoryIds.includes(c.id)}
                  onChange={(e) =>
                    set("categoryIds", e.target.checked ? [...f.categoryIds, c.id] : f.categoryIds.filter((x) => x !== c.id))
                  }
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-mute">لا توجد تصنيفات. أضفها من صفحة التصنيفات.</p>
          )}
        </Card>

        {f.id && bulkStockAction ? (
          <Card title="المخزون — إجراء سريع">
            <p className="mb-3 text-xs text-ink-mute">يطبَّق على كل متغيرات هذا المنتج فورًا (التغييرات غير المحفوظة في النموذج ستُفقد).</p>
            <ActionForm action={bulkStockAction}>
              <input type="hidden" name="ids" value={f.id} />
              <input type="hidden" name="redirectTo" value={`/admin/products/${f.id}`} />
              <input type="hidden" name="op" value="unlimited" />
              <SubmitButton variant="outline" className="w-full">
                اجعل المخزون غير محدود
              </SubmitButton>
            </ActionForm>
            <ActionForm action={bulkStockAction} className="mt-3">
              <input type="hidden" name="ids" value={f.id} />
              <input type="hidden" name="redirectTo" value={`/admin/products/${f.id}`} />
              <input type="hidden" name="op" value="set" />
              <div className="flex items-stretch gap-2">
                <Input name="stock" dir="ltr" inputMode="numeric" placeholder="الكمية" aria-label="كمية المخزون" required />
                <SubmitButton variant="dark" className="shrink-0">
                  تعيين للجميع
                </SubmitButton>
              </div>
            </ActionForm>
          </Card>
        ) : null}

        {f.id && deleteAction ? (
          <Card title="حذف المنتج">
            <p className="mb-3 text-xs text-ink-mute">يحذف المنتج وصوره ومتغيراته نهائيًا. الطلبات السابقة تحتفظ ببياناتها.</p>
            <ActionForm action={deleteAction}>
              <input type="hidden" name="id" value={f.id} />
              <ConfirmButton message={`حذف «${f.name}» نهائيًا؟ لا يمكن التراجع.`} size="md" className="w-full">
                <Trash2 className="h-4 w-4" /> حذف المنتج
              </ConfirmButton>
            </ActionForm>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
