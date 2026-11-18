-- 몽상가게 · 행동 지표와 AI 원가 기록 (2026-10-30)
-- 기존 데이터는 건드리지 않고 칸·표·함수만 더함. 여러 번 실행해도 안전.
-- 적용: Supabase 대시보드 → SQL Editor → 이 파일 전체 붙여 넣고 Run. 적용한 뒤에 앱을 배포 (앱은 적용 전에도 오류 없이 돌지만 기록이 안 쌓임)
-- 자세한 지표 정의·조회 방법: docs/metrics.md

-- ───────────── 1. 행동 기록(events)에 칸 추가 ─────────────
-- visitor_id: 로그인 전 방문자도 구분하는 무작위 번호 (쿠키 kk_vid, /api/track 이 만듦)
-- app_env: production / preview / development (로컬 개발에서 쌓인 기록을 빼기 위해)
-- dedup_key: 같은 방문자의 같은 기록을 한 번만 세기 위한 키 (예: 첫 방문 'first', 공유 링크 방문 'sale:<꿈 id>')
alter table public.events add column if not exists visitor_id uuid;
alter table public.events add column if not exists app_env text;
alter table public.events add column if not exists dedup_key text;
-- dedup_key 가 비어 있는 줄(공유 버튼 누름 등)은 NULL 이라 서로 겹치지 않음
create unique index if not exists events_dedup_uidx on public.events (visitor_id, type, dedup_key);
create index if not exists events_type_time_idx on public.events (type, created_at);
create index if not exists events_visitor_idx on public.events (visitor_id);

-- 브라우저가 직접 넣을 수 있는 기록은 예전 가짜 문 클릭만 (지표용 기록은 /api/track 서버만 씀 → 다른 사람이 숫자를 부풀리기 어렵게)
drop policy if exists "내 행동 기록만 추가" on public.events;
create policy "내 행동 기록만 추가" on public.events
  for insert to authenticated
  with check (user_id = auth.uid() and type = 'fake_door' and visitor_id is null and app_env is null and dedup_key is null);

-- ───────────── 2. AI 호출 기록 ─────────────
-- 해몽 요청 1번(request_id) 안에서 모델을 바꿔 다시 시도하면 attempt 가 1, 2, 3… 으로 늘어남
-- 꿈 내용·해몽 내용은 저장하지 않음. 토큰 수는 Gemini 응답의 usageMetadata 그대로 (없으면 NULL)
create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  app_env text,
  call_type text not null,            -- interpret(꿈 해몽) | reading_backfill(예전 꿈 상세 해몽 채우기)
  request_id uuid not null,
  attempt smallint not null,
  model text not null,
  outcome text not null check (outcome in ('success', 'error')),
  error_status integer,               -- HTTP 상태 (429·503 등)
  error_kind text,                    -- api | timeout | format | other
  thinking_fallback boolean not null default false,
  latency_ms integer,
  prompt_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  total_tokens integer,
  user_id uuid references public.profiles (id) on delete set null
);
create index if not exists ai_calls_time_idx on public.ai_calls (created_at);
-- 보안 규칙만 켜고 허용 규칙은 없음 → 로그인한 사람·비로그인 모두 읽기/쓰기 불가, 서버(service_role)만 씀
alter table public.ai_calls enable row level security;

