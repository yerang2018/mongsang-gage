-- 꿈툰 v2 · 4단계: 꿈 사고팔기
-- 판매 등록(서버 전용) → 판매 카드 조회(누구나, 공유 링크) → 구매(로그인한 사람, 한 트랜잭션) → 매매 증서 조회
-- 거래 규칙은 전부 여기서 강제. 화면에서 막는 건 안내용일 뿐.

-- 판매 등록. 가격은 서버가 grades.ts 기준으로 정해서 넘김 (판매자가 못 바꾸도록 service_role 전용)
-- 돌려주는 값: 판매 마감 시각 (꿈 기록 후 24시간)
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
    return d.sale_expires_at; -- 이미 등록됨: 그대로 둠
  end if;
  if d.visibility <> 'shared' then
    raise exception '나만 보기로 기록한 꿈은 팔 수 없어요';
  end if;
  if d.grade is null or d.grade = 'C' then
    raise exception '액땜몽은 팔 수 없어요';
  end if;
  if now() >= d.created_at + interval '24 hours' then
    raise exception '꿈을 기록한 지 24시간이 지나서 팔 수 없어요';
  end if;
  -- 평몽(B)은 응원 한마디, A등급 이상은 구슬
  if p_price_type not in ('beads', 'cheer')
     or (d.grade = 'B') <> (p_price_type = 'cheer')
     or (p_price_type = 'cheer' and p_price <> 0)
     or (p_price_type = 'beads' and p_price <= 0) then
    raise exception '꿈값이 등급과 맞지 않아요';
  end if;

  select count(*) into sold_today
  from public.trades
  where seller_id = p_seller and (created_at at time zone 'Asia/Seoul')::date = today;
  if sold_today >= 3 then
    raise exception '오늘은 이미 꿈을 3번 팔았어요. 내일 다시 팔아 주세요';
  end if;

  update public.dreams
  set sale_status = 'on_sale', price_type = p_price_type, price = p_price,
      sale_expires_at = d.created_at + interval '24 hours'
  where id = p_dream;
  return d.created_at + interval '24 hours';
end;
$$;

-- 판매 카드: 공유 링크를 연 사람 누구나(로그인 전 포함) 볼 수 있는 정보만. 꿈 원문·상세 해몽은 빼고
create or replace function public.get_sale_card(p_dream uuid)
returns table (
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  price_type text,
  price integer,
  sale_status text,
  sale_expires_at timestamptz,
  expired boolean,
  seller_id uuid,
  seller_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_status,
         d.sale_expires_at, now() >= d.sale_expires_at, d.original_owner_id, p.nickname
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.id = p_dream and d.sale_status in ('on_sale', 'sold');
$$;

-- 구매: 잔액 확인 → 구슬 이동 → 꿈 소유 이전 → 거래 기록을 한 번에.
-- 꿈 줄을 잠가서(for update) 두 명이 동시에 사도 먼저 잠근 한 명만 성공. 돌려주는 값: 거래 id
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

  -- 두 사람의 구슬·판매 횟수를 잠금. 항상 같은 순서로 잠가서 서로 기다리다 멈추는 일을 막음
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
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key) values
      (buyer, -d.price, 'dream_bought', d.id, d.id::text),
      (d.owner_id, d.price, 'dream_sold', d.id, d.id::text);
  end if;

  update public.dreams set owner_id = buyer, sale_status = 'sold' where id = d.id;
  return new_trade;
end;
$$;

-- 매매 증서에 쓸 정보. 판 사람·산 사람만 볼 수 있음
create or replace function public.trade_certificate(p_trade uuid)
returns table (
  trade_id uuid,
  dream_id uuid,
  title text,
  grade text,
  price_type text,
  price integer,
  cheer_message text,
  created_at timestamptz,
  seller_nickname text,
  buyer_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
  select t.id, t.dream_id, d.title, d.grade, t.price_type, t.price, t.cheer_message, t.created_at,
         s.nickname, b.nickname
  from public.trades t
  join public.dreams d on d.id = t.dream_id
  join public.profiles s on s.id = t.seller_id
  join public.profiles b on b.id = t.buyer_id
  where t.id = p_trade and auth.uid() in (t.seller_id, t.buyer_id);
$$;

revoke all on function public.list_dream_for_sale(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.list_dream_for_sale(uuid, uuid, text, integer) to service_role;

revoke all on function public.get_sale_card(uuid) from public;
grant execute on function public.get_sale_card(uuid) to anon, authenticated;

revoke all on function public.buy_dream(uuid, text) from public, anon;
grant execute on function public.buy_dream(uuid, text) to authenticated;

revoke all on function public.trade_certificate(uuid) from public, anon;
grant execute on function public.trade_certificate(uuid) to authenticated;
