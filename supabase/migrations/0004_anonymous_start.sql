-- 꿈툰 v2 · 닉네임만 적고 바로 시작 (익명 로그인)
-- 가입 구슬: 익명으로 시작하면 300, 나중에 이메일을 연결하면 +700 (합계 1,000). 처음부터 이메일로 가입하면 1,000
-- 금액을 바꾸면 src/lib/grades.ts 의 BEAD_REWARDS 문구도 같이 고칠 것

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.bead_ledger (user_id, delta, reason, ref_key)
  values (new.id, case when coalesce(new.is_anonymous, false) then 300 else 1000 end, 'signup', 'signup')
  on conflict (user_id, reason, ref_key) do nothing;
  return new;
end;
$$;

-- 익명 계정에 이메일이 연결되면(인증 메일 확인 순간 is_anonymous 가 false 로 바뀜) 구슬 +700, 한 번만
create or replace function public.handle_user_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    insert into public.bead_ledger (user_id, delta, reason, ref_key)
    values (new.id, 700, 'account_link', 'account_link')
    on conflict (user_id, reason, ref_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_linked on auth.users;
create trigger on_auth_user_linked
  after update of is_anonymous on auth.users
  for each row execute function public.handle_user_linked();

revoke all on function public.handle_user_linked() from public, anon, authenticated;
