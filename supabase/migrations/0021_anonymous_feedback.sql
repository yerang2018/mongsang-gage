-- 작성자와 연결하지 않는 의견. 시각 대신 날짜만 저장합니다.
create table if not exists public.anonymous_feedback (
  submission_id uuid primary key,
  kind text not null check (kind in ('reading', 'trade')),
  rating smallint check (rating between 1 and 5),
  message text not null default '' check (char_length(message) <= 1000),
  submitted_on date not null default current_date,
  check (rating is not null or char_length(trim(message)) > 0)
);
alter table public.anonymous_feedback enable row level security;
revoke all on public.anonymous_feedback from public, anon, authenticated;
grant select, insert on public.anonymous_feedback to service_role;
