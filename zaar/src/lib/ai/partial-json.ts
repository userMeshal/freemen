/**
 * يحوّل نص JSON غير مكتمل (أثناء البث) إلى أقرب كائن صالح:
 * يقصّ عند آخر قيمة مكتملة ثم يغلق الأقواس المفتوحة. يرجع null إن لم يتوفر شيء بعد.
 */
export function parsePartialJson<T = unknown>(text: string): T | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  const s = text.slice(start);
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  /** آخر موضع آمن للقص (بعد قيمة مكتملة) مع حالة الأقواس عنده */
  let safeEnd = 0;
  let safeStack: string[] = [];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{" || c === "[") stack.push(c === "{" ? "}" : "]");
    else if (c === "}" || c === "]") {
      stack.pop();
      safeEnd = i + 1;
      safeStack = [...stack];
    } else if (c === ",") {
      safeEnd = i;
      safeStack = [...stack];
    }
  }

  const attempt = (body: string, open: string[]) => {
    try {
      return JSON.parse(body + [...open].reverse().join("")) as T;
    } catch {
      return null;
    }
  };

  if (!inString && !escape) {
    const whole = attempt(s.replace(/[,\s]+$/, ""), stack);
    if (whole) return whole;
  }
  if (safeEnd > 0) return attempt(s.slice(0, safeEnd), safeStack);
  return null;
}
