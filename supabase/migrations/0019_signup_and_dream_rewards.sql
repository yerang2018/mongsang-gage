-- 새 가입 300구슬, 꿈 기록 50구슬(하루 3회). 기존 잔액과 주문은 변경하지 않아요.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, 300, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;


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
    values (p_owner, 50, 'dream_record', new_id, today || '#' || (done_today + 1));
    awarded := 50;
  end if;

  return query select new_id, awarded;
end;
$$;

