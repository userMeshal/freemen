'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SEED, auctionPhase, listingValue, minNextBid, parseThread, tierOf, type Bid, type ChatHead, type Entry, type Fee, type Listing, type Message, type Offer } from './data';
import { PLEDGE, pledgeBody } from './pledge';
import { SITE } from './site';
import { StoreCtx, useChatSeen, useToasts, type Ctx, type Me } from './ctx';

/** الوضع التجريبي: كل شي ينحفظ في متصفح الزائر، مع عروض نموذجية وردود محاكاة */
type Live = Partial<Pick<Listing, 'currentBid' | 'bidsCount' | 'topBidder' | 'startsAt' | 'endsAt'>>;
type State = { me: Me; listings: Listing[]; offers: Offer[]; favs: string[]; bids: Bid[]; entries: Entry[]; fees: Fee[]; live: Record<string, Live>;
  messages: Message[];
  pledges: { listingId: string; userId: string; version: string; body: string; fee: number; acceptedAt: number }[];
};

const KEY = 'badal:v1';
const uid = () => Math.random().toString(36).slice(2, 10);
/** العرض التجريبي الثاني غرض أقل قيمة مع مبلغ يعدّل الفرق */
function demoValue(listing: Listing, i: number) {
  const target = listingValue(listing);
  const round = (n: number) => Math.max(50, Math.round(n / 50) * 50);
  const estValue = round(i ? target * 0.7 : target * 1.05);
  return { estValue, valueTier: tierOf(estValue), cash: i ? round(target * 0.25) : 0 };
}
const empty: State = { me: { id: '', name: '', city: 'الرياض', whatsapp: '' }, listings: [], offers: [], favs: [], bids: [], entries: [], fees: [], live: {}, pledges: [], messages: [] };

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
      if (l.pledgeVersion !== PLEDGE.version) throw new Error('PLEDGE_REQUIRED');
      const listing: Listing = { ...l, id: `u${uid()}`, ownerId: state.me.id, createdAt: Date.now() };
      setState((s) => ({
        ...s,
        listings: [listing, ...s.listings],
        pledges: [{ listingId: listing.id, userId: s.me.id, version: PLEDGE.version, body: pledgeBody(), fee: PLEDGE.fee, acceptedAt: Date.now() }, ...(s.pledges ?? [])],
      }));
      if (listing.kind !== 'swap') return listing;
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
                    { ...d, id: `o${uid()}`, listingId: listing.id, fromId: `demo-${i}`, ...demoValue(listing, i), status: 'pending', createdAt: Date.now(), demo: true },
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

    const withdrawOffer: Ctx['withdrawOffer'] = async (id) => setState((s) => ({ ...s, offers: s.offers.filter((o) => o.id !== id) }));

    const sendMessage: Ctx['sendMessage'] = async (thread, body) => {
      const mine: Message = { id: `m${uid()}`, thread, senderId: state.me.id, body: body.trim(), createdAt: Date.now() };
      setState((s) => ({ ...s, messages: [...(s.messages ?? []), mine] }));
      // في الوضع التجريبي الطرف الثاني وهمي: نرد مرة واحدة في كل محادثة حتى تنجرّب
      later(2500, () => {
        const reply: Message = { id: `m${uid()}`, thread, senderId: 'demo-peer', body: 'هلا! تمام، وين ومتى يناسبك نتقابل؟', createdAt: Date.now(), demo: true };
        setState((s) => ((s.messages ?? []).some((m) => m.thread === thread && m.demo) ? s : { ...s, messages: [...(s.messages ?? []), reply] }));
      });
    };

    const requestAuctionFee: Ctx['requestAuctionFee'] = async (listingId, senderName, reference) => {
      const fee: Fee = { listingId, ownerId: state.me.id, senderName, reference, status: 'pending', createdAt: Date.now() };
      setState((s) => ({ ...s, fees: [fee, ...s.fees.filter((f) => f.listingId !== listingId)] }));
      // في الوضع التجريبي نحاكي تأكيد المشرف: يبدأ المزاد بعد نصف ساعة من التأكيد
      later(5000, () => {
        setState((s) => {
          const l = s.listings.find((x) => x.id === listingId);
          if (!l) return s;
          const startsAt = Date.now() + SITE.startDelayMinutes * 60_000;
          return {
            ...s,
            fees: s.fees.map((f) => (f.listingId === listingId ? { ...f, status: 'approved', demo: true } : f)),
            live: { ...s.live, [listingId]: { ...s.live[listingId], startsAt, endsAt: startsAt + (l.durationMinutes ?? 60) * 60_000 } },
          };
        });
        toast(`تفعّل مزادك — يبدأ بعد ${SITE.startDelayMinutes} دقيقة`);
      });
    };

    const requestEntry: Ctx['requestEntry'] = async (listingId, senderName, reference) => {
      const entry: Entry = { id: `e${uid()}`, listingId, userId: state.me.id, senderName, reference, status: 'pending', createdAt: Date.now() };
      setState((s) => ({ ...s, entries: [entry, ...s.entries.filter((e) => e.listingId !== listingId)] }));
      // في الوضع التجريبي نحاكي موافقة المشرف
      later(5000, () => {
        setState((s) => ({ ...s, entries: s.entries.map((e) => (e.id === entry.id ? { ...e, status: 'approved', demo: true } : e)) }));
        toast('تفعّل دخولك للمزاد — تقدر تزايد الحين');
      });
    };

    const toggleFav: Ctx['toggleFav'] = (id) =>
      setState((s) => ({ ...s, favs: s.favs.includes(id) ? s.favs.filter((f) => f !== id) : [...s.favs, id] }));

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, withdrawOffer, sendMessage, requestAuctionFee, requestEntry, toggleFav };
  }, [state.me.id, later, toast]);

  const all = useMemo(() => [...state.listings, ...SEED].map((l) => (state.live[l.id] ? { ...l, ...state.live[l.id] } : l)), [state.listings, state.live]);

  const loadBids: Ctx['loadBids'] = useCallback(
    async (listingId) => {
      const mine = state.bids.filter((b) => b.listingId === listingId);
      const seed = SEED.find((l) => l.id === listingId);
      // مزايدات نموذجية تحت السعر الحالي للعروض التجريبية
      const fake: Bid[] = seed?.currentBid
        ? ['نورة', 'عبدالله', 'لطيفة'].map((bidderName, i) => ({
            id: `sb${listingId}${i}`, listingId, bidderId: `seed-bidder-${i + 1}`, bidderName,
            amount: seed.currentBid! - i * (seed.minIncrement ?? 10) * 2, createdAt: Date.now() - (i + 1) * 1800_000,
          }))
        : [];
      return [...mine, ...fake].sort((a, b) => b.amount - a.amount);
    },
    [state.bids],
  );

  const placeBid: Ctx['placeBid'] = async (listingId, amount) => {
    const l = all.find((x) => x.id === listingId);
    if (!l || l.kind !== 'auction') return 'هذا العرض مو مزاد';
    const phase = auctionPhase(l);
    if (phase === 'ended') return 'انتهى المزاد';
    if (phase !== 'live') return 'المزاد ما بدأ بعد';
    if (l.ownerId === state.me.id) return 'ما تقدر تزايد على مزادك';
    if (!state.entries.some((e) => e.listingId === listingId && e.status === 'approved')) return 'لازم تدخل المزاد أول';
    if (amount < minNextBid(l)) return `أقل مزايدة مقبولة ${minNextBid(l).toLocaleString('en-US')} ريال`;
    const bid: Bid = { id: `b${uid()}`, listingId, bidderId: state.me.id, bidderName: state.me.name || 'أنت', amount, createdAt: Date.now() };
    const soon = (l.endsAt ?? 0) - Date.now() < 120_000;
    setState((s) => ({
      ...s,
      bids: [bid, ...s.bids],
      live: { ...s.live, [listingId]: { ...s.live[listingId], currentBid: amount, bidsCount: (l.bidsCount ?? 0) + 1, topBidder: s.me.id, endsAt: soon ? Date.now() + 120_000 : l.endsAt } },
    }));
    return null;
  };
  const offersFor = useCallback((listingId: string) => state.offers.filter((o) => o.listingId === listingId), [state.offers]);
  const contactFor = useCallback((userId: string) => all.find((l) => l.ownerId === userId && l.whatsapp)?.whatsapp, [all]);

  const messages = useMemo(() => state.messages ?? [], [state.messages]);
  const loadMessages: Ctx['loadMessages'] = useCallback(async (thread) => messages.filter((m) => m.thread === thread), [messages]);
  const chatHeads = useMemo(() => {
    const heads: Record<string, ChatHead> = {};
    for (const m of messages) {
      const t = parseThread(m.thread);
      heads[m.thread] = { thread: m.thread, listingId: t.listingId, peerId: t.peerId, peerName: state.offers.find((o) => o.fromId === t.peerId)?.fromName, lastAt: m.createdAt, lastFrom: m.senderId, lastBody: m.body };
    }
    return heads;
  }, [messages, state.offers]);
  const peerName: Ctx['peerName'] = async (userId) => state.offers.find((o) => o.fromId === userId)?.fromName ?? 'مستخدم';
  const { unread, markRead } = useChatSeen(chatHeads, state.me.id);

  const value: Ctx = {
    ...state, ...api, cloud: false, chatHeads, unread, markRead, loadMessages, peerName, authed: true, email: '', ready, all, toasts, toast, offersFor, contactFor,
    signIn: async () => null,
    signUp: async () => ({}),
    signOut: async () => {},
    loadBids, placeBid,
    refreshListing: async () => {},
    isAdmin: false,
    isRootAdmin: false,
    loadAdmins: async () => [],
    addAdmin: async () => 'الإدارة تشتغل مع قاعدة البيانات فقط',
    removeAdmin: async () => null,
    adminDeleteListing: async () => {},
    loadPendingEntries: async () => [],
    loadPendingFees: async () => [],
    reviewFee: async () => {},
    reviewEntry: async () => {},
    resetPassword: async () => null,
    updatePassword: async () => null,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
