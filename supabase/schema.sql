-- ════════════════════════════════════════════════════════════════
--  بدل — قاعدة البيانات
--  انسخ الملف كامل والصقه في Supabase ← SQL Editor ← Run
--  آمن تشغيله أكثر من مرة.
-- ════════════════════════════════════════════════════════════════

-- ───────── الجداول ─────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'مستخدم' check (char_length(name) between 1 and 40),
  city text not null default 'الرياض',
  created_at timestamptz not null default now()
);

-- رقم التواصل في جدول مستقل: ما ينقرأ إلا بعد قبول عرض بين الطرفين
create table if not exists public.contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  whatsapp text not null default '' check (char_length(whatsapp) <= 20)
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  category text not null,
  condition text not null,
  city text not null,
  description text not null default '' check (char_length(description) <= 500),
  wants text[] not null default '{}' check (coalesce(array_length(wants, 1), 0) <= 6),
  open_to_offers boolean not null default true,
  value_tier smallint not null default 1 check (value_tier between 0 and 4),
  images text[] not null default '{}' check (coalesce(array_length(images, 1), 0) <= 3),
  offers_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists listings_created_idx on public.listings (created_at desc);
create index if not exists listings_owner_idx on public.listings (owner_id);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_id uuid not null references public.profiles (id) on delete cascade,
  item_title text not null check (char_length(item_title) between 2 and 60),
  item_category text not null,
  item_condition text not null,
  value_tier smallint not null default 1 check (value_tier between 0 and 4),
  note text not null default '' check (char_length(note) <= 300),
  image text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (listing_id, from_id)
);
create index if not exists offers_from_idx on public.offers (from_id);

-- ───────── تحديث: القيمة بالريال والمبلغ المضاف في عروض البدل ─────────
alter table public.listings add column if not exists est_value integer check (est_value between 1 and 10000000);
alter table public.offers add column if not exists est_value integer check (est_value between 1 and 10000000);
alter table public.offers add column if not exists cash integer not null default 0 check (cash between 0 and 10000000);

-- ───────── دوال مساعدة ─────────
-- إنشاء ملف المستخدم تلقائياً عند التسجيل
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'مستخدم'), 40))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- هل المستخدم الحالي صاحب هذا العرض؟ (security definer لتفادي تداخل قواعد الأمان)
create or replace function public.owns_listing(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listings where id = lid and owner_id = auth.uid());
$$;

-- هل بيني وبين هذا المستخدم عرض بدل مقبول؟
create or replace function public.has_deal_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.offers o join public.listings l on l.id = o.listing_id
    where o.status = 'accepted'
      and ((l.owner_id = other and o.from_id = auth.uid()) or (o.from_id = other and l.owner_id = auth.uid()))
  );
$$;

-- عدّاد عروض البدل على كل عرض (ظاهر للجميع بدون كشف تفاصيل العروض)
create or replace function public.bump_offers_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.listings set offers_count = offers_count + 1 where id = new.listing_id;
  else
    update public.listings set offers_count = greatest(offers_count - 1, 0) where id = old.listing_id;
  end if;
  return null;
end $$;

drop trigger if exists offers_count_trg on public.offers;
create trigger offers_count_trg after insert or delete on public.offers
  for each row execute function public.bump_offers_count();

-- ───────── قواعد الأمان (RLS) ─────────
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.listings enable row level security;
alter table public.offers enable row level security;

drop policy if exists "profiles read" on public.profiles;
drop policy if exists "profiles insert own" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "contacts read own or deal" on public.contacts;
drop policy if exists "contacts insert own" on public.contacts;
drop policy if exists "contacts update own" on public.contacts;
create policy "contacts read own or deal" on public.contacts for select to authenticated
  using (user_id = auth.uid() or public.has_deal_with(user_id));
create policy "contacts insert own" on public.contacts for insert to authenticated with check (user_id = auth.uid());
create policy "contacts update own" on public.contacts for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "listings read" on public.listings;
drop policy if exists "listings insert own" on public.listings;
drop policy if exists "listings update own" on public.listings;
drop policy if exists "listings delete own" on public.listings;
create policy "listings read" on public.listings for select using (true);
create policy "listings insert own" on public.listings for insert to authenticated with check (owner_id = auth.uid());
create policy "listings update own" on public.listings for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "listings delete own" on public.listings for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "offers read mine" on public.offers;
drop policy if exists "offers insert" on public.offers;
drop policy if exists "offers owner decides" on public.offers;
drop policy if exists "offers withdraw" on public.offers;
create policy "offers read mine" on public.offers for select to authenticated
  using (from_id = auth.uid() or public.owns_listing(listing_id));
