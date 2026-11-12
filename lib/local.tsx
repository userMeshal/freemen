'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED, type Listing, type Offer } from './data';
import { StoreCtx, useToasts, type Ctx, type Me } from './ctx';

/** الوضع التجريبي: كل شي ينحفظ في متصفح الزائر، مع عروض نموذجية وردود محاكاة */
type State = { me: Me; listings: Listing[]; offers: Offer[]; favs: string[] };

const KEY = 'badal:v1';
const uid = () => Math.random().toString(36).slice(2, 10);
const empty: State = { me: { id: '', name: '', city: 'الرياض', whatsapp: '' }, listings: [], offers: [], favs: [] };

export function LocalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [ready, setReady] = useState(false);
  const { toasts, toast, later } = useToasts();

  useEffect(() => {
    let next = empty;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) next = { ...empty, ...JSON.parse(raw) };
    } catch {}
    if (!next.me.id) next = { ...next, me: { ...next.me, id: `u-${uid()}` } };
    setState(next);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // التخزين ممتلئ (غالباً بسبب الصور) — نكمل بدون حفظ
    }
  }, [state, ready]);

  const api = useMemo(() => {
    const setMe: Ctx['setMe'] = async (me) => setState((s) => ({ ...s, me: { ...s.me, ...me } }));

    const addListing: Ctx['addListing'] = async (l) => {
      const listing: Listing = { ...l, id: `u${uid()}`, ownerId: state.me.id, createdAt: Date.now() };
      setState((s) => ({ ...s, listings: [listing, ...s.listings] }));
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

    const removeListing: Ctx['removeListing'] = async (id) =>
      setState((s) => ({ ...s, listings: s.listings.filter((l) => l.id !== id), offers: s.offers.filter((o) => o.listingId !== id) }));

    const addOffer: Ctx['addOffer'] = async (o) => {
      const offer: Offer = { ...o, id: `o${uid()}`, fromId: state.me.id, status: 'pending', createdAt: Date.now() };
      setState((s) => ({ ...s, offers: [offer, ...s.offers] }));
      if (o.listingId.startsWith('s')) {
        later(7000, () => {
          setState((s) => ({ ...s, offers: s.offers.map((x) => (x.id === offer.id && x.status === 'pending' ? { ...x, status: 'accepted', demo: true } : x)) }));
          toast('انقبل عرضك! شوف صفحة عروضي');
        });
      }
    };

    const setOfferStatus: Ctx['setOfferStatus'] = async (id, status) =>
      setState((s) => ({ ...s, offers: s.offers.map((o) => (o.id === id ? { ...o, status } : o)) }));

    const toggleFav: Ctx['toggleFav'] = (id) =>
      setState((s) => ({ ...s, favs: s.favs.includes(id) ? s.favs.filter((f) => f !== id) : [...s.favs, id] }));

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, toggleFav };
  }, [state.me.id, later, toast]);

  const all = useMemo(() => [...state.listings, ...SEED], [state.listings]);
  const offersFor = useCallback((listingId: string) => state.offers.filter((o) => o.listingId === listingId), [state.offers]);
  const contactFor = useCallback((userId: string) => all.find((l) => l.ownerId === userId && l.whatsapp)?.whatsapp, [all]);

  const value: Ctx = {
    ...state, ...api, cloud: false, authed: true, email: '', ready, all, toasts, toast, offersFor, contactFor,
    signIn: async () => null,
    signUp: async () => ({}),
    signOut: async () => {},
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
