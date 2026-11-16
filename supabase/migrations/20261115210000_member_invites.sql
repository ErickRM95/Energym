create table public.member_invites (
  code text primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  email text not null,
  access_password text not null,
  created_at timestamptz not null default now(),
  constraint member_invites_code check (code ~ '^[a-z0-9]{8}$')
);

create index member_invites_member_idx on public.member_invites (member_id);

alter table public.member_invites enable row level security;

grant select, insert, update, delete on public.member_invites to service_role;
