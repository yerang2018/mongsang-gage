-- 몽상가게 · 구슬 하나로 통일 (2026-11-03, v3 수능 테스트 2단계)
-- 꿈은 언제나 구슬로만 사고(평몽도 30구슬, 응원 한마디 거래는 새로 안 받음), 구슬이 모자라면 돈으로 충전(0012, 1,000원에 70구슬)
-- 꿈값: 천운몽 500 · 대길몽 300 · 길몽 200 · 소길몽 100 · 평몽 30 (src/lib/grades.ts 와 같게)
-- 판매자는 꿈값을 그대로 받음 (2026-11-04: 거래 수수료 없음, 몽상가게 몫 30%는 충전할 때 받음)
-- 무료 구슬: 익명 가입 50, 이메일 연결 +70 (처음부터 이메일 가입은 120), 꿈 기록 10 (하루 3번), 매일 첫 방문 구슬은 없앰
-- 기존 잔액은 10분의 1로 (충전한 구슬은 빼고), 판매 중인 꿈의 꿈값도 새 등급표로
-- ⚠️ 이 파일은 v3 앱을 배포하는 그때 실행 (먼저 실행하면 지금 사이트의 꿈값·지급량과 안 맞음). 여러 번 실행해도 안전

-- ───────────── 1. 기존 잔액 10분의 1 ─────────────
-- 충전(bead_purchase)·충전 환불(bead_refund)은 이미 새 단위라 빼고 계산. 한 사람당 한 번만 (unique)
insert into public.bead_ledger (user_id, delta, reason, ref_key)
select user_id, floor(old_sum / 10.0)::int - old_sum, 'unit_change', 'v3'
from (
  select user_id, sum(delta)::int as old_sum
  from public.bead_ledger
  where reason not in ('bead_purchase', 'bead_refund', 'unit_change')
  group by user_id
) x
where old_sum > 0 and floor(old_sum / 10.0)::int <> old_sum
on conflict (user_id, reason, ref_key) do nothing;

-- ───────────── 2. 판매 중인 꿈·내밀어 둔 꿈의 꿈값을 새 등급표로 ─────────────
update public.dreams
set price_type = 'beads',
    price = case grade when 'SSS' then 500 when 'SS' then 300 when 'S' then 200 when 'A' then 100 when 'B' then 30 end
where sale_status = 'on_sale' and grade in ('SSS', 'SS', 'S', 'A', 'B');

update public.request_responses x
set price_type = 'beads',
    price = case d.grade when 'SSS' then 500 when 'SS' then 300 when 'S' then 200 when 'A' then 100 when 'B' then 30 end
from public.dreams d, public.dream_requests r
where d.id = x.dream_id and r.id = x.request_id and r.status = 'open' and d.sale_status <> 'sold'
  and d.grade in ('SSS', 'SS', 'S', 'A', 'B');

-- ───────────── 3. 무료 구슬 ─────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, case when coalesce(new.is_anonymous, false) then 50 else 120 end, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;

create or replace function public.handle_user_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    insert into public.bead_ledger (user_id, delta, reason, ref_key)
    values (new.id, 70, 'account_link', 'account_link')
    on conflict (user_id, reason, ref_key) do nothing;
  end if;
  return new;
end;
$$;

-- 매일 첫 방문 구슬은 없앰 (함수는 남겨 두고 항상 "안 줌")
create or replace function public.claim_daily_bonus()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return false;
end;
$$;

