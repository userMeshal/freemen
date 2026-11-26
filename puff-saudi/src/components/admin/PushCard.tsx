"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Loader2, Share, SquarePlus } from "lucide-react";
import { btnCls } from "@/components/admin/ui";
import { Flash } from "@/components/admin/client";
import type { ActionState } from "@/lib/admin-utils";
import { removePushDeviceAction, savePushDeviceAction, testPushAction } from "@/app/admin/(panel)/settings/actions";

type Device = { id: string; label: string; addedAt: string };
type Support = "checking" | "ok" | "needs-install" | "unsupported";

const SW_URL = "/admin-sw.js";
const SW_SCOPE = "/admin";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function deviceId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "آيفون";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "آيباد";
  if (/Android/.test(ua)) return "جوال أندرويد";
  if (/Windows/.test(ua)) return "كمبيوتر ويندوز";
  if (/Macintosh/.test(ua)) return "ماك";
  return "متصفح";
}

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { dateStyle: "medium", timeZone: "Asia/Riyadh" });

export function PushCard({ publicKey, devices }: { publicKey: string; devices: Device[] }) {
  const [support, setSupport] = useState<Support>("checking");
  const [thisDevice, setThisDevice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState<ActionState>(null);

  const refresh = useCallback(async () => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setInstalled(isStandalone());
    setPlatform(isIos() ? "ios" : /Android/.test(navigator.userAgent) ? "android" : "other");
    if (!supported) {
      setSupport(isIos() && !isStandalone() ? "needs-install" : "unsupported");
      return;
    }
    setSupport("ok");
    setBlocked(Notification.permission === "denied");
    const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
    const sub = await reg?.pushManager.getSubscription();
    setThisDevice(sub ? await deviceId(sub.endpoint) : null);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setSupport("unsupported"));
  }, [refresh]);

  const active = thisDevice !== null && devices.some((d) => d.id === thisDevice);

  async function run(name: string, fn: () => Promise<ActionState>) {
    setBusy(name);
    setState(null);
    try {
      setState(await fn());
    } catch (e) {
      console.error(e);
      setState({ ok: false, message: "حدث خطأ غير متوقع. حدّث الصفحة ثم أعد المحاولة." });
    } finally {
      setBusy(null);
      await refresh().catch(() => {});
    }
  }

  const enable = () =>
    run("enable", async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { ok: false, message: "لم تسمح بالإشعارات. اسمح بها من إعدادات الجوال لهذا التطبيق ثم أعد المحاولة." };
      }
      const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
      await navigator.serviceWorker.ready.catch(() => {});
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      const json = sub.toJSON();
      return savePushDeviceAction({ endpoint: json.endpoint ?? "", keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" } }, deviceLabel());
    });

  const disable = () =>
    run("disable", async () => {
      const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      const sub = await reg?.pushManager.getSubscription();
      const id = sub ? await deviceId(sub.endpoint) : thisDevice;
      await sub?.unsubscribe().catch(() => {});
      return id ? removePushDeviceAction(id) : { ok: true, message: "أُوقفت الإشعارات على هذا الجهاز" };
    });

  const spinner = (name: string) => (busy === name ? <Loader2 className="h-4 w-4 animate-spin" /> : null);

  return (
    <div data-push-card>
      <p className="text-sm leading-relaxed text-ink-mute">
        يصلك إشعار على جوالك مباشرة مع كل طلب مؤكَّد (مدفوع إلكترونيًا أو دفع عند الاستلام) فيه رقم الطلب والمبلغ، والضغط عليه يفتح الطلب.
        بلا تطبيق خارجي ولا حساب.
      </p>

      {platform === "ios" && !installed ? (
        <div className="mt-4 rounded-xl bg-paper-card p-4" data-install-hint="ios">
          <p className="text-sm font-semibold">على الآيفون: أضف اللوحة إلى الشاشة الرئيسية أولًا</p>
          <ol className="mt-2 list-decimal space-y-1.5 pr-5 text-sm leading-relaxed text-ink-mute">
            <li>
              افتح هذه الصفحة في متصفح Safari واضغط زر المشاركة <Share className="inline h-4 w-4 align-[-3px]" aria-label="مشاركة" />.
            </li>
            <li>
              اختر «إضافة إلى الشاشة الرئيسية» <SquarePlus className="inline h-4 w-4 align-[-3px]" aria-hidden /> ثم «إضافة».
            </li>
            <li>افتح أيقونة «PUFF طلبات» من الشاشة الرئيسية، سجّل الدخول، ثم ارجع إلى الإعدادات واضغط «تفعيل الإشعارات».</li>
          </ol>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-mute">يتطلب iOS 16.4 أو أحدث. الإشعارات على الآيفون لا تعمل من المتصفح مباشرة، فقط من الأيقونة.</p>
        </div>
      ) : null}

      {platform === "android" && !installed ? (
        <p className="mt-4 rounded-xl bg-paper-card p-4 text-sm leading-relaxed text-ink-mute" data-install-hint="android">
          لتظهر كتطبيق (اختياري): من قائمة Chrome <span dir="ltr">⋮</span> اختر «إضافة إلى الشاشة الرئيسية». الإشعارات تعمل حتى بدونها.
        </p>
      ) : null}

      {support === "unsupported" ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          هذا المتصفح لا يدعم الإشعارات. افتح اللوحة من Chrome على أندرويد، أو من Safari على الآيفون وأضفها إلى الشاشة الرئيسية.
        </p>
      ) : null}

      {support === "ok" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {active ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> الإشعارات مفعّلة على هذا الجهاز
              </span>
              <button type="button" onClick={disable} disabled={busy !== null} className={btnCls("outline", "sm")}>
                {spinner("disable")} إيقافها على هذا الجهاز
              </button>
            </>
          ) : blocked ? (
            <p className="text-sm leading-relaxed text-coral">
              الإشعارات محظورة لهذا الموقع على جهازك. اسمح بها من إعدادات الجوال (الإشعارات ← PUFF طلبات) ثم حدّث الصفحة.
            </p>
          ) : (
            <button type="button" onClick={enable} disabled={busy !== null} className={btnCls("primary")}>
              {busy === "enable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} تفعيل الإشعارات على هذا الجهاز
            </button>
          )}
        </div>
      ) : null}

      {devices.length ? (
        <>
          <ul className="mt-4 divide-y divide-line/70 rounded-xl border border-line">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-semibold">{d.label}</span>
                  {d.id === thisDevice ? <span className="text-ink-mute"> (هذا الجهاز)</span> : null}
                  <span className="block text-xs text-ink-mute" suppressHydrationWarning>
                    منذ {dateFmt.format(new Date(d.addedAt))}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={busy !== null}
                  className={btnCls("danger", "sm")}
                  onClick={() => {
                    if (window.confirm(`إيقاف الإشعارات عن «${d.label}»؟`)) void run(`rm-${d.id}`, () => removePushDeviceAction(d.id));
                  }}
                >
                  {spinner(`rm-${d.id}`)} إزالة
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => run("test", testPushAction)} disabled={busy !== null} className={`${btnCls("dark", "sm")} mt-3`}>
            {spinner("test")} إرسال إشعار تجريبي
          </button>
        </>
      ) : null}

      <Flash state={state} className="mt-3" />
    </div>
  );
}