-- ───────────── 3. 지표에서 뺄 계정 (운영자·시험 계정) ─────────────
-- 운영자가 직접 넣음. 예: insert into public.metrics_excluded_users (user_id, note)
--   select id, '운영자 시험 계정' from public.profiles where nickname = '무니' on conflict do nothing;
create table if not exists public.metrics_excluded_users (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.metrics_excluded_users enable row level security;

-- ───────────── 4. 집계 함수 (서버 비밀 키로만 실행) ─────────────
-- p_from ~ p_to: 한국 날짜 기준, 둘 다 포함. 핵심 행동(꿈 기록·판매·구매·꿈 구해요·꿈 내밀기)은 서버가 확정한 표에서 직접 셈 → 새로고침·재시도로 두 번 세지지 않음
create or replace function public.metrics_report(p_from date, p_to date)
returns table (metric text, numerator numeric, denominator numeric, note text)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  t0 timestamptz := (p_from::timestamp at time zone 'Asia/Seoul');
  t1 timestamptz := ((p_to + 1)::timestamp at time zone 'Asia/Seoul');
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  return query
  with
  ex as (select x.user_id from public.metrics_excluded_users x),
  -- 방문자 ↔ 계정 연결 (로그인 상태로 방문하면 session_link 가 남음)
  link as (
    select distinct e.visitor_id, e.user_id from public.events e
    where e.type = 'session_link' and e.visitor_id is not null and e.user_id is not null
  ),
  exv as (select l.visitor_id from link l where l.user_id in (select user_id from ex)),
  ev as (
    select e.* from public.events e
    where e.created_at >= t0 and e.created_at < t1 and e.app_env = 'production'
      and (e.user_id is null or e.user_id not in (select user_id from ex))
      and (e.visitor_id is null or e.visitor_id not in (select visitor_id from exv))
  ),
  visitors as (select distinct e.visitor_id from ev e where e.type = 'first_visit'),
  new_users as (
    select p.id, p.nickname from public.profiles p
    where p.created_at >= t0 and p.created_at < t1 and p.id not in (select user_id from ex)
  ),
  named as (select n.id from new_users n where n.nickname is not null),
  dreams_in as (
    select d.* from public.dreams d
    where d.created_at >= t0 and d.created_at < t1 and d.original_owner_id not in (select user_id from ex)
  ),
  listed_in as (
    select d.* from public.dreams d
    where d.listed_at >= t0 and d.listed_at < t1 and d.original_owner_id not in (select user_id from ex)
  ),
  trades_in as (
    select t.* from public.trades t
    where t.created_at >= t0 and t.created_at < t1
      and t.buyer_id not in (select user_id from ex) and t.seller_id not in (select user_id from ex)
  ),
  requests_in as (
    select r.* from public.dream_requests r
    where r.created_at >= t0 and r.created_at < t1 and r.requester_id not in (select user_id from ex)
  ),
  -- 공유 링크 방문 (판 사람·요청한 사람 본인이 연 것은 뺌)
  share_visits as (
    select distinct e.visitor_id from ev e
    left join link l on l.visitor_id = e.visitor_id
    left join public.dreams d on e.meta ->> 'target' = 'sale' and d.id::text = e.meta ->> 'id'
    left join public.dream_requests q on e.meta ->> 'target' = 'request' and q.id::text = e.meta ->> 'id'
    where e.type = 'share_visit'
      and (l.user_id is null or (l.user_id is distinct from d.original_owner_id and l.user_id is distinct from q.requester_id))
  ),
  -- 다음 주 재방문: 사람마다 첫 핵심 행동일(0일) → 7~13일에 핵심 행동이 또 있으면 재방문. 13일째가 다 지난 사람만 계산
  core as (
    select d.original_owner_id as uid, d.created_at as at from public.dreams d
    union all select d.original_owner_id, d.listed_at from public.dreams d where d.listed_at is not null
    union all select t.buyer_id, t.created_at from public.trades t
    union all select r.requester_id, r.created_at from public.dream_requests r
    union all select x.responder_id, x.created_at from public.request_responses x
  ),
  core_days as (
    select c.uid, (c.at at time zone 'Asia/Seoul')::date as day from core c
    where c.uid not in (select user_id from ex)
  ),
  first_day as (select c.uid, min(c.day) as d0 from core_days c group by c.uid),
  cohort as (select f.uid, f.d0 from first_day f where f.d0 between p_from and p_to and f.d0 + 13 < today),
  returned as (
    select distinct c.uid from cohort c
    join core_days k on k.uid = c.uid and k.day between c.d0 + 7 and c.d0 + 13
  ),
  ai as (select a.* from public.ai_calls a where a.created_at >= t0 and a.created_at < t1),
  ai_req as (
    select a.request_id, bool_or(a.outcome = 'success') as ok, count(*) as tries
    from ai a where a.app_env = 'production' group by a.request_id
  )
  select '1 첫 방문 (방문자 수)', (select count(*) from visitors)::numeric, null::numeric, '처음 온 기기 수 (쿠키 기준, 지운 사람은 또 셈)'
  union all select '2 닉네임 설정 완료 / 새 계정', (select count(*) from named)::numeric, (select count(*) from new_users)::numeric, '새 계정 = 익명 시작 포함'
  union all select '2b 첫 방문 → 닉네임 설정',
    (select count(distinct v.visitor_id) from visitors v join link l on l.visitor_id = v.visitor_id join public.profiles p on p.id = l.user_id where p.nickname is not null)::numeric,
    (select count(*) from visitors)::numeric, '분모: 기간 안 첫 방문자, 분자: 그중 닉네임을 정한 계정과 연결된 방문자'
  union all select '3 첫 꿈 저장 / 닉네임 정한 새 계정',
    (select count(*) from named n where exists (select 1 from public.dreams d where d.original_owner_id = n.id))::numeric,
    (select count(*) from named)::numeric, '분자: 지금까지 꿈을 1개 이상 저장한 사람'
  union all select '3b 저장된 꿈 수', (select count(*) from dreams_in)::numeric, null::numeric, '해몽 성공 후 저장된 꿈 (힘든 꿈·실패는 저장 안 됨)'
  union all select '4 판매 등록 수', (select count(*) from listed_in)::numeric, null::numeric, 'listed_at 기준'
  union all select '4b 판매 등록한 사람 / 꿈 저장한 사람',
    (select count(distinct l.original_owner_id) from listed_in l)::numeric,
    (select count(distinct d.original_owner_id) from dreams_in d)::numeric, null
  union all select '5 공유 시도', (select count(*) from ev e where e.type = 'share_attempt')::numeric, null::numeric, '공유 창 열기 + 링크 복사 누름'
  union all select '5b 공유 창 완료 / 공유 창 열기',
    (select count(*) from ev e where e.type = 'share_complete')::numeric,
    (select count(*) from ev e where e.type = 'share_attempt' and e.meta ->> 'method' = 'native')::numeric, '완료 = 공유할 앱을 골랐다는 뜻. 상대가 받았다는 증거 아님'
  union all select '5c 링크 복사 완료', (select count(*) from ev e where e.type = 'link_copied')::numeric, null::numeric, '복사됐다는 뜻. 보냈다는 증거 아님'
  union all select '5d 공유 창 취소', (select count(*) from ev e where e.type = 'share_cancel')::numeric, null::numeric, null
  union all select '6 공유 링크 방문자', (select count(*) from share_visits)::numeric, null::numeric, '?via= 링크로 들어온 방문자 (판 사람 본인 제외)'
  union all select '6b 공유 링크 방문 → 닉네임 설정',
    (select count(distinct s.visitor_id) from share_visits s join link l on l.visitor_id = s.visitor_id join public.profiles p on p.id = l.user_id where p.nickname is not null)::numeric,
    (select count(*) from share_visits)::numeric, null
  union all select '7 꿈 구매 성공', (select count(*) from trades_in)::numeric, null::numeric, '거래 표 기준 (꿈 하나당 거래 하나라 중복 없음)'
  union all select '7b 구매한 사람', (select count(distinct t.buyer_id) from trades_in t)::numeric, null::numeric, null
  union all select '8 꿈 구해요 등록', (select count(*) from requests_in)::numeric, null::numeric, null
  union all select '9 다음 주 재방문 (7~13일)', (select count(*) from returned)::numeric, (select count(*) from cohort)::numeric,
    '분모: 첫 핵심 행동일이 기간 안이고 13일째가 지난 사람. 핵심 행동 = 꿈 기록·판매 등록·구매·꿈 구해요·꿈 내밀기'
  union all select '10 구슬 거래 건수', (select count(*) from trades_in t where t.price_type = 'beads')::numeric, null::numeric, '놀이용 구슬. 현금 매출 아님'
  union all select '10b 구슬 거래액 (구슬 개수)', (select coalesce(sum(t.price), 0) from trades_in t where t.price_type = 'beads')::numeric, null::numeric, '놀이용 구슬. 현금 매출 아님'
  union all select '10c 응원 한마디 거래 건수', (select count(*) from trades_in t where t.price_type = 'cheer')::numeric, null::numeric, null
  union all select '11 현금 매출', 0::numeric, null::numeric, '결제 기능 없음'
  union all select '11b 유료 전환율', null::numeric, null::numeric, '미측정 (결제 기능 없음)'
  union all select '12 AI 해몽 요청 / 성공', (select count(*) from ai_req r where r.ok)::numeric, (select count(*) from ai_req)::numeric, '배포 사이트만. 요청 1번 = 모델을 바꿔 다시 시도한 것까지 묶음'
  union all select '12b AI 다시 시도한 요청', (select count(*) from ai_req r where r.tries > 1)::numeric, (select count(*) from ai_req)::numeric, null
  union all select '12c AI 호출 시도 (전체 환경)', (select count(*) from ai)::numeric, null::numeric, '로컬 개발·점수 시험 포함, 실패 포함'
  union all select '12d AI 실패한 시도 (전체 환경)', (select count(*) from ai a where a.outcome = 'error')::numeric, null::numeric, null
  union all select '12e AI 입력 토큰 (전체 환경)', (select coalesce(sum(a.prompt_tokens), 0) from ai a)::numeric, null::numeric, '실패한 시도는 대부분 토큰 정보 없음'
  union all select '12f AI 출력 토큰 (전체 환경)', (select coalesce(sum(a.output_tokens), 0) from ai a)::numeric, null::numeric, null
  union all select '12g AI 생각 토큰 (전체 환경)', (select coalesce(sum(a.thinking_tokens), 0) from ai a)::numeric, null::numeric, '보통 출력 요금으로 계산됨'
  union all select '12h AI 비용', null::numeric, null::numeric, '비용 미확인: 요율을 넣지 않음 (scripts/metrics.ts 의 AI_PRICES 에 공식 요율을 넣으면 환산)';
end;
$$;

revoke all on function public.metrics_report(date, date) from public, anon, authenticated;
grant execute on function public.metrics_report(date, date) to service_role;
