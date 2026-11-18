-- 몽상가게 · 판매 서약·신고·자동 숨김 (2026-11-04, v3 수능 테스트 4단계)
-- 서약: 판매 등록·꿈 내밀기 때 "제가 실제로 꾼 꿈입니다…" 체크 → dreams.sale_pledged_at (서버 API가 기록)
-- 신고: 사유는 확인할 수 있는 4가지만(베낀 꿈·개인정보·불쾌한 내용·광고). 한 사람이 한 꿈에 한 번.
--       서로 다른 3명이 신고하면 자동 숨김 → 장터·판매 카드·방금 팔린 꿈·꿈 구해요에서 빠짐 → 관리자가 [문제없음]/[숨김 유지]
-- 무료 응원 카드는 뺌(2026-11-04 사용자 결정): 새 응원 카드를 못 만들게 막음 (이미 만든 링크는 그대로 열림)
-- 0013(구슬 단위)과 순서가 바뀌어도 되게, 0013이 고치는 함수는 건드리지 않음. 여러 번 실행해도 안전

alter table public.dreams add column if not exists sale_pledged_at timestamptz; -- 판매 서약에 체크한 때
alter table public.dreams add column if not exists hidden_at timestamptz;       -- 신고로 숨긴 때 (null = 보임)
alter table public.dreams add column if not exists hidden_prev_status text;     -- 숨기기 전 판매 상태 (문제없음이면 되돌림)

create table if not exists public.dream_reports (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('copied', 'personal_info', 'offensive', 'ad')),
  detail text check (char_length(detail) <= 300),  -- 베낀 꿈이면 출처 링크 등
  status text not null default 'open' check (status in ('open', 'dismissed', 'upheld')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  unique (dream_id, reporter_id)
);
create index if not exists dream_reports_open_idx on public.dream_reports (status, created_at desc);
create index if not exists dream_reports_reporter_idx on public.dream_reports (reporter_id, created_at desc);

-- 보안 규칙: 내가 한 신고만 조회. 쓰기는 report_dream 함수로만
alter table public.dream_reports enable row level security;
drop policy if exists "내가 한 신고만 조회" on public.dream_reports;
create policy "내가 한 신고만 조회" on public.dream_reports
  for select to authenticated using (reporter_id = auth.uid());

-- 새 무료 응원 카드는 못 만듦. 새로 넣을 때만 막음 (check 조건은 이미 만든 카드의 본 횟수 갱신까지 막아서 트리거로)
create or replace function public.gifts_no_new_cheer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kind <> 'luck_set' then
    raise exception '응원 카드는 이제 보낼 수 없어요. 꿈을 사서 행운 세트로 보내 주세요';
  end if;
  return new;
end;
$$;
drop trigger if exists gifts_no_new_cheer on public.gifts;
create trigger gifts_no_new_cheer before insert on public.gifts
  for each row execute function public.gifts_no_new_cheer();

