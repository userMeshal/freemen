'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { listingThread, parseThread, type Blocked, type Report, type Bid, type ChatHead, type Entry, type Fee, type Listing, type Message, type Offer } from './data';
import { StoreCtx, useChatSeen, useToasts, type Ctx, type Me } from './ctx';

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
  pledgeVersion: r.pledge_version ?? undefined,
  kind: r.kind ?? 'swap', price: r.price ?? undefined, minIncrement: r.min_increment ?? undefined,
  startsAt: r.starts_at ? +new Date(r.starts_at) : undefined, durationMinutes: r.duration_minutes ?? undefined,
  endsAt: r.ends_at ? +new Date(r.ends_at) : undefined, currentBid: r.current_bid ?? undefined, topBidder: r.top_bidder ?? undefined, bidsCount: r.bids_count ?? 0,
});
const toEntry = (r: any): Entry => ({
  id: r.id, listingId: r.listing_id, userId: r.user_id, userName: r.user?.name, listingTitle: r.listing?.title,
  senderName: r.sender_name, reference: r.reference ?? '', status: r.status, createdAt: +new Date(r.created_at),
});
const toFee = (r: any): Fee => ({
  listingId: r.listing_id, ownerId: r.owner_id, ownerName: r.owner?.name, listingTitle: r.listing?.title,
  senderName: r.sender_name, reference: r.reference ?? '', status: r.status, createdAt: +new Date(r.created_at),
});
const threadOf = (r: any) => listingThread(r.listing_id, r.peer_id);
const toMessage = (r: any): Message => ({ id: r.id, thread: threadOf(r), senderId: r.sender_id, body: r.body, createdAt: +new Date(r.created_at) });
const toBid = (r: any): Bid => ({
  id: r.id, listingId: r.listing_id, bidderId: r.bidder_id, bidderName: r.bidder?.name ?? 'مستخدم', amount: r.amount, createdAt: +new Date(r.created_at),
});

