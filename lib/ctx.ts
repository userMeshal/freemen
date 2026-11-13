'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Bid, ChatHead, Entry, Fee, Listing, Message, Offer } from './data';

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
  /** آخر رسالة في كل محادثة تخصّني */
  chatHeads: Record<string, ChatHead>;
  /** المحادثات اللي فيها رسالة من الطرف الثاني ما انقرت */
  unread: string[];
  loadMessages: (thread: string) => Promise<Message[]>;
  sendMessage: (thread: string, body: string) => Promise<void>;
  markRead: (thread: string) => void;
  /** اسم مستخدم من معرّفه — لعنوان المحادثة */
  peerName: (userId: string) => Promise<string>;
  /** طلبات دفع رسم عرض مزاداتي */
  fees: Fee[];
  /** صاحب المزاد يرسل بيانات تحويل رسم العرض */
  requestAuctionFee: (listingId: string, senderName: string, reference: string) => Promise<void>;
  /** للمشرف: رسوم عرض المزادات اللي تنتظر التحقق */
  loadPendingFees: () => Promise<Fee[]>;
  /** للمشرف: تأكيد الرسم يبدأ المزاد بعد نصف ساعة */
  reviewFee: (listingId: string, approve: boolean) => Promise<void>;
  /** طلباتي لدخول المزادات */
  entries: Entry[];
  /** يرسل طلب دخول مزاد بعد تحويل الرسم */
  requestEntry: (listingId: string, senderName: string, reference: string) => Promise<void>;
  loadBids: (listingId: string) => Promise<Bid[]>;
  /** يزايد — يرجّع نص الخطأ أو null */
  placeBid: (listingId: string, amount: number) => Promise<string | null>;
  /** يحدّث عرضاً واحداً من القاعدة (سعر المزاد الحالي ووقته) */
  refreshListing: (id: string) => Promise<void>;
  isAdmin: boolean;
  /** للمشرف: طلبات الدخول اللي تنتظر التحقق من التحويل */
  loadPendingEntries: () => Promise<Entry[]>;
  reviewEntry: (id: string, status: 'approved' | 'rejected') => Promise<void>;
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

const SEEN = 'badal:chat-seen';

/** آخر وقت فتح فيه المستخدم كل محادثة — محفوظ في المتصفح، ويحدد الرسائل غير المقروءة */
export function useChatSeen(heads: Record<string, ChatHead>, myId: string) {
  const [seen, setSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      setSeen(JSON.parse(localStorage.getItem(SEEN) ?? '{}'));
    } catch {}
  }, []);
  const markRead = useCallback((thread: string) => {
    setSeen((s) => {
      const next = { ...s, [thread]: Date.now() };
      try {
        localStorage.setItem(SEEN, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const unread = Object.values(heads).filter((h) => h.lastFrom !== myId && h.lastAt > (seen[h.thread] ?? 0)).map((h) => h.thread);
  return { unread, markRead };
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
