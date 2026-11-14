"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "طباعة" }: { label?: string }) {
  return (
    <button type="button" className="dash-btn dash-btn-ink" onClick={() => window.print()}>
      <Printer size={16} /> {label}
    </button>
  );
}
