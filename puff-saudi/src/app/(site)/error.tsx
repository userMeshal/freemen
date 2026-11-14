"use client";

import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap grid min-h-[80svh] place-items-center pt-[var(--header-h)] text-center">
      <div>
        <h1 className="t-h2">حدث خطأ غير متوقع</h1>
        <p className="mt-3 text-ink-mute">نعتذر عن ذلك. حاول مرة أخرى.</p>
        <button type="button" onClick={reset} className="btn btn-ink mt-7">
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
