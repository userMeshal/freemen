'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Bid, Entry, Listing, Offer } from './data';
import { StoreCtx, useToasts, type Ctx, type Me } from './ctx';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase يسمّي المفتاح العلني publishable في المشاريع الجديدة و anon في القديمة
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** null لو ما انضبطت متغيرات Supabase — وقتها الموقع يشتغل بالوضع التجريبي */
export const supabase: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

const BUCKET = 'listing-images';
const FAVS = 'badal:favs';
const blankMe: Me = { id: '', name: '', city: 'الرياض', whatsapp: '' };

const toListing = (r: any): Listing => ({
  id: r.id, title: r.title, category: r.category, condition: r.condition, city: r.city, description: r.description ?? '',
  wants: r.wants ?? [], openToOffers: r.open_to_offers, valueTier: r.value_tier, estValue: r.est_value ?? undefined, images: r.images ?? [],
  ownerId: r.owner_id, ownerName: r.owner?.name ?? 'مستخدم', createdAt: +new Date(r.created_at), offersCount: r.offers_count ?? 0,
  kind: r.kind ?? 'swap', price: r.price ?? undefined, minIncrement: r.min_increment ?? undefined,
  endsAt: r.ends_at ? +new Date(r.ends_at) : undefined, currentBid: r.current_bid ?? undefined, topBidder: r.top_bidder ?? undefined, bidsCount: r.bids_count ?? 0,
});
const toEntry = (r: any): Entry => ({
  id: r.id, listingId: r.listing_id, userId: r.user_id, userName: r.user?.name, listingTitle: r.listing?.title,
  senderName: r.sender_name, reference: r.reference ?? '', status: r.status, createdAt: +new Date(r.created_at),
});
const toBid = (r: any): Bid => ({
  id: r.id, listingId: r.listing_id, bidderId: r.bidder_id, bidderName: r.bidder?.name ?? 'مستخدم', amount: r.amount, createdAt: +new Date(r.created_at),
});

/** رسائل دالة المزايدة في القاعدة */
function bidError(message: string) {
  const low = message.match(/LOW:(\d+)/);
  if (low) return `أقل مزايدة مقبولة ${Number(low[1]).toLocaleString('en-US')} ريال`;
  if (message.includes('ENDED')) return 'انتهى المزاد';
  if (message.includes('NO_ENTRY')) return 'لازم يتفعّل دخولك للمزاد أول';
  if (message.includes('OWN')) return 'ما تقدر تزايد على مزادك';
  if (message.includes('AUTH')) return 'سجّل دخولك أول';
  return 'ما انحسبت المزايدة، حاول مرة ثانية';
}
const toOffer = (r: any): Offer => ({
  id: r.id, kind: r.kind ?? 'swap', listingId: r.listing_id, fromId: r.from_id, fromName: r.sender?.name ?? 'مستخدم', itemTitle: r.item_title ?? '',
  itemCategory: r.item_category ?? '', itemCondition: r.item_condition ?? '', valueTier: r.value_tier, estValue: r.est_value ?? undefined, cash: r.cash ?? 0, note: r.note ?? '',
  image: r.image ?? undefined, status: r.status, createdAt: +new Date(r.created_at),
});

const LISTING_COLS = '*, owner:profiles(name)';
const OFFER_COLS = '*, sender:profiles(name)';

