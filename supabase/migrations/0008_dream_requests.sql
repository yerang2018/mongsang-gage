-- 꿈툰 v2 · 5단계: 꿈 구해요
-- "내일 면접인데 합격운 꿈 구해요" 요청 → 링크·장터에서 친구들이 자기 꿈을 내밂 → 요청한 사람이 하나를 삼
-- 내미는 꿈은 기록 후 3일까지(일반 판매는 24시간). 꿈값은 일반 판매와 같은 등급표(grades.ts)
-- 공개되는 닉네임은 0007의 mask_nickname으로 가림

create table if not exists public.dream_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  luck_tag text not null check (luck_tag in ('재물운', '합격운', '연애운', '건강운', '귀인운')),
  message text check (char_length(message) <= 40),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 days'
);
create index if not exists dream_requests_open_idx on public.dream_requests (expires_at) where status = 'open';

-- 내민 꿈. 한 요청에 한 사람은 꿈 하나만. 꿈값은 내밀 때 서버가 등급표로 정해 둠
create table if not exists public.request_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.dream_requests (id) on delete cascade,
  dream_id uuid not null references public.dreams (id) on delete cascade,
  responder_id uuid not null references public.profiles (id) on delete cascade,
  price_type text not null check (price_type in ('beads', 'cheer')),
  price integer not null default 0 check (price >= 0),
  created_at timestamptz not null default now(),
  unique (request_id, responder_id)
);

-- 어느 거래가 꿈 구해요로 이뤄졌는지 (통계용)
alter table public.trades add column if not exists request_id uuid references public.dream_requests (id) on delete set null;

alter table public.dream_requests enable row level security;
alter table public.request_responses enable row level security;

-- 직접 읽기는 내 요청·내가 내민 꿈만 (홈 화면용). 공개 화면은 아래 함수로
drop policy if exists "내 꿈 구해요만 조회" on public.dream_requests;
create policy "내 꿈 구해요만 조회" on public.dream_requests
  for select to authenticated using (requester_id = auth.uid());
drop policy if exists "내 요청에 온 꿈·내가 내민 꿈만 조회" on public.request_responses;
create policy "내 요청에 온 꿈·내가 내민 꿈만 조회" on public.request_responses
  for select to authenticated using (
    responder_id = auth.uid()
    or exists (select 1 from public.dream_requests r where r.id = request_id and r.requester_id = auth.uid())
  );

