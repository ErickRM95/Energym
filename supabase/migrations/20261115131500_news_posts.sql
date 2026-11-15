create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  body text not null,
  is_published boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index news_posts_org_published_idx on public.news_posts (organization_id, published_at desc);

create trigger news_posts_set_updated_at
  before update on public.news_posts
  for each row execute function public.set_updated_at();

alter table public.news_posts enable row level security;

create policy news_select on public.news_posts
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or is_published)
  );

create policy news_write on public.news_posts
  for all to authenticated
  using (public.is_staff() and public.is_same_org(organization_id))
  with check (public.is_staff() and public.is_same_org(organization_id));

grant select, insert, update, delete on public.news_posts to authenticated, service_role;
