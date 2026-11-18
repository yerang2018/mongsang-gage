-- 꿈툰 v2 · 상세 해몽: 상징 풀이·장면 풀이·점수 이유·행운이 오는 때·오늘의 조언을 dreams.reading 에 저장
-- 산 사람(과 꾼 사람)만 봄. 판매 카드에는 "있다/없다"만 알려 줌

alter table public.dreams add column if not exists reading jsonb;

-- record_dream 에 p_reading 추가 (예전 13개 인자 버전은 지움)
drop function if exists public.record_dream(uuid, text, text, text, text, text[], smallint, text, text[], text, text, jsonb, jsonb);

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

  -- 같은 사용자의 동시 요청이 겹치지 않도록 잠금
  perform pg_advisory_xact_lock(hashtext('dream_record:' || p_owner::text));
  select count(*) into done_today
  from public.bead_ledger
  where user_id = p_owner and reason = 'dream_record' and ref_key like today || '#%';

  if done_today < 3 then
    insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
    values (p_owner, 30, 'dream_record', new_id, today || '#' || (done_today + 1));
    awarded := 30;
  end if;

  return query select new_id, awarded;
end;
$$;

revoke all on function public.record_dream(uuid, text, text, text, text, text[], smallint, text, text[], text, text, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_dream(uuid, text, text, text, text, text[], smallint, text, text[], text, text, jsonb, jsonb, jsonb)
  to service_role;

-- 판매 카드에 has_reading(상세 해몽이 있는 꿈인지) 추가. 돌려주는 모양이 바뀌어서 지우고 다시 만듦
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
  has_reading boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select d.id, d.title, d.grade, d.luck_tags, d.headline, d.price_type, d.price, d.sale_status,
         d.sale_expires_at, now() >= d.sale_expires_at, d.original_owner_id, p.nickname, d.reading is not null
  from public.dreams d
  join public.profiles p on p.id = d.original_owner_id
  where d.id = p_dream and d.sale_status in ('on_sale', 'sold');
$$;

revoke all on function public.get_sale_card(uuid) from public;
grant execute on function public.get_sale_card(uuid) to anon, authenticated;
