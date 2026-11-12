'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SEED, type Listing, type Offer } from './data';

type Me = { id: string; name: string; city: string; whatsapp: string };
type State = { me: Me; listings: Listing[]; offers: Offer[]; favs: string[] };
type Toast = { id: number; text: string };

type Ctx = State & {
  ready: boolean;
  all: Listing[];
  toasts: Toast[];
  toast: (text: string) => void;
  setMe: (me: Partial<Me>) => void;
  addListing: (l: Omit<Listing, 'id' | 'ownerId' | 'createdAt'>) => Listing;
  removeListing: (id: string) => void;
  addOffer: (o: Omit<Offer, 'id' | 'fromId' | 'createdAt' | 'status'>) => void;
  setOfferStatus: (id: string, status: Offer['status']) => void;
  toggleFav: (id: string) => void;
  offersFor: (listingId: string) => Offer[];
};

const KEY = 'badal:v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const empty: State = { me: { id: '', name: '', city: 'الرياض', whatsapp: '' }, listings: [], offers: [], favs: [] };

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    let next = empty;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) next = { ...empty, ...JSON.parse(raw) };
    } catch {}
    if (!next.me.id) next = { ...next, me: { ...next.me, id: `u-${uid()}` } };
    setState(next);
    setReady(true);
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // التخزين ممتلئ (غالباً بسبب الصور) — نكمل بدون حفظ
    }
  }, [state, ready]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    timers.current.push(setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800));
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const api = useMemo(() => {
    const setMe: Ctx['setMe'] = (me) => setState((s) => ({ ...s, me: { ...s.me, ...me } }));

    const addListing: Ctx['addListing'] = (l) => {
      const listing: Listing = { ...l, id: `u${uid()}`, ownerId: state.me.id, createdAt: Date.now() };
      setState((s) => ({ ...s, listings: [listing, ...s.listings] }));
      // عروض تجريبية توضّح كيف توصلك عروض البدل (تختفي عند ربط قاعدة بيانات حقيقية)
      const demo = [
        { fromName: 'سارة', itemTitle: 'ساعة أبل الترا 2', itemCategory: 'electronics', itemCondition: 'شبه جديد', note: 'ساعتي نظيفة ومعها كل أغراضها، يناسبك البدل؟' },
        { fromName: 'خالد', itemTitle: 'بلايستيشن 5 سلِم', itemCategory: 'gaming', itemCondition: 'مستعمل نظيف', note: 'أنا بنفس مدينتك ونتقابل بأي وقت.' },
      ];
      demo.forEach((d, i) =>
        later(5000 + i * 6000, () => {
          setState((s) =>
            s.listings.some((x) => x.id === listing.id)
              ? {
                  ...s,
                  offers: [
                    { ...d, id: `o${uid()}`, listingId: listing.id, fromId: `demo-${i}`, valueTier: Math.max(0, Math.min(4, listing.valueTier + (i ? -1 : 0))), status: 'pending', createdAt: Date.now(), demo: true },
                    ...s.offers,
                  ],
                }
              : s,
          );
          toast(`وصلك عرض بدل من ${d.fromName}`);
        }),
      );
      return listing;
    };

    const removeListing: Ctx['removeListing'] = (id) =>
      setState((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id), offers: s.offers.filter((o) => o.listingId !== id) }));

    const addOffer: Ctx['addOffer'] = (o) => {
      const offer: Offer = { ...o, id: `o${uid()}`, fromId: state.me.id, status: 'pending', createdAt: Date.now() };
      setState((s) => ({ ...s, offers: [offer, ...s.offers] }));
      if (o.listingId.startsWith('s')) {
        // رد تجريبي على العروض المرسلة للإعلانات النموذجية
        later(7000, () => {
          setState((s) => ({ ...s, offers: s.offers.map((x) => (x.id === offer.id && x.status === 'pending' ? { ...x, status: 'accepted', demo: true } : x)) }));
          toast('انقبل عرضك! شوف صفحة عروضي');
        });
      }
    };

    const setOfferStatus: Ctx['setOfferStatus'] = (id, status) =>
      setState((s) => ({ ...s, offers: s.offers.map((o) => (o.id === id ? { ...o, status } : o)) }));

    const toggleFav: Ctx['toggleFav'] = (id) =>
      setState((s) => ({ ...s, favs: s.favs.includes(id) ? s.favs.filter((f) => f !== id) : [...s.favs, id] }));

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, toggleFav };
  }, [state.me.id, later, toast]);

  const all = useMemo(() => [...state.listings, ...SEED], [state.listings]);
  const offersFor = useCallback((listingId: string) => state.offers.filter((o) => o.listingId === listingId), [state.offers]);

  return (
    <StoreCtx.Provider value={{ ...state, ...api, ready, all, toasts, toast, offersFor }}>{children}</StoreCtx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
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