-- ترسل العرض باسمك فقط، وما تعرض على غرضك أنت
create policy "offers insert" on public.offers for insert to authenticated
  with check (from_id = auth.uid() and status = 'pending' and not public.owns_listing(listing_id));
-- القبول والرفض لصاحب العرض فقط
create policy "offers owner decides" on public.offers for update to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));
-- المرسل يسحب عرضه ما دام بانتظار الرد فقط
create policy "offers withdraw" on public.offers for delete to authenticated using (from_id = auth.uid() and status = 'pending');

-- ───────── الصلاحيات على مستوى الأعمدة ─────────
-- التعديل على عرض البدل = تغيير حالته فقط؛ والعدّاد ما يعدّله المستخدم
revoke update on public.offers from anon, authenticated;
grant update (status) on public.offers to authenticated;
revoke insert, update on public.listings from anon, authenticated;
grant insert (owner_id, title, category, condition, city, description, wants, open_to_offers, value_tier, est_value, images) on public.listings to authenticated;
grant update (title, category, condition, city, description, wants, open_to_offers, value_tier, est_value, images) on public.listings to authenticated;

-- ───────── تخزين الصور ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "badal images upload" on storage.objects;
drop policy if exists "badal images delete" on storage.objects;
drop policy if exists "badal images read own" on storage.objects;
-- كل مستخدم يرفع داخل مجلد باسم معرّفه فقط
create policy "badal images upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
-- الحذف يحتاج صلاحية قراءة ملفات المستخدم نفسه (العرض العام للصور يتم عبر الرابط العلني)
create policy "badal images read own" on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "badal images delete" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────── التحديث الحي لعروض البدل ─────────
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
end $$;

-- ════════════════════════════════════════════════════════════════
--  المرحلة 2: البيع والمزادات
-- ════════════════════════════════════════════════════════════════

-- ───────── نوع العرض: بدل / بيع / مزاد ─────────
alter table public.listings add column if not exists kind text not null default 'swap';
alter table public.listings add column if not exists price integer;            -- سعر البيع أو سعر بداية المزاد
alter table public.listings add column if not exists min_increment integer not null default 10;
alter table public.listings add column if not exists ends_at timestamptz;      -- نهاية المزاد
alter table public.listings add column if not exists current_bid integer;
alter table public.listings add column if not exists top_bidder uuid;  -- بدون مفتاح أجنبي عمداً: مفتاح ثاني إلى profiles يلخبط ربط صاحب العرض في الاستعلامات
alter table public.listings add column if not exists bids_count integer not null default 0;

alter table public.listings drop constraint if exists listings_kind_chk;
alter table public.listings add constraint listings_kind_chk check (
  kind in ('swap', 'sale', 'auction')
  and (kind = 'swap' or (price is not null and price between 1 and 100000000))
  and (kind <> 'auction' or ends_at is not null)
  and min_increment between 1 and 1000000
);

-- ───────── عروض الشراء: مبلغ بدون غرض ─────────
alter table public.offers add column if not exists kind text not null default 'swap';
alter table public.offers alter column item_title drop not null;
alter table public.offers alter column item_category drop not null;
alter table public.offers alter column item_condition drop not null;
alter table public.offers drop constraint if exists offers_kind_chk;
alter table public.offers add constraint offers_kind_chk check (
  (kind = 'swap' and item_title is not null and item_category is not null and item_condition is not null)
  or (kind = 'buy' and cash > 0)
);

-- ───────── المشرفون (يوافقون على تحويلات دخول المزاد) ─────────
create table if not exists public.admins (
  user_id uuid primary key references public.profiles (id) on delete cascade
);
alter table public.admins enable row level security;  -- بدون أي policy: ما ينقرأ إلا من الدوال

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.listing_kind(lid uuid)
returns text language sql stable security definer set search_path = public as $$
  select kind from public.listings where id = lid;
$$;

create or replace function public.auction_open(lid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listings where id = lid and kind = 'auction' and ends_at > now());
$$;

-- ───────── طلبات دخول المزاد (رسم بتحويل بنكي يتحقق منه المشرف) ─────────
create table if not exists public.auction_entries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 2 and 80),   -- اسم صاحب الحساب المحوِّل
  reference text not null default '' check (char_length(reference) <= 80),      -- رقم العملية أو وقت التحويل
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (listing_id, user_id)
);
create index if not exists entries_status_idx on public.auction_entries (status, created_at);
alter table public.auction_entries enable row level security;

