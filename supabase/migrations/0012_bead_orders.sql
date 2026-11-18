-- 몽상가게 · 구슬 충전 주문 (2026-11-03, v3 수능 테스트 1단계)
-- 꿈은 언제나 구슬로만 사고, 구슬이 모자라면 돈으로 충전. 결제는 카카오페이 송금 + 주문번호 4자리 → 운영자가 /admin 에서 [입금 확인]
-- 기존 데이터는 건드리지 않음 (구슬 단위 변경·꿈값은 2단계). 여러 번 실행해도 안전.

create table if not exists public.bead_orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null check (order_code ~ '^[0-9]{4}$'), -- 송금 메모에 적는 4자리
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_won integer not null check (amount_won > 0),          -- 주문 때 정한 금액 (설정이 바뀌어도 그대로)
  beads integer not null check (beads > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  closed_at timestamptz,                                          -- 환불·취소한 때
  handled_by uuid references public.profiles (id)                 -- 확인·환불한 관리자
);
-- 입금 대기 중인 주문끼리는 번호가 겹치지 않게 (끝난 주문의 번호는 다시 쓸 수 있음)
create unique index if not exists bead_orders_pending_code_uidx on public.bead_orders (order_code) where status = 'pending';
create index if not exists bead_orders_user_idx on public.bead_orders (user_id, created_at desc);
create index if not exists bead_orders_status_idx on public.bead_orders (status, created_at desc);

-- 보안 규칙: 내 주문만 볼 수 있음. 만들기·바꾸기는 아래 함수(서버 비밀 키)로만
alter table public.bead_orders enable row level security;
drop policy if exists "내 충전 주문만 조회" on public.bead_orders;
create policy "내 충전 주문만 조회" on public.bead_orders
  for select to authenticated using (user_id = auth.uid());

-- 충전 주문 만들기 (서버 전용: 금액·구슬 수는 서버가 src/lib/beads.ts 설정으로 정해서 넘김)
-- 한 사람이 입금 대기 주문을 너무 많이 쌓지 못하게 3개까지
create or replace function public.create_bead_order(p_user uuid, p_amount_won integer, p_beads integer)
returns table (order_id uuid, order_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending integer;
  code text;
  new_id uuid;
begin
  if p_amount_won <= 0 or p_beads <= 0 then
    raise exception '충전 금액이 올바르지 않아요';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and nickname is not null) then
    raise exception '닉네임을 먼저 정해 주세요';
  end if;
  select count(*) into pending from public.bead_orders where user_id = p_user and status = 'pending';
  if pending >= 3 then
    raise exception '입금 대기 중인 충전이 3개 있어요. 입금하거나 취소한 뒤 다시 해 주세요';
  end if;

  -- 입금 대기 주문과 겹치지 않는 4자리 번호 (겹치면 다시 뽑기)
  for i in 1..30 loop
    code := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    begin
      insert into public.bead_orders (order_code, user_id, amount_won, beads)
      values (code, p_user, p_amount_won, p_beads)
      returning id into new_id;
      return query select new_id, code;
      return;
    exception when unique_violation then
      -- 번호가 겹침 → 다시
    end;
  end loop;
  raise exception '주문번호를 만들지 못했어요. 잠시 후 다시 해 주세요';
end;
$$;

-- 입금 확인 → 구슬 지급 (서버 전용, 관리자 확인은 서버 코드가 함). 두 번 눌러도 한 번만 지급
create or replace function public.confirm_bead_order(p_order uuid, p_admin uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.bead_orders;
begin
  select * into o from public.bead_orders where id = p_order for update;
  if o.id is null then
    raise exception '주문을 찾을 수 없어요';
  end if;
  if o.status = 'paid' then
    return 0; -- 이미 확인함
  end if;
  if o.status <> 'pending' then
    raise exception '입금 대기 중인 주문만 확인할 수 있어요';
  end if;

  update public.bead_orders set status = 'paid', paid_at = now(), handled_by = p_admin where id = p_order;
  insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
  values (o.user_id, o.beads, 'bead_purchase', o.id, o.id::text)
  on conflict (user_id, reason, ref_key) do nothing;
  return o.beads;
end;
$$;

-- 환불·취소 (서버 전용). 입금 전이면 취소, 입금 후면 그 구슬을 쓰지 않았을 때만 환불(구슬 회수). 실제 돈 돌려주기는 운영자가 직접
create or replace function public.refund_bead_order(p_order uuid, p_admin uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.bead_orders;
  bal integer;
begin
  select * into o from public.bead_orders where id = p_order for update;
  if o.id is null then
    raise exception '주문을 찾을 수 없어요';
  end if;
  if o.status = 'pending' then
    update public.bead_orders set status = 'cancelled', closed_at = now(), handled_by = p_admin where id = p_order;
    return 'cancelled';
  end if;
  if o.status <> 'paid' then
    raise exception '이미 끝난 주문이에요';
  end if;

  -- 같은 사람의 구슬 변동이 동시에 일어나지 않게 (buy_dream 과 같은 잠금)
  perform pg_advisory_xact_lock(hashtext('user:' || o.user_id::text));
  select coalesce(sum(delta), 0) into bal from public.bead_ledger where user_id = o.user_id;
  if bal < o.beads then
    raise exception '이미 충전 구슬을 써서 환불할 수 없어요 (남은 구슬 %개, 충전 %개)', bal, o.beads;
  end if;
  update public.bead_orders set status = 'refunded', closed_at = now(), handled_by = p_admin where id = p_order;
  insert into public.bead_ledger (user_id, delta, reason, ref_id, ref_key)
  values (o.user_id, -o.beads, 'bead_refund', o.id, o.id::text);
  return 'refunded';
end;
$$;

revoke all on function public.create_bead_order(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.create_bead_order(uuid, integer, integer) to service_role;
revoke all on function public.confirm_bead_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_bead_order(uuid, uuid) to service_role;
revoke all on function public.refund_bead_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.refund_bead_order(uuid, uuid) to service_role;
