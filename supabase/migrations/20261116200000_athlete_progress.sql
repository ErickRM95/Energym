create table public.athlete_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  unit text not null,
  start_value numeric(8, 2) not null,
  current_value numeric(8, 2) not null,
  target_value numeric(8, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint athlete_goals_label check (char_length(trim(label)) > 0),
  constraint athlete_goals_unit check (char_length(trim(unit)) > 0),
  constraint athlete_goals_distinct check (start_value <> target_value)
);

create index athlete_goals_member_idx on public.athlete_goals (member_id, created_at desc);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  exercise_name text not null,
  value numeric(8, 2) not null,
  unit text not null default 'kg',
  reps integer,
  achieved_on date not null default current_date,
  created_at timestamptz not null default now(),
  constraint personal_records_value check (value > 0),
  constraint personal_records_name check (char_length(trim(exercise_name)) > 0),
  constraint personal_records_reps check (reps is null or reps > 0)
);

create index personal_records_member_idx on public.personal_records (member_id, value desc);

create trigger athlete_goals_set_updated_at
  before update on public.athlete_goals
  for each row execute function public.set_updated_at();

alter table public.athlete_goals enable row level security;
alter table public.personal_records enable row level security;

create policy athlete_goals_select on public.athlete_goals
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy athlete_goals_insert on public.athlete_goals
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

create policy athlete_goals_update on public.athlete_goals
  for update to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and organization_id = public.current_organization_id());

create policy athlete_goals_delete on public.athlete_goals
  for delete to authenticated
  using (member_id = auth.uid());

create policy personal_records_select on public.personal_records
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy personal_records_insert on public.personal_records
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and organization_id = public.current_organization_id()
  );

create policy personal_records_delete on public.personal_records
  for delete to authenticated
  using (member_id = auth.uid());

grant select, insert, update, delete on public.athlete_goals to authenticated;
grant select, insert, delete on public.personal_records to authenticated;