-- 꿈 기록: 0009와 같고 지급량만 10
create or replace function public.record_dream(
  p_owner uuid,
  p_text text,
  p_excluded_scenes text,
  p_visibility text,
  p_title text,
  p_symbols text[],
  p_luck_score smallint,
  p_grade text,
  p_luck_tags text[],
  p_headline text,
  p_interpretation text,
  p_lucky jsonb,
  p_panels jsonb,
  p_reading jsonb
)
returns table (dream_id uuid, beads_awarded integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
  today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
  done_today integer;
  awarded integer := 0;
begin
  insert into public.dreams (
    owner_id, original_owner_id, text, excluded_scenes, visibility, title, symbols,
    luck_score, grade, luck_tags, headline, interpretation, lucky, panels, reading
  ) values (
    p_owner, p_owner, p_text, p_excluded_scenes, coalesce(p_visibility, 'private'), p_title, p_symbols,
    p_luck_score, p_grade, p_luck_tags, p_headline, p_interpretation, p_lucky, p_panels, p_reading
  )
  returning id into new_id;

  perform pg_advisory_xact_lock(hashtext('dream_record:' || p_owner::text));
  select count(*) into done_today
  from public.bead_ledger
  where user_id = p_owner and reason = 'dream_record' and ref_key like today || '#%';

  if done_today < 3 then
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (p_owner, 10, 'dream_record', new_id, today || '#' || (done_today + 1));
    awarded := 10;
  end if;

  return query select new_id, awarded;
end;
$$;

-- ───────────── 4. 판매 등록·꿈 내밀기: 꿈값은 언제나 구슬 ─────────────
-- 0010과 같고, 꿈값 검사만 "구슬 + 0보다 큼"으로 (평몽도 구슬)
create or replace function public.list_dream_for_sale(
  p_seller uuid,
  p_dream uuid,
  p_price_type text,
  p_price integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dreams;
  today date := (now() at time zone 'Asia/Seoul')::date;
  sold_today integer;
begin
  select * into d from public.dreams where id = p_dream for update;
  if d.id is null then
    raise exception '꿈을 찾을 수 없어요';
  end if;
  if d.owner_id <> p_seller or d.original_owner_id <> p_seller then
    raise exception '내가 꾼 꿈만 팔 수 있어요 (산 꿈은 되팔 수 없어요)';
  end if;
  if d.sale_status = 'sold' then
    raise exception '이미 팔린 꿈이에요';
  end if;
  if d.sale_status = 'on_sale' then
    return d.sale_expires_at;
  end if;
  if d.visibility <> 'shared' then
    raise exception '나만 보기로 기록한 꿈은 팔 수 없어요';
  end if;
  if d.grade is null or d.grade = 'C' then
    raise exception '액땜몽은 팔 수 없어요';
  end if;
  if p_price_type <> 'beads' or p_price is null or p_price <= 0 then
    raise exception '꿈값이 등급과 맞지 않아요';
  end if;

  select count(*) into sold_today
  from public.trades
  where seller_id = p_seller and (created_at at time zone 'Asia/Seoul')::date = today;
  if sold_today >= 3 then
    raise exception '오늘은 이미 꿈을 3번 팔았어요. 내일 다시 팔아 주세요';
  end if;

  update public.dreams
  set sale_status = 'on_sale', price_type = 'beads', price = p_price,
      sale_expires_at = null, listed_at = now()
  where id = p_dream;
  return null;
end;
$$;

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
  if p_price_type <> 'beads' or p_price is null or p_price <= 0 then
    raise exception '꿈값이 등급과 맞지 않아요';
  end if;

  insert into public.request_responses (request_id, dream_id, responder_id, price_type, price)
  values (p_request, p_dream, p_responder, 'beads', p_price)
  returning id into new_id;
  return new_id;
end;
$$;

-- ───────────── 5. 구매: 판매자는 꿈값 그대로 (수수료 없음) ─────────────
-- 0003과 같고, 응원 한마디는 언제나 선택 (예전 '응원 한마디 거래'가 남아 있으면 그때만 필수)
create or replace function public.buy_dream(p_dream uuid, p_cheer text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  buyer uuid := auth.uid();
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
  if not exists (select 1 from public.profiles where id = buyer and nickname is not null) then
    raise exception '닉네임을 먼저 정해 주세요';
  end if;

  select * into d from public.dreams where id = p_dream for update;
  if d.id is null or d.sale_status = 'none' then
    raise exception '판매 중인 꿈이 아니에요';
  end if;
  if d.sale_status = 'sold' then
    raise exception '아쉽게도 이미 다른 친구가 산 꿈이에요';
  end if;
  if now() >= d.sale_expires_at then
    raise exception '판매 시간이 끝난 꿈이에요';
  end if;
  if d.owner_id = buyer or d.original_owner_id = buyer then
    raise exception '내 꿈은 내가 살 수 없어요';
  end if;
  if char_length(msg) > 50 then
    raise exception '응원 한마디는 50자 이내로 적어 주세요';
  end if;
  if d.price_type = 'cheer' and msg is null then
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

  if d.price_type = 'beads' then
    select coalesce(sum(delta), 0) into balance from public.bead_ledger where user_id = buyer;
    if balance < d.price then
      raise exception '꿈 구슬이 모자라요 (필요 %개, 보유 %개)', d.price, balance;
    end if;
  end if;

  insert into public.trades (dream_id, seller_id, buyer_id, price_type, price, cheer_message)
  values (d.id, d.owner_id, buyer, d.price_type, coalesce(d.price, 0), msg)
  returning id into new_trade;

  if d.price_type = 'beads' and d.price > 0 then
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (buyer, -d.price, 'dream_bought', d.id, d.id::text);
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (d.owner_id, d.price, 'dream_sold', d.id, d.id::text);
  end if;

  update public.dreams set owner_id = buyer, sale_status = 'sold' where id = d.id;
  return new_trade;
end;
$$;

-- 0008과 같고, 판매자에게 꿈값 그대로
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
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (buyer, -resp.price, 'dream_bought', d.id, d.id::text);
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (d.owner_id, resp.price, 'dream_sold', d.id, d.id::text);
  end if;

  update public.dreams
  set owner_id = buyer, sale_status = 'sold', price_type = resp.price_type, price = resp.price
  where id = d.id;
  update public.dream_requests set status = 'done' where id = r.id;
  return new_trade;
end;
$$;
