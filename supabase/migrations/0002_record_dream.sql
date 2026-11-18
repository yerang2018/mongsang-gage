-- 꿈툰 v2 · 2단계: 꿈 저장 + 꿈 기록 구슬 30 (하루 3회)
-- 등급은 서버가 AI 점수로 정해서 넘김. 사용자가 직접 부를 수 없도록 service_role(서버 비밀 키)만 실행 가능.

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
  p_panels jsonb
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
    luck_score, grade, luck_tags, headline, interpretation, lucky, panels
  ) values (
    p_owner, p_owner, p_text, p_excluded_scenes, coalesce(p_visibility, 'private'), p_title, p_symbols,
    p_luck_score, p_grade, p_luck_tags, p_headline, p_interpretation, p_lucky, p_panels
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

revoke all on function public.record_dream(uuid, text, text, text, text, text[], smallint, text, text[], text, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_dream(uuid, text, text, text, text, text[], smallint, text, text[], text, text, jsonb, jsonb)
  to service_role;