function authError(message: string) {
  const m = message.toLowerCase();
  if (m.includes('rate limit')) return 'محاولات كثيرة — انتظر شوي وحاول مرة ثانية';
  if (m.includes('invalid login')) return 'الإيميل أو كلمة المرور غلط';
  if (m.includes('already registered') || m.includes('already been registered')) return 'هذا الإيميل مسجّل من قبل — جرّب تسجيل الدخول';
  if (m.includes('different from the old')) return 'اختر كلمة مرور غير القديمة';
  if (m.includes('session')) return 'انتهت صلاحية الرابط — اطلب رابط جديد';
  if (m.includes('password')) return 'كلمة المرور لازم تكون 6 أحرف أو أكثر';
  if (m.includes('email not confirmed')) return 'فعّل حسابك من الرابط اللي وصلك على الإيميل';
  if (m.includes('invalid') && m.includes('email')) return 'صيغة الإيميل مو صحيحة';
  return 'صار خطأ، حاول مرة ثانية';
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  const sb = supabase!;
  const { toasts, toast } = useToasts();
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [me, setMeState] = useState<Me>(blankMe);
  const [all, setAll] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const loadListings = useCallback(async () => {
    const { data, error } = await sb.from('listings').select(LISTING_COLS).order('created_at', { ascending: false }).limit(300);
    if (!error && data) setAll(data.map(toListing));
  }, [sb]);

  /** العروض وأرقام التواصل — قواعد الأمان في القاعدة ترجّع فقط اللي يخصّني */
  const loadPrivate = useCallback(async () => {
    const { data: auth } = await sb.auth.getSession();
    const self = auth.session?.user.id;
    if (!self) return;
    const [o, c, e] = await Promise.all([
      sb.from('offers').select(OFFER_COLS).order('created_at', { ascending: false }),
      sb.from('contacts').select('user_id, whatsapp'),
      sb.from('auction_entries').select('*').eq('user_id', self).order('created_at', { ascending: false }),
    ]);
    if (e.data) setEntries(e.data.map(toEntry));
    if (o.data) setOffers(o.data.map(toOffer));
    if (c.data) setContacts(Object.fromEntries(c.data.filter((x) => x.whatsapp).map((x) => [x.user_id, x.whatsapp])));
  }, [sb]);

  // الجلسة
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(FAVS) ?? '[]'));
    } catch {}
    const session = sb.auth.getSession().then(({ data }) => {
      setUid(data.session?.user.id ?? null);
      setEmail(data.session?.user.email ?? '');
    });
    // جاهزين أول ما تنعرف الجلسة وتوصل العروض — وما ننتظر شبكة بطيئة أكثر من 4 ثواني
    const slow = new Promise((r) => setTimeout(r, 4000));
    Promise.allSettled([session, Promise.race([loadListings(), slow])]).then(() => setReady(true));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user.id ?? null);
      setEmail(session?.user.email ?? '');
    });
    const onFocus = () => loadListings();
    window.addEventListener('focus', onFocus);
    return () => {
      sub.subscription.unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [sb, loadListings]);

  // بيانات المستخدم + تحديث حي لعروض البدل
  useEffect(() => {
    if (!uid) {
      setMeState(blankMe);
      setOffers([]);
      setContacts({});
      setEntries([]);
      setIsAdmin(false);
      return;
    }
    let alive = true;
    (async () => {
      const [p, c] = await Promise.all([
        sb.from('profiles').select('name, city').eq('id', uid).maybeSingle(),
        sb.from('contacts').select('whatsapp').eq('user_id', uid).maybeSingle(),
      ]);
      if (alive) setMeState({ id: uid, name: p.data?.name ?? '', city: p.data?.city ?? 'الرياض', whatsapp: c.data?.whatsapp ?? '' });
    })();
    loadPrivate();
    sb.rpc('is_admin').then(({ data }) => alive && setIsAdmin(data === true));
    const channel = sb
      .channel(`offers-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, (payload) => {
        loadPrivate();
        loadListings();
        const row = payload.new as { from_id?: string; status?: string } | null;
        if (payload.eventType === 'INSERT' && row?.from_id !== uid) toast('وصلك عرض بدل جديد');
        if (payload.eventType === 'UPDATE' && row?.from_id === uid && row?.status === 'accepted') toast('انقبل عرضك! شوف صفحة عروضي');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_entries' }, (payload) => {
        loadPrivate();
        const row = payload.new as { user_id?: string; status?: string } | null;
        if (row?.user_id === uid && row.status === 'approved') toast('تفعّل دخولك للمزاد — تقدر تزايد الحين');
        if (row?.user_id === uid && row.status === 'rejected') toast('ما قدرنا نتحقق من تحويلك — شوف صفحة المزاد');
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(channel);
    };
  }, [sb, uid, loadPrivate, loadListings, toast]);

  const api = useMemo(() => {
    const need = () => {
      if (!uid) throw new Error('auth');
      return uid;
    };

    const upload = async (dataUrl: string) => {
      if (!dataUrl.startsWith('data:')) return dataUrl;
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${need()}/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
      if (error) throw error;
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    };

    const setMe: Ctx['setMe'] = async (patch) => {
      const id = need();
      setMeState((m) => ({ ...m, ...patch }));
      if (patch.name !== undefined || patch.city !== undefined) {
        const next = { ...me, ...patch };
        await sb.from('profiles').upsert({ id, name: next.name || 'مستخدم', city: next.city });
      }
      if (patch.whatsapp !== undefined) await sb.from('contacts').upsert({ user_id: id, whatsapp: patch.whatsapp });
    };

    const addListing: Ctx['addListing'] = async (l) => {
      const owner_id = need();
      const images = await Promise.all(l.images.map(upload));
      const { data, error } = await sb
        .from('listings')
        .insert({
          owner_id, title: l.title, category: l.category, condition: l.condition, city: l.city, description: l.description,
          wants: l.wants, open_to_offers: l.openToOffers, value_tier: l.valueTier, est_value: l.estValue ?? null, images,
          // أعمدة البيع والمزاد تنرسل لعروضها فقط، فيظل نشر عروض البدل شغّالاً على قاعدة لم تُحدَّث بعد
          ...(l.kind === 'swap' ? {} : { kind: l.kind, price: l.price ?? null, min_increment: l.minIncrement ?? 10, ends_at: l.endsAt ? new Date(l.endsAt).toISOString() : null }),
        })
        .select(LISTING_COLS)
        .single();
      if (error) throw error;
      const listing = toListing(data);
      setAll((a) => [listing, ...a]);
      return listing;
    };

    const removeListing: Ctx['removeListing'] = async (id) => {
      const { error } = await sb.from('listings').delete().eq('id', id);
      if (error) throw error;
      setAll((a) => a.filter((l) => l.id !== id));
      setOffers((o) => o.filter((x) => x.listingId !== id));
    };

    const addOffer: Ctx['addOffer'] = async (o) => {
      const from_id = need();
      const image = o.image ? await upload(o.image) : null;
      const { data, error } = await sb
        .from('offers')
        .insert({
          listing_id: o.listingId, from_id, ...(o.kind === 'buy' ? { kind: 'buy' } : {}), item_title: o.itemTitle || null, item_category: o.itemCategory || null,
          item_condition: o.itemCondition || null, value_tier: o.valueTier, est_value: o.estValue ?? null, cash: o.cash ?? 0, note: o.note, image,
        })
        .select(OFFER_COLS)
        .single();
      if (error) throw error;
      setOffers((prev) => [toOffer(data), ...prev.filter((x) => x.id !== data.id)]);
      loadListings();
    };

    const setOfferStatus: Ctx['setOfferStatus'] = async (id, status) => {
      setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      const { error } = await sb.from('offers').update({ status }).eq('id', id);
      await loadPrivate();
      if (error) throw error;
    };

    const withdrawOffer: Ctx['withdrawOffer'] = async (id) => {
      const { error } = await sb.from('offers').delete().eq('id', id).eq('status', 'pending');
      if (error) throw error;
      setOffers((prev) => prev.filter((o) => o.id !== id));
      loadListings();
    };

    const refreshListing: Ctx['refreshListing'] = async (id) => {
      const { data } = await sb.from('listings').select(LISTING_COLS).eq('id', id).maybeSingle();
      if (data) setAll((a) => a.map((l) => (l.id === id ? toListing(data) : l)));
      // بعد انتهاء المزاد ينكشف رقم التواصل بين صاحبه والفائز
      if (uid && data?.ends_at && +new Date(data.ends_at) <= Date.now()) loadPrivate();
    };

    const loadBids: Ctx['loadBids'] = async (listingId) => {
      const { data } = await sb.from('bids').select('*, bidder:profiles(name)').eq('listing_id', listingId).order('amount', { ascending: false }).limit(50);
      return (data ?? []).map(toBid);
    };

    const placeBid: Ctx['placeBid'] = async (listingId, amount) => {
      if (!uid) return bidError('AUTH');
      const { data, error } = await sb.rpc('place_bid', { p_listing: listingId, p_amount: amount });
      if (error) return bidError(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setAll((a) => a.map((l) => (l.id === listingId ? { ...toListing(row), ownerName: l.ownerName } : l)));
      return null;
    };

    const requestEntry: Ctx['requestEntry'] = async (listingId, senderName, reference) => {
      const user_id = need();
      // طلب مرفوض أو معلّق سابق ينحذف وينرسل من جديد
      await sb.from('auction_entries').delete().eq('listing_id', listingId).eq('user_id', user_id).neq('status', 'approved');
      const { error } = await sb.from('auction_entries').insert({ listing_id: listingId, user_id, sender_name: senderName, reference });
      if (error) throw error;
      await loadPrivate();
    };

    const loadPendingEntries: Ctx['loadPendingEntries'] = async () => {
      const { data, error } = await sb
        .from('auction_entries')
        .select('*, user:profiles(name), listing:listings(title)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(toEntry);
    };

    const reviewEntry: Ctx['reviewEntry'] = async (id, status) => {
      const { error } = await sb.from('auction_entries').update({ status }).eq('id', id);
      if (error) throw error;
    };

    const toggleFav: Ctx['toggleFav'] = (id) =>
      setFavs((f) => {
        const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
        try {
          localStorage.setItem(FAVS, JSON.stringify(next));
        } catch {}
        return next;
      });

    const signIn: Ctx['signIn'] = async (mail, password) => {
      const { error } = await sb.auth.signInWithPassword({ email: mail.trim(), password });
      return error ? authError(error.message) : null;
    };

    const signUp: Ctx['signUp'] = async (name, mail, password) => {
      const { data, error } = await sb.auth.signUp({ email: mail.trim(), password, options: { data: { name: name.trim() } } });
      if (error) return { error: authError(error.message) };
      return { confirm: !data.session };
    };

    const signOut: Ctx['signOut'] = async () => {
      await sb.auth.signOut();
    };

    const resetPassword: Ctx['resetPassword'] = async (mail) => {
      const { error } = await sb.auth.resetPasswordForEmail(mail.trim(), { redirectTo: `${window.location.origin}/reset` });
      return error ? authError(error.message) : null;
    };

    const updatePassword: Ctx['updatePassword'] = async (password) => {
      const { error } = await sb.auth.updateUser({ password });
      return error ? authError(error.message) : null;
    };

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, withdrawOffer, refreshListing, loadBids, placeBid, requestEntry, loadPendingEntries, reviewEntry, toggleFav, signIn, signUp, signOut, resetPassword, updatePassword };
  }, [sb, uid, me, loadListings, loadPrivate]);

  const listings = useMemo(() => (uid ? all.filter((l) => l.ownerId === uid) : []), [all, uid]);
  const offersFor = useCallback((listingId: string) => offers.filter((o) => o.listingId === listingId), [offers]);
  const contactFor = useCallback((userId: string) => contacts[userId], [contacts]);

  const value: Ctx = {
    ...api, cloud: true, authed: !!uid, email, ready, me, listings, all, offers, favs, toasts, toast, offersFor, contactFor, entries, isAdmin,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
