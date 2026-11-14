"use client";

import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

/** شريط المعاينة للمسودات — يختفي داخل إطار المعاينة في صفحة البناء */
export function DraftBanner({ claimed }: { claimed: boolean }) {
  const [framed, setFramed] = useState(true);
  useEffect(() => setFramed(window.self !== window.top), []);
  if (framed) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-[140] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full bg-[#0A0A0B] py-2 pe-2 ps-5 text-sm text-white shadow-2xl">
      <span className="flex items-center gap-2">
        <Eye size={16} className="shrink-0 text-[#19E28C]" />
        <span>معاينة — متجرك لسا ما انتشر</span>
      </span>
      <a href={claimed ? "/dashboard" : "/signup"} className="shrink-0 rounded-full bg-[#19E28C] px-4 py-2 font-display text-xs font-bold text-[#04140C]">
        {claimed ? "لوحة التحكم" : "انشر متجري"}
      </a>
    </div>
  );
}
