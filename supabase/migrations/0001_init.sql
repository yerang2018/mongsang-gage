-- 꿈툰 v2 · 1단계 데이터베이스
-- Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여 넣고 Run.
-- 여러 번 실행해도 안전하도록(이미 있으면 건너뜀) 작성.

-- ───────────────────────── 테이블 ─────────────────────────

-- 회원 프로필 (로그인 계정 1개당 1줄)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text unique check (char_length(nickname) between 2 and 12),
  last_seen_date date,
  created_at timestamptz not null default now()
);

-- 꿈 구슬 장부: 모든 증감을 한 줄씩 기록. 잔액 = delta 합계
create table if not exists public.bead_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,        -- signup, daily_login, dream_record, invite, dream_sold, dream_bought ...
  ref_id uuid,                 -- 관련 꿈/거래 id (있으면)
  ref_key text,                -- 중복 지급 방지용 키 (예: 날짜)
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_key)
);
create index if not exists bead_ledger_user_idx on public.bead_ledger (user_id);

-- 꿈
create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  original_owner_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  excluded_scenes text,
  visibility text not null default 'private' check (visibility in ('private', 'shared')),
  title text,
  symbols text[] not null default '{}',
  luck_score smallint check (luck_score between 0 and 100),
  grade text check (grade in ('SSS', 'SS', 'S', 'A', 'B', 'C')),
  luck_tags text[] not null default '{}',
  headline text,
  interpretation text,
  lucky jsonb,
  panels jsonb,
  image_url text,
  created_at timestamptz not null default now(),
  sale_status text not null default 'none' check (sale_status in ('none', 'on_sale', 'sold')),
  price_type text check (price_type in ('beads', 'cheer')),
  price integer check (price >= 0),
  sale_expires_at timestamptz
);
create index if not exists dreams_owner_idx on public.dreams (owner_id, created_at desc);

-- 거래 (꿈 1개당 최대 1건)
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null unique references public.dreams (id) on delete cascade,
  seller_id uuid not null references public.profiles (id),
  buyer_id uuid not null references public.profiles (id),
  price_type text not null check (price_type in ('beads', 'cheer')),
  price integer not null default 0,
  cheer_message text check (char_length(cheer_message) <= 50),
  certificate_url text,
  created_at timestamptz not null default now(),
  review_status text not null default 'pending' check (review_status in ('pending', 'good', 'skip')),
  check (seller_id <> buyer_id)
);

-- 행동 기록 (가짜 문 클릭, 공유 클릭 등)
create table if not exists public.events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  type text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────── 보안 규칙 (RLS) ─────────────────────────
-- RLS: "이 줄을 누가 볼 수 있나"를 DB가 직접 검사하는 기능.
-- 구슬·거래는 아래 함수로만 바뀌고, 앱에서 직접 쓰기(insert/update)는 막아 둠.

alter table public.profiles enable row level security;
alter table public.bead_ledger enable row level security;
alter table public.dreams enable row level security;
alter table public.trades enable row level security;
alter table public.events enable row level security;

drop policy if exists "프로필은 로그인한 사람 누구나 조회" on public.profiles;
create policy "프로필은 로그인한 사람 누구나 조회" on public.profiles
  for select to authenticated using (true);

drop policy if exists "내 장부만 조회" on public.bead_ledger;
create policy "내 장부만 조회" on public.bead_ledger
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "내가 가진 꿈 또는 내가 원래 꾼 꿈만 조회" on public.dreams;
create policy "내가 가진 꿈 또는 내가 원래 꾼 꿈만 조회" on public.dreams
  for select to authenticated using (owner_id = auth.uid() or original_owner_id = auth.uid());

drop policy if exists "내가 판 거래·산 거래만 조회" on public.trades;
create policy "내가 판 거래·산 거래만 조회" on public.trades
  for select to authenticated using (seller_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists "내 행동 기록만 추가" on public.events;
create policy "내 행동 기록만 추가" on public.events
  for insert to authenticated with check (user_id = auth.uid());

-- ───────────────────────── 함수 ─────────────────────────

-- 가입하면 프로필 생성 + 구슬 1,000 지급 (auth.users 에 새 줄이 생길 때 자동 실행)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, 1000, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 닉네임 설정 (2~12자, 중복 불가)
create or replace function public.set_nickname(new_nickname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  nick text := btrim(new_nickname);
begin
  if auth.uid() is null then
    raise exception '로그인이 필요해요';
  end if;
  if char_length(nick) < 2 or char_length(nick) > 12 then
    raise exception '닉네임은 2~12자로 정해 주세요';
  end if;
  update public.profiles set nickname = nick where id = auth.uid();
exception
  when unique_violation then
    raise exception '이미 누가 쓰고 있는 닉네임이에요';
end;
$$;

-- 매일 첫 접속 구슬 10 (한국 날짜 기준 하루 1번). 이번에 받았으면 true
create or replace function public.claim_daily_bonus()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
  inserted integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (auth.uid(), 10, 'daily_login', today)
  on conflict (user_id, reason, ref_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- 홈 화면 요약: 구슬 잔액, 행운 전달 도장 수
create or replace function public.my_summary()
returns table (bead_balance bigint, luck_stamps bigint)
language sql
security definer
set search_path = ''
stable
as $$
  select
    coalesce((select sum(delta) from public.bead_ledger where user_id = auth.uid()), 0),
    (select count(*) from public.trades where seller_id = auth.uid() and review_status = 'good');
$$;

-- 앱(로그인한 사람)이 부를 수 있는 함수만 열어 둠
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_nickname(text) from public, anon;
revoke all on function public.claim_daily_bonus() from public, anon;
revoke all on function public.my_summary() from public, anon;
grant execute on function public.set_nickname(text) to authenticated;
grant execute on function public.claim_daily_bonus() to authenticated;
grant execute on function public.my_summary() to authenticated;
