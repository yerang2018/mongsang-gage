-- 새 꿈 기록과 장터 등록을 하나의 거래로 처리해요. 기존 비공개 꿈은 변경하지 않아요.
create or replace function public.record_market_dream(
  p_owner uuid, p_text text, p_excluded_scenes text, p_price integer,
  p_title text, p_symbols text[], p_luck_score smallint, p_grade text,
  p_luck_tags text[], p_headline text, p_interpretation text,
  p_lucky jsonb, p_panels jsonb, p_reading jsonb
)
returns table (dream_id uuid, beads_awarded integer)
language plpgsql security definer set search_path = ''
as $$
declare
  saved record;
  expected_price integer;
begin
  expected_price := case p_grade when 'SSS' then 500 when 'SS' then 300 when 'S' then 200 when 'A' then 100 when 'B' then 30 when 'C' then 0 else null end;
  if expected_price is null or p_price is distinct from expected_price then
    raise exception '꿈값이 등급과 맞지 않아요';
  end if;
  select * into saved from public.record_dream(
    p_owner, p_text, p_excluded_scenes, 'private', p_title, p_symbols,
    p_luck_score, p_grade, p_luck_tags, p_headline, p_interpretation,
    p_lucky, p_panels, p_reading
  );
  if expected_price > 0 then
    update public.dreams set visibility = 'shared', sale_status = 'on_sale',
      price_type = 'beads', price = expected_price, listed_at = now(),
      sale_expires_at = null, sale_pledged_at = now()
    where id = saved.dream_id;
  end if;
  return query select saved.dream_id::uuid, saved.beads_awarded::integer;
end;
$$;
revoke all on function public.record_market_dream(uuid,text,text,integer,text,text[],smallint,text,text[],text,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.record_market_dream(uuid,text,text,integer,text,text[],smallint,text,text[],text,text,jsonb,jsonb,jsonb) to service_role;
