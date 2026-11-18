-- 꿈툰 v2 · 벼룩시장처럼 활발한 장터: "누가(닉네임 가림), 몇 분 전에 내놓았는지"를 보여 줌
-- 공개되는 곳(장터·판매 카드)의 닉네임은 첫 글자만 남기고 가림: 예랑 → 예*, 김예랑 → 김**, 꿈꾸는토끼 → 꿈**
-- 매매 증서(거래 당사자만 봄)는 그대로 실제 닉네임

alter table public.dreams add column if not exists listed_at timestamptz;
-- 예전에 판매 등록한 꿈은 등록 시각을 몰라서 꿈 기록 시각으로 채움
update public.dreams set listed_at = created_at where sale_status in ('on_sale', 'sold') and listed_at is null;

-- 닉네임 가리기. 첫 글자만 남김(세 글자 실명도 끝 글자가 안 보이게), 별표는 최대 2개(길이를 드러내지 않게)
create or replace function public.mask_nickname(n text)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(n, 1) || repeat('*', least(char_length(n) - 1, 2));
$$;

-- 판매 등록: 0003과 같고, 내놓은 시각(listed_at)만 기록
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
      sale_expires_at = d.created_at + interval '24 hours', listed_at = now()
  where id = p_dream;
  return d.created_at + interval '24 hours';
end;
$$;

-- 장터 목록: 닉네임 가림 + 내놓은 시각. 돌려주는 모양이 바뀌어서 지우고 다시 만듦
drop function if exists public.market_listings(text, text);
create function public.market_listings(p_tag text default null, p_sort text default 'ending')
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
  where d.sale_status = 'on_sale' and d.sale_expires_at > now()
    and (p_tag is null or p_tag = any (d.luck_tags))
  order by
    case when p_sort = 'grade' then d.luck_score end desc nulls last,
    case when p_sort = 'new' then coalesce(d.listed_at, d.created_at) end desc nulls last,
    d.sale_expires_at asc
  limit 60;
$$;

-- 방금 팔린 꿈: 판 사람(가림)도 함께. 산 사람은 여전히 숨김
drop function if exists public.market_recent_sales();
create function public.market_recent_sales()
returns table (dream_id uuid, title text, grade text, price_type text, price integer, sold_at timestamptz, seller_nickname text)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, t.price_type, t.price, t.created_at, public.mask_nickname(p.nickname)
  from public.trades t
  join public.dreams d on d.id = t.dream_id
  join public.profiles p on p.id = t.seller_id
  order by t.created_at desc
  limit 5;
$$;

-- 판매 카드도 누구나 열 수 있으니 닉네임을 가림 (모양은 0005와 같음)
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
  seller_nickname text,
  has_reading boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_status,
         d.sale_expires_at, now() >= d.sale_expires_at, d.original_owner_id, public.mask_nickname(p.nickname),
         d.reading is not null
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.id = p_dream and d.sale_status in ('on_sale', 'sold');
$$;

revoke all on function public.market_listings(text, text) from public;
grant execute on function public.market_listings(text, text) to anon, authenticated;
revoke all on function public.market_recent_sales() from public;
grant execute on function public.market_recent_sales() to anon, authenticated;
