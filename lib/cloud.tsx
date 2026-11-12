'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Listing, Offer } from './data';
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
  wants: r.wants ?? [], openToOffers: r.open_to_offers, valueTier: r.value_tier, images: r.images ?? [],
  ownerId: r.owner_id, ownerName: r.owner?.name ?? 'مستخدم', createdAt: +new Date(r.created_at), offersCount: r.offers_count ?? 0,
});
const toOffer = (r: any): Offer => ({
  id: r.id, listingId: r.listing_id, fromId: r.from_id, fromName: r.sender?.name ?? 'مستخدم', itemTitle: r.item_title,
  itemCategory: r.item_category, itemCondition: r.item_condition, valueTier: r.value_tier, note: r.note ?? '',
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
  const [favs, setFavs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const loadListings = useCallback(async () => {
    const { data, error } = await sb.from('listings').select(LISTING_COLS).order('created_at', { ascending: false }).limit(300);
    if (!error && data) setAll(data.map(toListing));
  }, [sb]);

  /** العروض وأرقام التواصل — قواعد الأمان في القاعدة ترجّع فقط اللي يخصّني */
  const loadPrivate = useCallback(async () => {
    const [o, c] = await Promise.all([
      sb.from('offers').select(OFFER_COLS).order('created_at', { ascending: false }),
      sb.from('contacts').select('user_id, whatsapp'),
    ]);
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
    const channel = sb
      .channel(`offers-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, (payload) => {
        loadPrivate();
        loadListings();
        const row = payload.new as { from_id?: string; status?: string } | null;
        if (payload.eventType === 'INSERT' && row?.from_id !== uid) toast('وصلك عرض بدل جديد');
        if (payload.eventType === 'UPDATE' && row?.from_id === uid && row?.status === 'accepted') toast('انقبل عرضك! شوف صفحة عروضي');
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
          wants: l.wants, open_to_offers: l.openToOffers, value_tier: l.valueTier, images,
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
          listing_id: o.listingId, from_id, item_title: o.itemTitle, item_category: o.itemCategory,
          item_condition: o.itemCondition, value_tier: o.valueTier, note: o.note, image,
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

    return { setMe, addListing, removeListing, addOffer, setOfferStatus, toggleFav, signIn, signUp, signOut, resetPassword, updatePassword };
  }, [sb, uid, me, loadListings, loadPrivate]);

  const listings = useMemo(() => (uid ? all.filter((l) => l.ownerId === uid) : []), [all, uid]);
  const offersFor = useCallback((listingId: string) => offers.filter((o) => o.listingId === listingId), [offers]);
  const contactFor = useCallback((userId: string) => contacts[userId], [contacts]);

  const value: Ctx = {
    ...api, cloud: true, authed: !!uid, email, ready, me, listings, all, offers, favs, toasts, toast, offersFor, contactFor,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
