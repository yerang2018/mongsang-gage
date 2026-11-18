-- 몽상가게 · 꿈 선물 (2026-11-03, v3 수능 테스트 3단계)
-- 행운 세트(luck_set): 구슬로 산 꿈을 친구에게(또는 나에게) 선물. 열리면 꿈 원문·자세한 해몽·부적 카드
-- 무료 응원 카드(cheer_card): 꿈 내용 없이 등급·해몽 한 줄·응원 메시지만
-- 받는 사람은 로그인 없이 긴 토큰 링크(/g/<token>)로 열고, 열리는 시각(open_at)은 서버가 시간 비교로 판단 (예약 작업 없음)
-- 기존 데이터는 건드리지 않음. 여러 번 실행해도 안전

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,                       -- 추측할 수 없는 64자 (uuid 두 개)
  kind text not null check (kind in ('luck_set', 'cheer_card')),
  dream_id uuid not null references public.dreams (id) on delete cascade,
  trade_id uuid references public.trades (id) on delete cascade, -- 행운 세트만 (거래 하나에 선물 하나)
  sender_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null check (char_length(sender_name) between 1 and 12),
  recipient_name text not null check (char_length(recipient_name) between 1 and 12),
  message text check (char_length(message) <= 50),
  open_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  first_viewed_at timestamptz,                      -- 열린 뒤 처음 본 때
  view_count integer not null default 0             -- 열린 뒤 본 횟수
);
create unique index if not exists gifts_trade_uidx on public.gifts (trade_id) where trade_id is not null;
create index if not exists gifts_sender_idx on public.gifts (sender_id, created_at desc);

-- 보안 규칙: 보낸 사람만 내 선물 목록을 볼 수 있음. 받는 사람은 get_gift(토큰)으로만
alter table public.gifts enable row level security;
drop policy if exists "내가 보낸 선물만 조회" on public.gifts;
create policy "내가 보낸 선물만 조회" on public.gifts
  for select to authenticated using (sender_id = auth.uid());

-- 선물 만들기 (로그인한 사람). 돌려주는 값: 토큰
create or replace function public.create_gift(
  p_kind text,
  p_dream uuid,
  p_sender_name text,
  p_recipient_name text,
  p_message text,
  p_open_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  d public.dreams;
  t public.trades;
  sender text := btrim(coalesce(p_sender_name, ''));
  recipient text := btrim(coalesce(p_recipient_name, ''));
  msg text := nullif(btrim(coalesce(p_message, '')), '');
  opens timestamptz := coalesce(p_open_at, now());
  today date := (now() at time zone 'Asia/Seoul')::date;
  sent_today integer;
  tok text;
begin
  if me is null then
    raise exception '로그인이 필요해요';
  end if;
  if not exists (select 1 from public.profiles where id = me and nickname is not null) then
    raise exception '닉네임을 먼저 정해 주세요';
  end if;
  if char_length(sender) not between 1 and 12 or char_length(recipient) not between 1 and 12 then
    raise exception '보내는 사람·받는 사람 이름은 1~12자로 적어 주세요';
  end if;
  if char_length(msg) > 50 then
    raise exception '응원 한마디는 50자 이내로 적어 주세요';
  end if;
  if opens < now() - interval '1 minute' then
    raise exception '열리는 시각은 지금보다 뒤여야 해요';
  end if;
  if opens > now() + interval '60 days' then
    raise exception '열리는 시각은 60일 안으로 정해 주세요';
  end if;

  select * into d from public.dreams where id = p_dream;
  if d.id is null then
    raise exception '꿈을 찾을 수 없어요';
  end if;

  if p_kind = 'luck_set' then
    -- 내가 산 꿈만 (거래 하나에 선물 하나)
    select * into t from public.trades where dream_id = p_dream and buyer_id = me;
    if t.id is null then
      raise exception '내가 산 꿈만 행운 세트로 선물할 수 있어요';
    end if;
    if exists (select 1 from public.gifts where trade_id = t.id) then
      raise exception '이 꿈은 이미 선물을 만들었어요';
    end if;
  elsif p_kind = 'cheer_card' then
    -- 꿈 내용은 안 보내므로 장터에 공개된 꿈(판매 중·팔림)이나 내 꿈이면 됨
    if d.grade is null or d.grade = 'C' then
      raise exception '액땜몽은 응원 카드로 보낼 수 없어요';
    end if;
    if not (d.sale_status in ('on_sale', 'sold') or d.original_owner_id = me or d.owner_id = me) then
      raise exception '장터에 나온 꿈이나 내 꿈만 보낼 수 있어요';
    end if;
    select count(*) into sent_today from public.gifts
    where sender_id = me and kind = 'cheer_card' and (created_at at time zone 'Asia/Seoul')::date = today;
    if sent_today >= 20 then
      raise exception '응원 카드는 하루 20장까지 보낼 수 있어요';
    end if;
  else
    raise exception '선물 종류가 올바르지 않아요';
  end if;

  tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.gifts (token, kind, dream_id, trade_id, sender_id, sender_name, recipient_name, message, open_at)
  values (tok, p_kind, p_dream, t.id, me, sender, recipient, msg, opens);
  return tok;
end;
$$;

-- 선물 열어 보기 (로그인 없이 누구나, 토큰을 아는 사람만). 열리기 전엔 이름·열리는 시각만
-- 열린 뒤: 행운 세트 = 꿈 원문·자세한 해몽까지, 응원 카드 = 등급·해몽 한 줄·메시지만
-- p_count = true 면 열린 뒤 본 횟수를 셈 (부적 그림을 불러올 땐 false)
create or replace function public.get_gift(p_token text, p_count boolean default true)
returns table (
  kind text,
  sender_name text,
  recipient_name text,
  open_at timestamptz,
  opened boolean,
  message text,
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  dream_text text,
  interpretation text,
  reading jsonb,
  lucky jsonb,
  on_sale boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.gifts;
  d public.dreams;
  is_open boolean;
begin
  if p_token is null or char_length(p_token) <> 64 then
    return;
  end if;
  select * into g from public.gifts where token = p_token;
  if g.id is null then
    return;
  end if;
  is_open := now() >= g.open_at;
  if not is_open then
    return query select g.kind, g.sender_name, g.recipient_name, g.open_at, false,
      null::text, null::uuid, null::text, null::text, null::text[], null::text, null::text, null::text, null::jsonb, null::jsonb, null::boolean;
    return;
  end if;

  if p_count then
    update public.gifts set view_count = view_count + 1, first_viewed_at = coalesce(first_viewed_at, now()) where id = g.id;
  end if;
  select * into d from public.dreams where id = g.dream_id;
  return query select g.kind, g.sender_name, g.recipient_name, g.open_at, true,
    g.message, d.id, d.title, d.grade, d.luck_tags, d.headline,
    case when g.kind = 'luck_set' then d.text end,
    case when g.kind = 'luck_set' then d.interpretation end,
    case when g.kind = 'luck_set' then d.reading end,
    case when g.kind = 'luck_set' then d.lucky end,
    d.sale_status = 'on_sale';
end;
$$;

revoke all on function public.create_gift(text, uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.create_gift(text, uuid, text, text, text, timestamptz) to authenticated;
revoke all on function public.get_gift(text, boolean) from public;
grant execute on function public.get_gift(text, boolean) to anon, authenticated;
