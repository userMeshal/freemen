'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Listing, Offer } from './data';

export type Me = { id: string; name: string; city: string; whatsapp: string };
export type Toast = { id: number; text: string };
export type NewListing = Omit<Listing, 'id' | 'ownerId' | 'createdAt'>;
export type NewOffer = Omit<Offer, 'id' | 'fromId' | 'createdAt' | 'status'>;

export type Ctx = {
  /** true = قاعدة بيانات حقيقية وتسجيل دخول، false = وضع تجريبي محلي */
  cloud: boolean;
  /** هل المستخدم مسجّل دخول (دائماً true في الوضع التجريبي) */
  authed: boolean;
  email: string;
  ready: boolean;
  me: Me;
  /** عروضي أنا */
  listings: Listing[];
  /** كل العروض المنشورة */
  all: Listing[];
  /** عروض البدل اللي أرسلتها أو وصلتني */
  offers: Offer[];
  favs: string[];
  toasts: Toast[];
  toast: (text: string) => void;
  setMe: (me: Partial<Me>) => Promise<void>;
  addListing: (l: NewListing) => Promise<Listing>;
  removeListing: (id: string) => Promise<void>;
  addOffer: (o: NewOffer) => Promise<void>;
  setOfferStatus: (id: string, status: Offer['status']) => Promise<void>;
  /** المرسل يسحب عرضه قبل الرد عليه */
  withdrawOffer: (id: string) => Promise<void>;
  toggleFav: (id: string) => void;
  offersFor: (listingId: string) => Offer[];
  /** رقم واتساب الطرف الثاني — يظهر فقط بعد قبول عرض بينكم */
  contactFor: (userId: string) => string | undefined;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<{ error?: string; confirm?: boolean }>;
  signOut: () => Promise<void>;
  /** يرسل رابط استرجاع كلمة المرور على الإيميل — يرجّع نص الخطأ أو null */
  resetPassword: (email: string) => Promise<string | null>;
  /** يغيّر كلمة مرور المستخدم الحالي (بعد فتح رابط الاسترجاع) */
  updatePassword: (password: string) => Promise<string | null>;
};

export const StoreCtx = createContext<Ctx | null>(null);

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const toast = useCallback(
    (text: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, text }]);
      later(3800, () => setToasts((t) => t.filter((x) => x.id !== id)));
    },
    [later],
  );
  return { toasts, toast, later };
}

/** يصغّر الصورة قبل حفظها حتى ما تثقل التخزين */
export function fileToDataUrl(file: File, max = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}
