-- 꿈툰 v2 · 공개 꿈 장터: 판매 중인 꿈을 누구나(로그인 전 포함) 둘러봄
-- 보여 주는 건 판매 카드와 같은 정보뿐 (꿈 원문·상세 해몽은 산 사람만)

create index if not exists dreams_on_sale_idx on public.dreams (sale_expires_at) where sale_status = 'on_sale';

-- 장터 목록. p_tag: 운 태그로 거르기(null=전체), p_sort: ending(마감 임박) / new(새로 나온) / grade(등급 높은)
create or replace function public.market_listings(p_tag text default null, p_sort text default 'ending')
returns table (
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  price_type text,
  price integer,
  sale_expires_at timestamptz,
  seller_id uuid,
  seller_nickname text
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_expires_at,
         d.original_owner_id, p.nickname
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.sale_status = 'on_sale' and d.sale_expires_at > now()
    and (p_tag is null or p_tag = any (d.luck_tags))
  order by
    case when p_sort = 'grade' then d.luck_score end desc nulls last,
    case when p_sort = 'new' then d.created_at end desc nulls last,
    d.sale_expires_at asc
  limit 60;
$$;

-- 방금 팔린 꿈 (장터 활기용). 누가 샀는지는 보여 주지 않음
create or replace function public.market_recent_sales()
returns table (dream_id uuid, title text, grade text, price_type text, price integer, sold_at timestamptz)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, t.price_type, t.price, t.created_at
  from public.trades t
  join public.dreams d on d.id = t.dream_id
  order by t.created_at desc
  limit 5;
$$;

revoke all on function public.market_listings(text, text) from public;
grant execute on function public.market_listings(text, text) to anon, authenticated;
revoke all on function public.market_recent_sales() from public;
grant execute on function public.market_recent_sales() to anon, authenticated;
