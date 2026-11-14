import { SignJWT, jwtVerify } from "jose";

export const MERCHANT_COOKIE = "zaar_merchant";
export const HQ_COOKIE = "zaar_hq";
/** رموز ملكية المسودات (متاجر أُنشئت بالمحادثة قبل تسجيل الحساب) */
export const DRAFT_COOKIE = "zaar_draft";

export type SessionKind = "merchant" | "hq";
export type SessionPayload = { sub: string; kind: SessionKind; name?: string };

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET غير مضبوط أو قصير (32 حرفًا على الأقل)");
  }
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({ kind: payload.kind, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAgeSeconds)
    .sign(secret());
}

export async function verifySession(token: string | undefined, kind: SessionKind): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || !payload.sub) return null;
    return { sub: payload.sub, kind, name: typeof payload.name === "string" ? payload.name : undefined };
  } catch {
    return null;
  }
}
