-- 몽상가게 · 24시간 규칙 없애기 (2026-10-29 사용자: "24시간 룰 없애자")
-- 꿈은 기록한 지 얼마가 지났든 팔 수 있고, 장터에 올린 꿈은 팔릴 때까지 그대로 (sale_expires_at = null 이면 마감 없음)
-- 꿈 구해요에 내미는 꿈의 "기록 후 3일" 제한도 함께 없앰 (꿈 구해요 글 자체는 3일 동안 열려 있는 그대로)

-- 지금 판매 중인 꿈(시간이 지나 장터에서 빠졌던 꿈 포함)은 마감 없이 다시 장터에
update public.dreams set sale_expires_at = null where sale_status = 'on_sale';

-- 판매 등록: 0003과 같고, 24시간 검사를 빼고 마감을 두지 않음 (돌려주는 값은 null)
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
      sale_expires_at = null, listed_at = now()
  where id = p_dream;
  return null;
end;
$$;

-- 장터 목록: 마감 없는 꿈도 보이게. 정렬은 새로 나온 순(기본) / 등급 높은 순 ('ending'은 예전 주소 호환용으로 새로 나온 순)
create or replace function public.market_listings(p_tag text default null, p_sort text default 'new')
returns table (
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  price_type text,
  price integer,
  sale_expires_at timestamptz,
  listed_at timestamptz,
  seller_id uuid,
  seller_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_expires_at,
         coalesce(d.listed_at, d.created_at), d.original_owner_id, public.mask_nickname(p.nickname)
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.sale_status = 'on_sale' and (d.sale_expires_at is null or d.sale_expires_at > now())
    and (p_tag is null or p_tag = any (d.luck_tags))
  order by
    case when p_sort = 'grade' then d.luck_score end desc nulls last,
    coalesce(d.listed_at, d.created_at) desc
  limit 60;
$$;

-- 꿈 내밀기: 0008과 같고 "기록 후 3일" 검사만 뺌
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
