create table public.tournament_archives (
 year integer primary key,
 state jsonb not null,
 revision bigint not null,
 archived_at timestamptz not null default now()
);
alter table public.tournament_archives enable row level security;
revoke all on public.tournament_archives from anon, authenticated;
grant select on public.tournament_archives to authenticated;
create policy archive_member_read on public.tournament_archives for select to authenticated
using (exists (select 1 from public.members where user_id = (select auth.uid())));
insert into public.tournament_archives(year,state,revision)
select 2026,state,revision from public.tournaments where id=1;