-- 숨기기 (내부용): 판매 중이면 장터에서 내림. 팔린 꿈은 산 사람 것 그대로, 공개 목록에서만 빠짐
-- 꿈 구해요에 내민 것은 철회 (숨긴 꿈을 고를 수 없게)
create or replace function public.hide_reported_dream(p_dream uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dreams
  set hidden_at = now(),
      hidden_prev_status = sale_status,
      sale_status = case when sale_status = 'on_sale' then 'none' else sale_status end
  where id = p_dream and hidden_at is null;
  delete from public.request_responses x
  using public.dream_requests r
  where x.dream_id = p_dream and r.id = x.request_id and r.status = 'open';
end;
$$;
revoke all on function public.hide_reported_dream(uuid) from public, anon, authenticated;

-- 신고하기 (로그인한 사람). 돌려주는 값: 'reported' 또는 'hidden'(이번 신고로 3명이 되어 숨김)
create or replace function public.report_dream(p_dream uuid, p_reason text, p_detail text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d public.dreams;
  n integer;
begin
  if uid is null then
    raise exception '로그인이 필요해요';
  end if;
  if p_reason is null or p_reason not in ('copied', 'personal_info', 'offensive', 'ad') then
    raise exception '신고 사유를 골라 주세요';
  end if;
  if char_length(coalesce(p_detail, '')) > 300 then
    raise exception '설명은 300자까지 적을 수 있어요';
  end if;

  select * into d from public.dreams where id = p_dream for update;
  -- 남에게 보이는 꿈만: 장터에 나왔거나 팔렸거나 꿈 구해요에 내민 꿈
  if d.id is null or not (
    d.sale_status in ('on_sale', 'sold') or d.hidden_at is not null
    or exists (select 1 from public.request_responses x where x.dream_id = d.id)
  ) then
    raise exception '신고할 수 없는 꿈이에요';
  end if;
  if d.original_owner_id = uid then
    raise exception '내 꿈은 신고할 수 없어요';
  end if;
  if (select count(*) from public.dream_reports r where r.reporter_id = uid and r.created_at > now() - interval '1 day') >= 10 then
    raise exception '오늘은 신고를 너무 많이 했어요. 내일 다시 해 주세요';
  end if;

  insert into public.dream_reports (dream_id, reporter_id, reason, detail)
  values (d.id, uid, p_reason, nullif(btrim(coalesce(p_detail, '')), ''))
  on conflict (dream_id, reporter_id) do nothing;
  if not found then
    raise exception '이미 신고한 꿈이에요. 운영자가 확인할게요';
  end if;

  if d.hidden_at is not null then
    return 'hidden';
  end if;
  select count(*) into n from public.dream_reports r where r.dream_id = d.id and r.status = 'open';
  if n >= 3 then
    perform public.hide_reported_dream(d.id);
    return 'hidden';
  end if;
  return 'reported';
end;
$$;
revoke all on function public.report_dream(uuid, text, text) from public, anon;
grant execute on function public.report_dream(uuid, text, text) to authenticated;

-- 관리자 처리 (서버 비밀 키로만). p_action: 'dismiss' = 문제없음(다시 보이게), 'hide' = 숨김 유지(신고 인정)
create or replace function public.resolve_dream_reports(p_dream uuid, p_action text, p_admin uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.dreams;
begin
  if p_action not in ('dismiss', 'hide') then
    raise exception '처리 방법이 잘못됐어요';
  end if;
  select * into d from public.dreams where id = p_dream for update;
  if d.id is null then
    raise exception '꿈을 찾을 수 없어요';
  end if;

  update public.dream_reports
  set status = case when p_action = 'dismiss' then 'dismissed' else 'upheld' end,
      resolved_at = now(), resolved_by = p_admin
  where dream_id = d.id and status = 'open';

  if p_action = 'hide' then
    perform public.hide_reported_dream(d.id);
    return 'hidden';
  end if;
  if d.hidden_at is not null then
    update public.dreams
    set sale_status = case when hidden_prev_status = 'on_sale' and sale_status = 'none' then 'on_sale' else sale_status end,
        hidden_at = null, hidden_prev_status = null
    where id = d.id;
  end if;
  return 'shown';
end;
$$;
revoke all on function public.resolve_dream_reports(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.resolve_dream_reports(uuid, text, uuid) to service_role;

-- ── 숨긴 꿈은 공개 화면에서 빼기 (0007·0008의 최신 모양에 hidden_at 조건만 더함) ──
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
  where d.id = p_dream and d.sale_status in ('on_sale', 'sold') and d.hidden_at is null;
$$;

create or replace function public.market_recent_sales()
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
  where d.hidden_at is null
  order by t.created_at desc
  limit 5;
$$;

create or replace function public.request_offers(p_request uuid)
returns table (
  response_id uuid,
  dream_id uuid,
  title text,
  grade text,
  luck_tags text[],
  headline text,
  price_type text,
  price integer,
  created_at timestamptz,
  responder_id uuid,
  responder_nickname text,
  sold boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select x.id, d.id, d.title, d.grade, d.luck_tags, d.headline, x.price_type, x.price, x.created_at,
         x.responder_id, public.mask_nickname(p.nickname), d.sale_status = 'sold'
  from public.request_responses x
  join public.dreams d on d.id = x.dream_id
  join public.profiles p on p.id = x.responder_id
  where x.request_id = p_request and d.hidden_at is null
  order by d.luck_score desc nulls last, x.created_at;
$$;

grant execute on function public.get_sale_card(uuid) to anon, authenticated;
grant execute on function public.market_recent_sales() to anon, authenticated;
grant execute on function public.request_offers(uuid) to anon, authenticated;
