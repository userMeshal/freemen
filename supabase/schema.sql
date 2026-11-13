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
create policy "offers withdraw" on public.offers for delete to authenticated using (from_id = auth.uid());

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