/** رسائل دالة المزايدة في القاعدة */
function bidError(message: string) {
  const low = message.match(/LOW:(\d+)/);
  if (low) return `أقل مزايدة مقبولة ${Number(low[1]).toLocaleString('en-US')} ريال`;
  if (message.includes('NOT_STARTED')) return 'المزاد ما بدأ بعد';
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
  const [fees, setFees] = useState<Fee[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRootAdmin, setIsRootAdmin] = useState(false);
  const [favs, setFavs] = useState<string[]>([]);
  const [chatHeads, setChatHeads] = useState<Record<string, ChatHead>>({});
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
    const [o, c, e, f, bl, m] = await Promise.all([
      sb.from('offers').select(OFFER_COLS).order('created_at', { ascending: false }),
      sb.from('contacts').select('user_id, whatsapp'),
      sb.from('auction_entries').select('*').eq('user_id', self).order('created_at', { ascending: false }),
      sb.from('auction_fees').select('*').eq('owner_id', self),
      sb.from('blocks').select('blocked_id').eq('blocker_id', self),
      // أحدث الرسائل في محادثاتي (قواعد الأمان ترجّع محادثاتي فقط) — لمعرفة غير المقروء
      sb.from('messages').select('listing_id, peer_id, sender_id, body, created_at').not('listing_id', 'is', null).order('created_at', { ascending: false }).limit(400),
    ]);
    if (m.data) {
      const heads: Record<string, ChatHead> = {};
      for (const r of m.data) {
        const thread = threadOf(r);
        if (!heads[thread]) heads[thread] = { thread, listingId: r.listing_id, peerId: r.peer_id, lastAt: +new Date(r.created_at), lastFrom: r.sender_id, lastBody: r.body };
      }
      // أسماء الأطراف المهتمة (لصندوق رسائل صاحب الإعلان)
      const peers = Array.from(new Set(Object.values(heads).map((h) => h.peerId).filter((id) => id !== self)));
      if (peers.length) {
        const { data: names } = await sb.from('profiles').select('id, name').in('id', peers);
        const byId = Object.fromEntries((names ?? []).map((n) => [n.id, n.name]));
        for (const h of Object.values(heads)) h.peerName = byId[h.peerId];
      }
      setChatHeads(heads);
    }
    if (bl.data) {
      const ids = bl.data.map((b) => b.blocked_id);
      const { data: names } = ids.length ? await sb.from('profiles').select('id, name').in('id', ids) : { data: [] };
      const byId = Object.fromEntries((names ?? []).map((n) => [n.id, n.name]));
      setBlocked(ids.map((userId) => ({ userId, name: byId[userId] ?? 'مستخدم' })));
    }
    if (f.data) setFees(f.data.map(toFee));
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
      setFees([]);
      setBlocked([]);
      setChatHeads({});
      setIsAdmin(false);
      setIsRootAdmin(false);
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
    const poll = setInterval(() => document.visibilityState === 'visible' && loadPrivate(), 30_000);
    sb.rpc('is_admin').then(({ data }) => alive && setIsAdmin(data === true));
    sb.rpc('is_root_admin').then(({ data }) => alive && setIsRootAdmin(data === true));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        loadPrivate();
        const row = payload.new as { sender_id?: string } | null;
        if (row?.sender_id !== uid && !window.location.pathname.startsWith('/chat/')) toast('وصلتك رسالة جديدة');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auction_fees' }, (payload) => {
        loadPrivate();
        loadListings();
        const row = payload.new as { owner_id?: string; status?: string } | null;
        if (row?.owner_id === uid && row.status === 'approved') toast('تفعّل مزادك — يبدأ بعد نصف ساعة');
        if (row?.owner_id === uid && row.status === 'rejected') toast('ما قدرنا نتحقق من تحويل رسم مزادك');
      })
      .subscribe();
    return () => {
      alive = false;
      clearInterval(poll);
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
      const row = {
          owner_id, title: l.title, category: l.category, condition: l.condition, city: l.city, description: l.description,
          wants: l.wants, open_to_offers: l.openToOffers, value_tier: l.valueTier, est_value: l.estValue ?? null, images,
          // أعمدة البيع والمزاد تنرسل لعروضها فقط، فيظل نشر عروض البدل شغّالاً على قاعدة لم تُحدَّث بعد
          ...(l.kind === 'swap' ? {} : { kind: l.kind, price: l.price ?? null, min_increment: l.minIncrement ?? 10, ...(l.kind === 'auction' ? { duration_minutes: l.durationMinutes ?? 60 } : {}) }),
      };
      // الموافقة على التعهد جزء من طلب النشر نفسه: القاعدة ترفض الإعلان بدونها وتسجّل الموافقة
      let { data, error } = await sb.from('listings').insert({ ...row, pledge_version: l.pledgeVersion ?? null }).select(LISTING_COLS).single();
      // قاعدة لم تُحدَّث بعد (لا يوجد عمود التعهد): ننشر بدون تسجيل حتى لا يتعطل النشر في فترة الترقية
      if (error && (error.code === 'PGRST204' || error.code === '42703') && /pledge_version/.test(error.message)) {
        ({ data, error } = await sb.from('listings').insert(row).select(LISTING_COLS).single());
      }
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
      if (uid && data && (!data.ends_at || +new Date(data.ends_at) <= Date.now())) loadPrivate();
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

    const loadMessages: Ctx['loadMessages'] = async (thread) => {
      const t = parseThread(thread);
      const { data, error } = await sb.from('messages').select('*').eq('listing_id', t.listingId).eq('peer_id', t.peerId).order('created_at', { ascending: true }).limit(500);
      if (error) throw error;
      return (data ?? []).map(toMessage);
    };

    const sendMessage: Ctx['sendMessage'] = async (thread, body) => {
      const sender_id = need();
      const t = parseThread(thread);
      const { error } = await sb.from('messages').insert({ listing_id: t.listingId, peer_id: t.peerId, sender_id, body: body.trim() });
      if (error) throw error;
      loadPrivate();
    };

    const peerName: Ctx['peerName'] = async (userId) => {
      const { data } = await sb.from('profiles').select('name').eq('id', userId).maybeSingle();
      return data?.name ?? 'مستخدم';
    };

    const requestAuctionFee: Ctx['requestAuctionFee'] = async (listingId, senderName, reference) => {
      const owner_id = need();
      await sb.from('auction_fees').delete().eq('listing_id', listingId).neq('status', 'approved');
      const { error } = await sb.from('auction_fees').insert({ listing_id: listingId, owner_id, sender_name: senderName, reference });
      if (error) throw error;
      await loadPrivate();
    };

    const loadPendingFees: Ctx['loadPendingFees'] = async () => {
      const { data, error } = await sb
        .from('auction_fees')
        .select('*, owner:profiles(name), listing:listings(title)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map(toFee);
    };

    const reviewFee: Ctx['reviewFee'] = async (listingId, approve) => {
      const { error } = await sb.rpc('review_auction_fee', { p_listing: listingId, p_approve: approve });
      if (error) throw error;
      loadListings();
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

    const adminError = (message: string) => {
      if (message.includes('NO_USER')) return 'ما فيه حساب بهذا الإيميل — لازم صاحبه يسجّل في الموقع أول';
      if (message.includes('ROOT')) return 'المشرف الأساسي ما ينشال من الموقع';
      if (message.includes('FORBIDDEN')) return 'هذي الصلاحية للمشرف الأساسي فقط';
      return 'ما تم الطلب، حاول مرة ثانية';
    };

    const loadAdmins: Ctx['loadAdmins'] = async () => {
      const { data, error } = await sb.rpc('admin_list');
      if (error) throw error;
      return ((data as any[]) ?? []).map((r) => ({ userId: r.user_id, name: r.name, email: r.email, addedAt: +new Date(r.added_at), isRoot: r.is_root }));
    };

    const addAdmin: Ctx['addAdmin'] = async (mail) => {
      const { error } = await sb.rpc('admin_add', { p_email: mail.trim() });
      return error ? adminError(error.message) : null;
    };

    const removeAdmin: Ctx['removeAdmin'] = async (userId) => {
      const { error } = await sb.rpc('admin_remove', { p_user: userId });
      return error ? adminError(error.message) : null;
    };

    const adminDeleteListing: Ctx['adminDeleteListing'] = async (id, reason) => {
      const { error } = await sb.rpc('admin_delete_listing', { p_listing: id, p_reason: reason });
      if (error) throw error;
      setAll((a) => a.filter((l) => l.id !== id));
      setOffers((o) => o.filter((x) => x.listingId !== id));
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

    const blockUser: Ctx['blockUser'] = async (userId, name) => {
      const blocker_id = need();
      const { error } = await sb.from('blocks').upsert({ blocker_id, blocked_id: userId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
      if (error) throw error;
      setBlocked((b) => [{ userId, name }, ...b.filter((x) => x.userId !== userId)]);
    };

    const unblockUser: Ctx['unblockUser'] = async (userId) => {
      const { error } = await sb.from('blocks').delete().eq('blocker_id', need()).eq('blocked_id', userId);
      if (error) throw error;
      setBlocked((b) => b.filter((x) => x.userId !== userId));
    };

    const report: Ctx['report'] = async (r) => {
      const { error } = await sb.from('reports').insert({
        reporter_id: need(), target: r.target, listing_id: r.listingId ?? null, listing_title: r.listingTitle ?? null,
        reported_user_id: r.reportedUserId ?? null, reason: r.reason, details: r.details,
      });
      if (error) throw error;
    };

    const loadReports: Ctx['loadReports'] = async () => {
      const { data, error } = await sb.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: true }).limit(200);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).flatMap((r) => [r.reporter_id, r.reported_user_id]).filter(Boolean)));
      const { data: names } = ids.length ? await sb.from('profiles').select('id, name').in('id', ids) : { data: [] };
      const byId = Object.fromEntries((names ?? []).map((n) => [n.id, n.name]));
      return (data ?? []).map((r): Report => ({
        id: r.id, target: r.target, listingId: r.listing_id ?? undefined, listingTitle: r.listing_title ?? undefined,
        reportedUserId: r.reported_user_id ?? undefined, reportedName: byId[r.reported_user_id], reporterName: byId[r.reporter_id],
        reason: r.reason, details: r.details ?? '', status: r.status, createdAt: +new Date(r.created_at),
      }));
    };

    const resolveReport: Ctx['resolveReport'] = async (id) => {
      const { error } = await sb.from('reports').update({ status: 'resolved' }).eq('id', id);
      if (error) throw error;
    };

    const deleteAccount: Ctx['deleteAccount'] = async () => {
      const id = need();
      // صور المستخدم في التخزين تنحذف أولاً (أفضل جهد)، ثم الحساب وكل ما يتبعه في القاعدة
      try {
        const { data: files } = await sb.storage.from(BUCKET).list(id, { limit: 1000 });
        if (files?.length) await sb.storage.from(BUCKET).remove(files.map((f) => `${id}/${f.name}`));
      } catch {}
      const { error } = await sb.rpc('delete_my_account');
      if (error) return error.message.includes('ROOT') ? 'المشرف الأساسي ما يحذف حسابه من الموقع' : 'ما انحذف الحساب، حاول مرة ثانية';
      await sb.auth.signOut();
      return null;
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

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, withdrawOffer, refreshListing, loadBids, placeBid, loadMessages, sendMessage, peerName, requestEntry, requestAuctionFee, loadPendingFees, reviewFee, loadPendingEntries, reviewEntry, loadAdmins, addAdmin, removeAdmin, adminDeleteListing, blockUser, unblockUser, report, loadReports, resolveReport, deleteAccount, toggleFav, signIn, signUp, signOut, resetPassword, updatePassword };
  }, [sb, uid, me, loadListings, loadPrivate]);

  const listings = useMemo(() => (uid ? all.filter((l) => l.ownerId === uid) : []), [all, uid]);
  // إعلانات ومحادثات المحظورين ما تظهر لي
  const blockedIds = useMemo(() => new Set(blocked.map((b) => b.userId)), [blocked]);
  const visible = useMemo(() => (blockedIds.size ? all.filter((l) => !blockedIds.has(l.ownerId)) : all), [all, blockedIds]);
  const heads = useMemo(() => {
    if (!blockedIds.size) return chatHeads;
    const owner = Object.fromEntries(all.map((l) => [l.id, l.ownerId]));
    return Object.fromEntries(Object.entries(chatHeads).filter(([, h]) => !blockedIds.has(h.peerId) && !blockedIds.has(owner[h.listingId])));
  }, [chatHeads, blockedIds, all]);
  const offersFor = useCallback((listingId: string) => offers.filter((o) => o.listingId === listingId), [offers]);
  const contactFor = useCallback((userId: string) => contacts[userId], [contacts]);

  const { unread, markRead } = useChatSeen(heads, uid ?? '');

  const value: Ctx = {
    ...api, cloud: true, chatHeads: heads, unread, markRead, blocked, authed: !!uid, email, ready, me, listings, all: visible, offers, favs, toasts, toast, offersFor, contactFor, entries, fees, isAdmin, isRootAdmin,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
