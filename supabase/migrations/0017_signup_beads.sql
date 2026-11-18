-- 신규 가입부터 200구슬(이메일 가입 270), 이메일 연결 보너스 70. 기존 잔액과 주문은 변경하지 않아요.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, case when coalesce(new.is_anonymous, false) then 200 else 270 end, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;


create or replace function public.handle_user_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    insert into public.bead_ledger (user_id, delta, reason, ref_key)
    values (new.id, 70, 'account_link', 'account_link')
    on conflict (user_id, reason, ref_key) do nothing;
  end if;
  return new;
end;
$$;

