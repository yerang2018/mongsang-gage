-- 해몽은 비공개로 저장하고 판매를 선택한 순간에만 장터에 공개해요. 기존 꿈과 잔액은 변경하지 않아요.
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
  if d.hidden_at is not null then
    raise exception '신고가 들어와 운영자가 확인 중인 꿈이에요';
  end if;
  if d.sale_status = 'sold' then
    raise exception '이미 팔린 꿈이에요';
  end if;
  if d.sale_status = 'on_sale' then
    return d.sale_expires_at;
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
  set visibility = 'shared', sale_status = 'on_sale', price_type = 'beads', price = p_price,
      sale_expires_at = null, listed_at = now()
  where id = p_dream;
  return null;
end;
$$;

