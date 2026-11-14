"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { ICONS } from "@/lib/themes";

export function IconGrid({ value, onChange, className = "grid-cols-7 sm:grid-cols-10" }: { value: string; onChange: (icon: string) => void; className?: string }) {
  return (
    <div className={`grid gap-1.5 ${className}`} role="radiogroup" aria-label="الأيقونة">
      {ICONS.map((name) => {
        const on = name === value;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={on}
            title={name}
            onClick={() => onChange(name)}
            className={`grid aspect-square place-items-center rounded-xl transition-colors ${on ? "bg-ink text-paper" : "bg-ink/[0.05] text-ink/70 hover:bg-ink/10"}`}
          >
            <Icon name={name} size={18} strokeWidth={1.7} />
          </button>
        );
      })}
    </div>
  );
}

/** زر صغير يفتح شبكة الأيقونات ويحمل القيمة في حقل مخفي داخل النموذج */
export function IconPicker({ name = "icon", defaultValue = "Sparkles" }: { name?: string; defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="اختر أيقونة"
        className="flex h-[2.9rem] items-center gap-1 rounded-[0.9rem] border-[1.5px] border-ink/15 bg-white px-3 hover:border-ink"
      >
        <Icon name={value} size={19} strokeWidth={1.7} />
        <ChevronDown size={14} className="text-ink/45" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="إغلاق" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute start-0 top-full z-40 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-3xl border border-ink/10 bg-white p-3 shadow-xl">
            <IconGrid
              value={value}
              className="grid-cols-7"
              onChange={(icon) => {
                setValue(icon);
                setOpen(false);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