-- 꿈 구하기. 한 사람이 동시에 열어 둘 수 있는 요청은 하나
create or replace function public.create_dream_request(p_tag text, p_message text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  msg text := nullif(btrim(coalesce(p_message, '')), '');
  new_id uuid;
begin
  if me is null then
    raise exception '로그인이 필요해요';
  end if;
  if not exists (select 1 from public.profiles where id = me and nickname is not null) then
    raise exception '닉네임을 먼저 정해 주세요';
  end if;
  if p_tag is null or p_tag not in ('재물운', '합격운', '연애운', '건강운', '귀인운') then
    raise exception '어떤 운이 필요한지 골라 주세요';
  end if;
  if char_length(msg) > 40 then
    raise exception '하고 싶은 말은 40자 이내로 적어 주세요';
  end if;
  perform pg_advisory_xact_lock(hashtext('request:' || me::text));
  if exists (select 1 from public.dream_requests where requester_id = me and status = 'open' and expires_at > now()) then
    raise exception '이미 꿈을 구하고 있어요. 지금 요청이 끝나면 새로 구할 수 있어요';
  end if;
  insert into public.dream_requests (requester_id, luck_tag, message) values (me, p_tag, msg) returning id into new_id;
  return new_id;
end;
$$;

-- 꿈 내밀기 (서버 전용: 꿈값은 서버가 grades.ts로 정해서 넘김)
create or replace function public.offer_dream(
  p_responder uuid,
  p_request uuid,
  p_dream uuid,
  p_price_type text,
  p_price integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.dream_requests;
  d public.dreams;
  offers integer;
  new_id uuid;
begin
  select * into r from public.dream_requests where id = p_request for update;
  if r.id is null then
    raise exception '꿈 구해요 글을 찾을 수 없어요';
  end if;
  if r.status <> 'open' or r.expires_at <= now() then
    raise exception '이미 끝난 꿈 구해요예요';
  end if;
  if r.requester_id = p_responder then
    raise exception '내 꿈 구해요에는 내 꿈을 내밀 수 없어요';
  end if;
  if exists (select 1 from public.request_responses where request_id = p_request and responder_id = p_responder) then
    raise exception '이미 꿈을 내밀었어요';
  end if;
  select count(*) into offers from public.request_responses where request_id = p_request;
  if offers >= 20 then
    raise exception '내민 꿈이 너무 많아요 (최대 20개)';
  end if;

  select * into d from public.dreams where id = p_dream;
  if d.id is null or d.owner_id <> p_responder or d.original_owner_id <> p_responder then
    raise exception '내가 꾼 꿈만 내밀 수 있어요';
  end if;
  if d.sale_status = 'sold' then
    raise exception '이미 팔린 꿈이에요';
  end if;
  if d.visibility <> 'shared' then
    raise exception '나만 보기로 기록한 꿈은 내밀 수 없어요';
  end if;
  if d.grade is null or d.grade = 'C' then
    raise exception '액땜몽은 내밀 수 없어요';
  end if;
  if now() >= d.created_at + interval '3 days' then
    raise exception '기록한 지 3일이 지난 꿈은 내밀 수 없어요';
  end if;
  if p_price_type not in ('beads', 'cheer')
     or (d.grade = 'B') <> (p_price_type = 'cheer')
     or (p_price_type = 'cheer' and p_price <> 0)
     or (p_price_type = 'beads' and p_price <= 0) then
    raise exception '꿈값이 등급과 맞지 않아요';
  end if;

  insert into public.request_responses (request_id, dream_id, responder_id, price_type, price)
  values (p_request, p_dream, p_responder, p_price_type, p_price)
  returning id into new_id;
  return new_id;
end;
$$;

-- 내민 꿈 사기: 요청한 사람만. buy_dream과 같은 순서(잔액 확인 → 구슬 이동 → 꿈 소유 이전 → 거래 기록)
create or replace function public.buy_offered_dream(p_response uuid, p_cheer text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := auth.uid();
  resp public.request_responses;
  r public.dream_requests;
  d public.dreams;
  msg text := nullif(btrim(coalesce(p_cheer, '')), '');
  today date := (now() at time zone 'Asia/Seoul')::date;
  sold_today integer;
  balance bigint;
  new_trade uuid;
begin
  if buyer is null then
    raise exception '로그인이 필요해요';
  end if;
  select * into resp from public.request_responses where id = p_response;
  if resp.id is null then
    raise exception '내민 꿈을 찾을 수 없어요';
  end if;
  select * into r from public.dream_requests where id = resp.request_id for update;
  if r.requester_id <> buyer then
    raise exception '꿈을 구한 사람만 살 수 있어요';
  end if;
  if r.status <> 'open' then
    raise exception '이미 꿈을 골랐어요';
  end if;
  if r.expires_at <= now() then
    raise exception '꿈 구해요 시간이 끝났어요';
  end if;

  select * into d from public.dreams where id = resp.dream_id for update;
  if d.sale_status = 'sold' then
    raise exception '아쉽게도 그 사이 다른 친구가 산 꿈이에요';
  end if;
  if d.owner_id <> resp.responder_id then
    raise exception '더 이상 살 수 없는 꿈이에요';
  end if;
  if char_length(msg) > 50 then
    raise exception '응원 한마디는 50자 이내로 적어 주세요';
  end if;
  if resp.price_type = 'cheer' and msg is null then
    raise exception '응원 한마디를 적어 주세요';
  end if;

  perform pg_advisory_xact_lock(hashtext('user:' || least(buyer, d.owner_id)::text));
  perform pg_advisory_xact_lock(hashtext('user:' || greatest(buyer, d.owner_id)::text));

  select count(*) into sold_today
  from public.trades
  where seller_id = d.owner_id and (created_at at time zone 'Asia/Seoul')::date = today;
  if sold_today >= 3 then
    raise exception '이 친구는 오늘 이미 꿈을 3번 팔았어요. 내일 다시 와 주세요';
  end if;

  if resp.price_type = 'beads' then
    select coalesce(sum(delta), 0) into balance from public.bead_ledger where user_id = buyer;
    if balance < resp.price then
      raise exception '꿈 구슬이 모자라요 (필요 %개, 보유 %개)', resp.price, balance;
    end if;
  end if;

  insert into public.trades (dream_id, seller_id, buyer_id, price_type, price, cheer_message, request_id)
  values (d.id, d.owner_id, buyer, resp.price_type, resp.price, msg, r.id)
  returning id into new_trade;

  if resp.price_type = 'beads' and resp.price > 0 then
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key) values
      (buyer, -resp.price, 'dream_bought', d.id, d.id::text),
      (d.owner_id, resp.price, 'dream_sold', d.id, d.id::text);
  end if;

  update public.dreams
  set owner_id = buyer, sale_status = 'sold', price_type = resp.price_type, price = resp.price
  where id = d.id;
  update public.dream_requests set status = 'done' where id = r.id;
  return new_trade;
end;
$$;

-- 꿈 구해요 글 한 장 (누구나, 링크로 열림)
create or replace function public.get_dream_request(p_request uuid)
returns table (
  request_id uuid,
  luck_tag text,
  message text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  requester_id uuid,
  requester_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
  select r.id, r.luck_tag, r.message, r.status, r.created_at, r.expires_at, r.requester_id, public.mask_nickname(p.nickname)
  from public.dream_requests r
  join public.profiles p on p.id = r.requester_id
  where r.id = p_request;
$$;

-- 그 글에 내민 꿈들 (판매 카드와 같은 정보만: 원문·상세 해몽은 빼고)
create or replace function public.request_offers(p_request uuid)
returns table (
  response_id uuid,
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  price_type text,
  price integer,
  created_at timestamptz,
  responder_id uuid,
  responder_nickname text,
  sold boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select x.id, d.id, d.title, d.grade, d.luck_tags, d.headline, x.price_type, x.price, x.created_at,
         x.responder_id, public.mask_nickname(p.nickname), d.sale_status = 'sold'
  from public.request_responses x
  join public.dreams d on d.id = x.dream_id
  join public.profiles p on p.id = x.responder_id
  where x.request_id = p_request
  order by d.luck_score desc nulls last, x.created_at;
$$;

-- 장터에 보이는 열린 꿈 구해요 목록
create or replace function public.open_dream_requests()
returns table (
  request_id uuid,
  luck_tag text,
  message text,
  created_at timestamptz,
  expires_at timestamptz,
  requester_id uuid,
  requester_nickname text,
  offer_count integer
)
language sql
security definer
set search_path = ''
stable
as $$
  select r.id, r.luck_tag, r.message, r.created_at, r.expires_at, r.requester_id, public.mask_nickname(p.nickname),
         (select count(*)::integer from public.request_responses x where x.request_id = r.id)
  from public.dream_requests r
  join public.profiles p on p.id = r.requester_id
  where r.status = 'open' and r.expires_at > now()
  order by r.created_at desc
  limit 20;
$$;

revoke all on function public.create_dream_request(text, text) from public, anon;
grant execute on function public.create_dream_request(text, text) to authenticated;
revoke all on function public.offer_dream(uuid, uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.offer_dream(uuid, uuid, uuid, text, integer) to service_role;
revoke all on function public.buy_offered_dream(uuid, text) from public, anon;
grant execute on function public.buy_offered_dream(uuid, text) to authenticated;
revoke all on function public.get_dream_request(uuid) from public;
grant execute on function public.get_dream_request(uuid) to anon, authenticated;
revoke all on function public.request_offers(uuid) from public;
grant execute on function public.request_offers(uuid) to anon, authenticated;
revoke all on function public.open_dream_requests() from public;
grant execute on function public.open_dream_requests() to anon, authenticated;
