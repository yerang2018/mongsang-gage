-- 몽상가게 · 장터 목록·판매 카드에 꿈 상징·점수·썸네일 사진도 (2026-11-04, "배민처럼 실제 상품처럼 다채롭게", "실제 사진을 썸네일로")
-- 길몽 점수는 ★ 줄, 사진은 꿈 상징으로 Unsplash에서 한 번 찾아 dreams.photo 에 저장(서버가 씀, src/lib/photo.ts). 사진이 없으면 상징 이모지 그림
-- 원문·해몽·행운의 색은 여전히 산 사람만

-- 사진 정보: { small, regular, author, author_url, page } (Unsplash 규칙상 작가·출처 표시용)
alter table public.dreams add column if not exists photo jsonb;
-- 돌려주는 칸이 늘어서 drop 후 다시 만듦 (모양만 바뀌고 조건은 0010·0015와 같음). 여러 번 실행해도 안전

drop function if exists public.market_listings(text, text);
create function public.market_listings(p_tag text default null, p_sort text default 'new')
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
  seller_nickname text,
  symbols text[],
  luck_score smallint,
  photo jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_expires_at,
         coalesce(d.listed_at, d.created_at), d.original_owner_id, public.mask_nickname(p.nickname),
         d.symbols, d.luck_score, d.photo
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.sale_status = 'on_sale' and (d.sale_expires_at is null or d.sale_expires_at > now())
    and (p_tag is null or p_tag = any (d.luck_tags))
  order by
    case when p_sort = 'grade' then d.luck_score end desc nulls last,
    coalesce(d.listed_at, d.created_at) desc
  limit 60;
$$;
revoke all on function public.market_listings(text, text) from public;
grant execute on function public.market_listings(text, text) to anon, authenticated;

drop function if exists public.get_sale_card(uuid);
create function public.get_sale_card(p_dream uuid)
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
  has_reading boolean,
  symbols text[],
  luck_score smallint,
  photo jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_status,
         d.sale_expires_at, now() >= d.sale_expires_at, d.original_owner_id, public.mask_nickname(p.nickname),
         d.reading is not null, d.symbols, d.luck_score, d.photo
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.id = p_dream and d.sale_status in ('on_sale', 'sold') and d.hidden_at is null;
$$;
revoke all on function public.get_sale_card(uuid) from public;
grant execute on function public.get_sale_card(uuid) to anon, authenticated;
