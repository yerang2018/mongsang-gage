-- 몽상가게 · 구슬 더 넉넉하게 (2026-10-29 사용자: "구슬이 너무 적어서 뭘 살 수가 없어")
-- 시작 선물 300 → 1,000 (이메일로 바로 가입하면 1,700 = 1,000 + 연결 선물 700), 매일 첫 방문 10 → 50, 꿈 기록 30 → 100 (하루 3번까지)
-- 이미 가입한 계정은 한 번만 +700 채워 줌 (예전 300 → 1,000 / 예전 1,000 → 1,700)
-- 금액을 바꾸면 src/lib/grades.ts 의 BEAD_REWARDS 도 같이 고칠 것

-- 이미 있던 계정 채워 주기: 이 파일을 만든 시각 전에 가입한 계정만, 한 번만 (다시 실행해도 그대로)
insert into public.bead_ledger (user_id, delta, reason, ref_key)
select id, 700, 'signup_topup', '2026-10-29'
from public.profiles
where created_at < '2026-10-28T17:00:00Z'
on conflict (user_id, reason, ref_key) do nothing;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, case when coalesce(new.is_anonymous, false) then 1000 else 1700 end, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;

create or replace function public.claim_daily_bonus()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD');
  inserted integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (auth.uid(), 50, 'daily_login', today)
  on conflict (user_id, reason, ref_key) do nothing;
  get diagnostics inserted = row_count;
  return inserted > 0;
end;
$$;

-- 꿈 기록: 0005와 같고 지급량만 100
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
    values (p_owner, 100, 'dream_record', new_id, today || '#' || (done_today + 1));
    awarded := 100;
  end if;

  return query select new_id, awarded;
end;
$$;
