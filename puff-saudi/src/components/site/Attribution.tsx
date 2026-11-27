"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/attribution";

/** يسجّل مصدر الزيارة (المنصة الإعلانية) عند تحميل الصفحة ليُكتب لاحقًا على الطلب */
export function Attribution() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