drop policy if exists "entries read own or admin" on public.auction_entries;
drop policy if exists "entries request" on public.auction_entries;
drop policy if exists "entries admin decides" on public.auction_entries;
drop policy if exists "entries cancel own" on public.auction_entries;
create policy "entries read own or admin" on public.auction_entries for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "entries request" on public.auction_entries for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and not public.owns_listing(listing_id) and public.auction_open(listing_id));
create policy "entries admin decides" on public.auction_entries for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- صاحب الطلب يلغي طلبه (ليعيد إرساله مثلاً) ما لم يُفعَّل
create policy "entries cancel own" on public.auction_entries for delete to authenticated
  using (user_id = auth.uid() and status <> 'approved');
revoke update on public.auction_entries from anon, authenticated;
grant update (status) on public.auction_entries to authenticated;

-- ───────── المزايدات ─────────
create table if not exists public.bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  bidder_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists bids_listing_idx on public.bids (listing_id, amount desc);
alter table public.bids enable row level security;
drop policy if exists "bids read" on public.bids;
create policy "bids read" on public.bids for select using (true);
-- لا إدراج مباشر: المزايدة عن طريق place_bid فقط
revoke insert, update, delete on public.bids from anon, authenticated;

create or replace function public.place_bid(p_listing uuid, p_amount integer)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  l public.listings;
  uid uuid := auth.uid();
  min_next integer;
begin
  if uid is null then raise exception 'AUTH'; end if;
  select * into l from public.listings where id = p_listing for update;   -- قفل الصف: مزايدتان بنفس اللحظة تتنفّذان بالترتيب
  if not found or l.kind <> 'auction' then raise exception 'NOT_AUCTION'; end if;
  if l.owner_id = uid then raise exception 'OWN'; end if;
  if now() >= l.ends_at then raise exception 'ENDED'; end if;
  if not exists (select 1 from public.auction_entries where listing_id = p_listing and user_id = uid and status = 'approved') then
    raise exception 'NO_ENTRY';
  end if;
  min_next := case when l.current_bid is null then l.price else l.current_bid + l.min_increment end;
  if p_amount is null or p_amount < min_next then raise exception 'LOW:%', min_next; end if;
  if p_amount > 100000000 then raise exception 'HIGH'; end if;

  insert into public.bids (listing_id, bidder_id, amount) values (p_listing, uid, p_amount);
  update public.listings
     set current_bid = p_amount, top_bidder = uid, bids_count = bids_count + 1,
         -- مزايدة في آخر دقيقتين تمدد المزاد دقيقتين (ضد خطف المزاد بآخر ثانية)
         ends_at = case when ends_at - now() < interval '2 minutes' then now() + interval '2 minutes' else ends_at end
   where id = p_listing
   returning * into l;
  return l;
end $$;
revoke execute on function public.place_bid(uuid, integer) from public, anon;
grant execute on function public.place_bid(uuid, integer) to authenticated;

-- ───────── تحديث القواعد السابقة ─────────
-- رقم التواصل ينكشف أيضاً بين صاحب المزاد والفائز بعد انتهاء المزاد
create or replace function public.has_deal_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.offers o join public.listings l on l.id = o.listing_id
    where o.status = 'accepted'
      and ((l.owner_id = other and o.from_id = auth.uid()) or (o.from_id = other and l.owner_id = auth.uid()))
  ) or exists (
    select 1 from public.listings l
    where l.kind = 'auction' and l.ends_at <= now() and l.top_bidder is not null
      and ((l.owner_id = other and l.top_bidder = auth.uid()) or (l.top_bidder = other and l.owner_id = auth.uid()))
  );
$$;

-- عرض البدل على عروض البدل، وعرض الشراء على عروض البيع، ولا عروض على المزادات
drop policy if exists "offers insert" on public.offers;
create policy "offers insert" on public.offers for insert to authenticated
  with check (
    from_id = auth.uid() and status = 'pending' and not public.owns_listing(listing_id)
    and kind = case public.listing_kind(listing_id) when 'swap' then 'swap' when 'sale' then 'buy' end
  );

-- مدة المزاد بين نصف ساعة و31 يوم
drop policy if exists "listings insert own" on public.listings;
create policy "listings insert own" on public.listings for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (kind <> 'auction' or (ends_at > now() + interval '30 minutes' and ends_at < now() + interval '31 days'))
  );

-- المزاد لا يُحذف بعد أول مزايدة
drop policy if exists "listings delete own" on public.listings;
create policy "listings delete own" on public.listings for delete to authenticated
  using (owner_id = auth.uid() and (kind <> 'auction' or bids_count = 0));

-- الأعمدة الجديدة اللي يكتبها صاحب العرض عند النشر فقط (السعر الحالي والعدّاد تكتبها place_bid)
grant insert (kind, price, min_increment, ends_at) on public.listings to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bids') then
    alter publication supabase_realtime add table public.bids;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'auction_entries') then
    alter publication supabase_realtime add table public.auction_entries;
  end if;
end $$;
