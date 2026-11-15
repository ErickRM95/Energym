-- Energym: esquema inicial multi-tenant.
-- Aislamiento por organization_id + RLS. Cupos y cupones se resuelven
-- en RPC con bloqueo de fila (FOR UPDATE).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('super_admin', 'gym_admin', 'trainer', 'member');
create type public.profile_status as enum ('active', 'suspended', 'inactive');
create type public.subscription_status as enum ('active', 'expired', 'pending_payment', 'cancelled');
create type public.discount_type as enum ('percentage', 'fixed_amount', 'extra_days', 'extra_credits');
create type public.target_audience as enum ('all', 'new_members', 'renewals');
create type public.booking_status as enum ('confirmed', 'waitlist', 'cancelled', 'attended', 'no_show');
create type public.schedule_status as enum ('scheduled', 'cancelled', 'completed');
create type public.access_method as enum ('qr_scan', 'manual');
create type public.access_status as enum ('granted', 'denied_expired', 'denied_suspended');
create type public.photo_angle as enum ('front', 'side', 'back');
create type public.exercise_difficulty as enum ('beginner', 'intermediate', 'advanced');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalize_promotion_code()
returns trigger
language plpgsql
as $$
begin
  new.code = upper(trim(new.code));
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Núcleo
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  timezone text not null default 'America/Mexico_City',
  currency text not null default 'CRC',
  ai_routines_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint organizations_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete restrict,
  role public.user_role not null default 'member',
  full_name text not null,
  email text not null,
  phone text,
  national_id text,
  birth_date date,
  gender text,
  medical_notes text,
  status public.profile_status not null default 'active',
  qr_code_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_org_required check (
    organization_id is not null or role in ('super_admin', 'member')
  )
);

create index profiles_organization_role_idx on public.profiles (organization_id, role);
create index profiles_email_idx on public.profiles (email);

-- ---------------------------------------------------------------------------
-- Membresías, promociones y finanzas
-- ---------------------------------------------------------------------------

create table public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  price numeric(12, 2) not null,
  duration_days integer not null,
  class_credits integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_plans_price_nonnegative check (price >= 0),
  constraint membership_plans_duration_positive check (duration_days > 0),
  constraint membership_plans_credits_nonnegative check (class_credits >= 0)
);

create index membership_plans_org_active_idx
  on public.membership_plans (organization_id)
  where is_active;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  code text not null,
  title text not null,
  description text,
  banner_url text,
  discount_type public.discount_type not null,
  discount_value numeric(12, 2) not null,
  applicable_plan_ids uuid[] not null default '{}',
  target_audience public.target_audience not null default 'all',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_redemptions integer,
  max_per_member integer not null default 1,
  current_redemptions integer not null default 0,
  show_in_mobile_app boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_window check (ends_at > starts_at),
  constraint promotions_value_positive check (discount_value > 0),
  constraint promotions_percentage_cap check (
    discount_type <> 'percentage' or discount_value <= 100
  ),
  constraint promotions_whole_units check (
    discount_type not in ('extra_days', 'extra_credits')
    or discount_value = trunc(discount_value)
  ),
  constraint promotions_max_redemptions check (max_redemptions is null or max_redemptions > 0),
  constraint promotions_max_per_member check (max_per_member > 0),
  constraint promotions_current_nonnegative check (current_redemptions >= 0),
  constraint promotions_current_within_max check (
    max_redemptions is null or current_redemptions <= max_redemptions
  )
);

create unique index promotions_org_code_uidx on public.promotions (organization_id, lower(code));
create index promotions_mobile_idx
  on public.promotions (organization_id, starts_at, ends_at)
  where is_active and show_in_mobile_app;

create table public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete restrict,
  plan_id uuid not null references public.membership_plans (id) on delete restrict,
  promotion_id uuid references public.promotions (id) on delete set null,
  start_date date not null,
  end_date date not null,
  remaining_credits integer not null default 0,
  status public.subscription_status not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_subscriptions_dates check (end_date >= start_date),
  constraint member_subscriptions_credits_nonnegative check (remaining_credits >= 0)
);

create index member_subscriptions_member_status_idx
  on public.member_subscriptions (member_id, status, end_date desc);
create index member_subscriptions_org_status_idx
  on public.member_subscriptions (organization_id, status, end_date);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subscription_id uuid not null references public.member_subscriptions (id) on delete restrict,
  member_id uuid not null references public.profiles (id) on delete restrict,
  original_amount numeric(12, 2) not null,
  discount_amount numeric(12, 2) not null default 0,
  final_amount numeric(12, 2) not null,
  payment_method text not null,
  reference_number text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_amounts_nonnegative check (
    original_amount >= 0 and discount_amount >= 0 and final_amount >= 0
  ),
  constraint payments_discount_within_original check (discount_amount <= original_amount),
  constraint payments_final_matches check (final_amount = original_amount - discount_amount)
);

create index payments_org_paid_idx on public.payments (organization_id, paid_at desc);
create index payments_member_idx on public.payments (member_id, paid_at desc);

create table public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  promotion_id uuid not null references public.promotions (id) on delete restrict,
  member_id uuid not null references public.profiles (id) on delete restrict,
  subscription_id uuid not null references public.member_subscriptions (id) on delete restrict,
  original_amount numeric(12, 2) not null,
  discount_applied numeric(12, 2) not null,
  final_amount numeric(12, 2) not null,
  redeemed_at timestamptz not null default now(),
  constraint promotion_redemptions_amounts check (
    original_amount >= 0 and discount_applied >= 0 and final_amount >= 0
  )
);

create index promotion_redemptions_promo_idx
  on public.promotion_redemptions (promotion_id, redeemed_at desc);
create index promotion_redemptions_member_promo_idx
  on public.promotion_redemptions (member_id, promotion_id);

-- ---------------------------------------------------------------------------
-- Rutinas
-- ---------------------------------------------------------------------------

create table public.exercises_library (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text,
  difficulty public.exercise_difficulty not null default 'beginner',
  instructions text,
  video_url text,
  thumbnail_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exercises_library_org_muscle_idx
  on public.exercises_library (organization_id, muscle_group)
  where is_active;

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  trainer_id uuid references public.profiles (id) on delete set null,
  name text not null,
  goal text not null,
  generated_by_ai boolean not null default false,
  ai_prompt_context jsonb,
  start_date date,
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_dates check (
    end_date is null or start_date is null or end_date >= start_date
  )
);

create index routines_member_active_idx on public.routines (member_id) where is_active;
create index routines_org_idx on public.routines (organization_id, created_at desc);

create table public.routine_days (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  routine_id uuid not null references public.routines (id) on delete cascade,
  day_number integer not null,
  name text not null,
  focus_area text,
  constraint routine_days_number_positive check (day_number > 0),
  constraint routine_days_unique_number unique (routine_id, day_number)
);

create index routine_days_routine_idx on public.routine_days (routine_id, day_number);

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  routine_day_id uuid not null references public.routine_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises_library (id) on delete restrict,
  order_index integer not null,
  sets integer not null,
  reps text not null,
  rest_seconds integer not null,
  target_rpe numeric(3, 1),
  trainer_notes text,
  constraint routine_exercises_sets_positive check (sets > 0),
  constraint routine_exercises_rest_nonnegative check (rest_seconds >= 0),
  constraint routine_exercises_order_nonnegative check (order_index >= 0),
  constraint routine_exercises_rpe_range check (
    target_rpe is null or (target_rpe >= 1 and target_rpe <= 10)
  ),
  constraint routine_exercises_unique_order unique (routine_day_id, order_index)
);

create index routine_exercises_day_idx on public.routine_exercises (routine_day_id, order_index);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises (id) on delete cascade,
  set_number integer not null,
  weight_kg numeric(6, 2),
  reps_completed integer not null,
  logged_at timestamptz not null default now(),
  constraint workout_logs_set_positive check (set_number > 0),
  constraint workout_logs_reps_nonnegative check (reps_completed >= 0),
  constraint workout_logs_weight_nonnegative check (weight_kg is null or weight_kg >= 0)
);

create index workout_logs_member_logged_idx on public.workout_logs (member_id, logged_at desc);
create index workout_logs_exercise_idx on public.workout_logs (routine_exercise_id, set_number);

-- ---------------------------------------------------------------------------
-- Clases y acceso
-- ---------------------------------------------------------------------------

create table public.class_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  color_hex text not null default '#B6E632',
  duration_minutes integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_types_color check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  constraint class_types_duration check (duration_minutes > 0)
);

create index class_types_org_idx on public.class_types (organization_id);

create table public.class_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  class_type_id uuid not null references public.class_types (id) on delete restrict,
  trainer_id uuid references public.profiles (id) on delete set null,
  series_id uuid,
  start_time timestamptz not null,
  end_time timestamptz not null,
  max_capacity integer not null,
  status public.schedule_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_schedules_window check (end_time > start_time),
  constraint class_schedules_capacity check (max_capacity > 0)
);

create index class_schedules_org_start_idx on public.class_schedules (organization_id, start_time);
create index class_schedules_trainer_idx on public.class_schedules (trainer_id, start_time);

create table public.class_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  class_schedule_id uuid not null references public.class_schedules (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  status public.booking_status not null default 'confirmed',
  credits_charged integer not null default 0,
  booked_at timestamptz not null default now(),
  checked_in_at timestamptz,
  constraint class_bookings_credits_nonnegative check (credits_charged >= 0)
);

create index class_bookings_schedule_status_idx
  on public.class_bookings (class_schedule_id, status, booked_at);
create index class_bookings_member_idx on public.class_bookings (member_id, booked_at desc);

create unique index class_bookings_one_active_uidx
  on public.class_bookings (class_schedule_id, member_id)
  where status in ('confirmed', 'waitlist', 'attended', 'no_show');

create table public.gym_access_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  access_method public.access_method not null,
  status public.access_status not null
);

create index gym_access_logs_org_time_idx
  on public.gym_access_logs (organization_id, checked_in_at desc);
create index gym_access_logs_member_idx
  on public.gym_access_logs (member_id, checked_in_at desc);

-- ---------------------------------------------------------------------------
-- Progreso y push
-- ---------------------------------------------------------------------------

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  weight_kg numeric(6, 2),
  height_cm numeric(5, 1),
  body_fat_pct numeric(4, 1),
  muscle_mass_kg numeric(6, 2),
  chest_cm numeric(5, 1),
  waist_cm numeric(5, 1),
  hips_cm numeric(5, 1),
  arm_cm numeric(5, 1),
  thigh_cm numeric(5, 1),
  notes text,
  constraint body_measurements_ranges check (
    (weight_kg is null or weight_kg > 0)
    and (height_cm is null or height_cm > 0)
    and (body_fat_pct is null or (body_fat_pct >= 0 and body_fat_pct <= 80))
    and (muscle_mass_kg is null or muscle_mass_kg >= 0)
  )
);

create index body_measurements_member_idx
  on public.body_measurements (member_id, recorded_at desc);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  measurement_id uuid references public.body_measurements (id) on delete set null,
  photo_url text not null,
  angle public.photo_angle not null,
  taken_at timestamptz not null default now()
);

create index progress_photos_member_idx on public.progress_photos (member_id, taken_at desc);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  expo_token text not null,
  platform text,
  created_at timestamptz not null default now(),
  constraint push_tokens_unique unique (profile_id, expo_token)
);

create index push_tokens_org_idx on public.push_tokens (organization_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger membership_plans_set_updated_at
  before update on public.membership_plans
  for each row execute function public.set_updated_at();
create trigger promotions_set_updated_at
  before update on public.promotions
  for each row execute function public.set_updated_at();
create trigger promotions_normalize_code
  before insert or update of code on public.promotions
  for each row execute function public.normalize_promotion_code();
create trigger member_subscriptions_set_updated_at
  before update on public.member_subscriptions
  for each row execute function public.set_updated_at();
create trigger exercises_library_set_updated_at
  before update on public.exercises_library
  for each row execute function public.set_updated_at();
create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();
create trigger class_types_set_updated_at
  before update on public.class_types
  for each row execute function public.set_updated_at();
create trigger class_schedules_set_updated_at
  before update on public.class_schedules
  for each row execute function public.set_updated_at();

create or replace function public.ensure_exercise_in_catalog()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
begin
  select organization_id
    into v_org
  from public.exercises_library
  where id = new.exercise_id
    and is_active;

  if not found then
    raise exception 'Exercise % is not in the active library', new.exercise_id
      using errcode = 'P0001';
  end if;

  if v_org is not null and v_org <> new.organization_id then
    raise exception 'Exercise belongs to another organization'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger routine_exercises_catalog_check
  before insert or update of exercise_id, organization_id on public.routine_exercises
  for each row execute function public.ensure_exercise_in_catalog();

-- ---------------------------------------------------------------------------
-- Identidad del request. security definer evita recursión con RLS.
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'super_admin', false)
$$;

create or replace function public.is_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('gym_admin', 'super_admin'), false)
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('trainer', 'gym_admin', 'super_admin'), false)
$$;

create or replace function public.is_same_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or (
      p_organization_id is not null
      and p_organization_id = public.current_organization_id()
    )
$$;

create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if coalesce(current_setting('energym.bypass_profile_guard', true), '') = 'on' then
    return new;
  end if;

  if new.role = 'super_admin' and not public.is_super_admin() then
    raise exception 'Cannot assign super_admin' using errcode = '42501';
  end if;

  if not public.is_org_admin() then
    if new.role is distinct from old.role
      or new.organization_id is distinct from old.organization_id
      or new.status is distinct from old.status
      or new.qr_code_token is distinct from old.qr_code_token then
      raise exception 'Cannot change privileged profile fields' using errcode = '42501';
    end if;
  elsif not public.is_super_admin()
    and new.organization_id is distinct from public.current_organization_id() then
    raise exception 'Cannot move a profile to another organization' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_changes
  before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- El alta pública ignora rol y sede que vengan en user_metadata.
-- Solo app_metadata.provisioned_by = energym-admin (service role) los asigna.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provisioned boolean := coalesce(new.raw_app_meta_data->>'provisioned_by', '') = 'energym-admin';
  v_role public.user_role := 'member';
  v_org uuid;
begin
  if v_provisioned then
    v_role := coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'member');
    v_org := nullif(new.raw_app_meta_data->>'organization_id', '')::uuid;
    if v_role = 'super_admin' then
      v_role := 'member';
    end if;
  end if;

  insert into public.profiles (id, organization_id, role, full_name, email, phone)
  values (
    new.id,
    v_org,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'phone'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_timezone text default 'America/Mexico_City',
  p_currency text default 'CRC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = '28000';
  end if;

  if v_profile.organization_id is not null or v_profile.role <> 'member' then
    raise exception 'Organization already assigned' using errcode = 'P0001';
  end if;

  insert into public.organizations (name, slug, timezone, currency)
  values (
    trim(p_name),
    lower(trim(p_slug)),
    coalesce(p_timezone, 'America/Mexico_City'),
    upper(coalesce(p_currency, 'CRC'))
  )
  returning id into v_org_id;

  perform set_config('energym.bypass_profile_guard', 'on', true);

  update public.profiles
  set organization_id = v_org_id,
      role = 'gym_admin'
  where id = auth.uid();

  return v_org_id;
end;
$$;

create or replace function public.subscribe_member(
  p_member_id uuid,
  p_plan_id uuid,
  p_payment_method text,
  p_reference_number text default null,
  p_promotion_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_member public.profiles;
  v_plan public.membership_plans;
  v_promo public.promotions;
  v_promo_id uuid;
  v_prior_count integer;
  v_member_redemptions integer;
  v_discount numeric(12, 2) := 0;
  v_final numeric(12, 2);
  v_extra_days integer := 0;
  v_credits integer;
  v_start date := current_date;
  v_end date;
  v_subscription_id uuid;
  v_payment_id uuid;
  v_redemption_id uuid;
  v_code text := nullif(upper(trim(coalesce(p_promotion_code, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_payment_method is null or length(trim(p_payment_method)) = 0 then
    raise exception 'Payment method is required' using errcode = 'P0001';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = '28000';
  end if;

  if p_member_id <> auth.uid() and v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Only staff can subscribe another member' using errcode = '42501';
  end if;

  select * into v_member
  from public.profiles
  where id = p_member_id
  for update;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if v_actor.role <> 'super_admin'
    and v_member.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_member.organization_id is null then
    raise exception 'Member has no organization' using errcode = 'P0001';
  end if;

  if v_member.status <> 'active' then
    raise exception 'Member is not active' using errcode = 'P0001';
  end if;

  select * into v_plan
  from public.membership_plans
  where id = p_plan_id
  for share;

  if not found or not v_plan.is_active or v_plan.organization_id <> v_member.organization_id then
    raise exception 'Plan is not available' using errcode = 'P0001';
  end if;

  v_credits := v_plan.class_credits;
  v_final := v_plan.price;

  if v_code is not null then
    select * into v_promo
    from public.promotions
    where organization_id = v_member.organization_id
      and lower(code) = lower(v_code)
    for update;

    if not found then
      raise exception 'Promotion code not found' using errcode = 'P0002';
    end if;

    v_promo_id := v_promo.id;

    if not v_promo.is_active or now() < v_promo.starts_at or now() > v_promo.ends_at then
      raise exception 'Promotion is not active' using errcode = 'P0001';
    end if;

    if v_promo.max_redemptions is not null and v_promo.current_redemptions >= v_promo.max_redemptions then
      raise exception 'Promotion reached its redemption limit' using errcode = 'P0001';
    end if;

    if cardinality(v_promo.applicable_plan_ids) > 0
      and not (p_plan_id = any (v_promo.applicable_plan_ids)) then
      raise exception 'Promotion does not apply to this plan' using errcode = 'P0001';
    end if;

    select count(*)::integer into v_member_redemptions
    from public.promotion_redemptions
    where promotion_id = v_promo.id
      and member_id = p_member_id;

    if v_member_redemptions >= v_promo.max_per_member then
      raise exception 'Member already used this promotion' using errcode = 'P0001';
    end if;

    select count(*)::integer into v_prior_count
    from public.member_subscriptions
    where member_id = p_member_id
      and status <> 'pending_payment';

    if v_promo.target_audience = 'new_members' and v_prior_count > 0 then
      raise exception 'Promotion is only for new members' using errcode = 'P0001';
    end if;

    if v_promo.target_audience = 'renewals' and v_prior_count = 0 then
      raise exception 'Promotion is only for renewals' using errcode = 'P0001';
    end if;

    if v_promo.discount_type = 'percentage' then
      v_discount := round(v_plan.price * v_promo.discount_value / 100, 2);
    elsif v_promo.discount_type = 'fixed_amount' then
      v_discount := least(v_promo.discount_value, v_plan.price);
    elsif v_promo.discount_type = 'extra_days' then
      v_extra_days := v_promo.discount_value::integer;
    elsif v_promo.discount_type = 'extra_credits' then
      v_credits := v_credits + v_promo.discount_value::integer;
    end if;

    v_final := v_plan.price - v_discount;
  end if;

  v_end := v_start + (v_plan.duration_days + v_extra_days - 1);

  insert into public.member_subscriptions (
    organization_id, member_id, plan_id, promotion_id,
    start_date, end_date, remaining_credits, status
  ) values (
    v_member.organization_id, p_member_id, p_plan_id, v_promo_id,
    v_start, v_end, v_credits, 'active'
  )
  returning id into v_subscription_id;

  insert into public.payments (
    organization_id, subscription_id, member_id,
    original_amount, discount_amount, final_amount,
    payment_method, reference_number, paid_at
  ) values (
    v_member.organization_id, v_subscription_id, p_member_id,
    v_plan.price, v_discount, v_final,
    trim(p_payment_method), nullif(trim(coalesce(p_reference_number, '')), ''), now()
  )
  returning id into v_payment_id;

  if v_promo_id is not null then
    insert into public.promotion_redemptions (
      organization_id, promotion_id, member_id, subscription_id,
      original_amount, discount_applied, final_amount
    ) values (
      v_member.organization_id, v_promo_id, p_member_id, v_subscription_id,
      v_plan.price, v_discount, v_final
    )
    returning id into v_redemption_id;

    update public.promotions
    set current_redemptions = current_redemptions + 1
    where id = v_promo_id;
  end if;

  return jsonb_build_object(
    'subscription_id', v_subscription_id,
    'payment_id', v_payment_id,
    'redemption_id', v_redemption_id,
    'promotion_id', v_promo_id,
    'original_amount', v_plan.price,
    'discount_amount', v_discount,
    'final_amount', v_final,
    'extra_days', v_extra_days,
    'remaining_credits', v_credits,
    'start_date', v_start,
    'end_date', v_end
  );
end;
$$;

create or replace function public.redeem_promotion_code(
  p_code text,
  p_member_id uuid,
  p_plan_id uuid,
  p_payment_method text,
  p_reference_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'Promotion code is required' using errcode = 'P0001';
  end if;

  return public.subscribe_member(
    p_member_id,
    p_plan_id,
    p_payment_method,
    p_reference_number,
    p_code
  );
end;
$$;

create or replace function public.preview_promotion(
  p_code text,
  p_plan_id uuid,
  p_member_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_member_id uuid;
  v_member public.profiles;
  v_plan public.membership_plans;
  v_promo public.promotions;
  v_discount numeric(12, 2) := 0;
  v_extra_days integer := 0;
  v_extra_credits integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  v_member_id := coalesce(p_member_id, auth.uid());

  if v_member_id <> auth.uid() and v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_member from public.profiles where id = v_member_id;
  select * into v_plan from public.membership_plans where id = p_plan_id and is_active;

  if v_member.id is null or v_member.organization_id is null or v_plan.id is null
    or v_plan.organization_id <> v_member.organization_id then
    raise exception 'Plan is not available' using errcode = 'P0001';
  end if;

  if v_actor.role <> 'super_admin'
    and v_member.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_promo
  from public.promotions
  where organization_id = v_member.organization_id
    and lower(code) = lower(trim(p_code))
    and is_active
    and now() between starts_at and ends_at;

  if not found then
    raise exception 'Promotion code not found' using errcode = 'P0002';
  end if;

  if v_promo.discount_type = 'percentage' then
    v_discount := round(v_plan.price * v_promo.discount_value / 100, 2);
  elsif v_promo.discount_type = 'fixed_amount' then
    v_discount := least(v_promo.discount_value, v_plan.price);
  elsif v_promo.discount_type = 'extra_days' then
    v_extra_days := v_promo.discount_value::integer;
  elsif v_promo.discount_type = 'extra_credits' then
    v_extra_credits := v_promo.discount_value::integer;
  end if;

  return jsonb_build_object(
    'promotion_id', v_promo.id,
    'title', v_promo.title,
    'discount_type', v_promo.discount_type,
    'original_amount', v_plan.price,
    'discount_amount', v_discount,
    'final_amount', v_plan.price - v_discount,
    'extra_days', v_extra_days,
    'extra_credits', v_extra_credits,
    'duration_days', v_plan.duration_days + v_extra_days,
    'class_credits', v_plan.class_credits + v_extra_credits
  );
end;
$$;

create or replace function public.book_class_slot(
  p_class_schedule_id uuid,
  p_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_member public.profiles;
  v_schedule public.class_schedules;
  v_plan public.membership_plans;
  v_sub public.member_subscriptions;
  v_target uuid;
  v_confirmed integer;
  v_uses_credits boolean;
  v_status public.booking_status;
  v_credits_charged integer := 0;
  v_booking_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Profile not found' using errcode = '28000';
  end if;

  v_target := coalesce(p_member_id, auth.uid());

  if v_target <> auth.uid() and v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Only staff can book for another member' using errcode = '42501';
  end if;

  select * into v_schedule
  from public.class_schedules
  where id = p_class_schedule_id
  for update;

  if not found then
    raise exception 'Class not found' using errcode = 'P0002';
  end if;

  if v_actor.role <> 'super_admin'
    and v_schedule.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into v_member from public.profiles where id = v_target;
  if not found or v_member.organization_id is distinct from v_schedule.organization_id then
    raise exception 'Member is not in this organization' using errcode = '42501';
  end if;

  if v_member.status <> 'active' then
    raise exception 'Member is not active' using errcode = 'P0001';
  end if;

  if v_schedule.status <> 'scheduled' then
    raise exception 'Class is not open for booking' using errcode = 'P0001';
  end if;

  if v_schedule.start_time <= now() then
    raise exception 'Class has already started' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.class_bookings
    where class_schedule_id = p_class_schedule_id
      and member_id = v_target
      and status in ('confirmed', 'waitlist')
  ) then
    raise exception 'Member already has an active booking for this class' using errcode = 'P0001';
  end if;

  select s.* into v_sub
  from public.member_subscriptions s
  where s.member_id = v_target
    and s.organization_id = v_schedule.organization_id
    and s.status = 'active'
    and s.start_date <= current_date
    and s.end_date >= current_date
  order by s.end_date desc
  limit 1
  for update;

  if not found then
    raise exception 'No active membership' using errcode = 'P0001';
  end if;

  select * into v_plan from public.membership_plans where id = v_sub.plan_id;
  v_uses_credits := coalesce(v_plan.class_credits, 0) > 0;

  select count(*)::integer into v_confirmed
  from public.class_bookings
  where class_schedule_id = p_class_schedule_id
    and status = 'confirmed';

  if v_confirmed < v_schedule.max_capacity then
    if v_uses_credits and v_sub.remaining_credits <= 0 then
      raise exception 'No class credits remaining' using errcode = 'P0001';
    end if;
    v_status := 'confirmed';
    if v_uses_credits then
      update public.member_subscriptions
      set remaining_credits = remaining_credits - 1
      where id = v_sub.id;
      v_credits_charged := 1;
    end if;
  else
    v_status := 'waitlist';
  end if;

  insert into public.class_bookings (
    organization_id, class_schedule_id, member_id, status, credits_charged
  ) values (
    v_schedule.organization_id, p_class_schedule_id, v_target, v_status, v_credits_charged
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'status', v_status,
    'credits_charged', v_credits_charged,
    'remaining_credits', case
      when v_credits_charged = 1 then v_sub.remaining_credits - 1
      else v_sub.remaining_credits
    end
  );
end;
$$;

create or replace function public.cancel_class_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_booking public.class_bookings;
  v_schedule public.class_schedules;
  v_schedule_id uuid;
  v_next public.class_bookings;
  v_sub public.member_subscriptions;
  v_plan public.membership_plans;
  v_promoted uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();

  select class_schedule_id into strict v_schedule_id
  from public.class_bookings
  where id = p_booking_id;

  select * into v_schedule
  from public.class_schedules
  where id = v_schedule_id
  for update;

  select * into v_booking
  from public.class_bookings
  where id = p_booking_id
  for update;

  if v_actor.role <> 'super_admin'
    and v_booking.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_booking.member_id <> auth.uid()
    and v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_booking.status not in ('confirmed', 'waitlist') then
    raise exception 'Booking cannot be cancelled' using errcode = 'P0001';
  end if;

  if v_booking.credits_charged > 0 and v_schedule.start_time > now() then
    update public.member_subscriptions
    set remaining_credits = remaining_credits + v_booking.credits_charged
    where member_id = v_booking.member_id
      and organization_id = v_booking.organization_id
      and status = 'active'
      and start_date <= current_date
      and end_date >= current_date;
  end if;

  update public.class_bookings
  set status = 'cancelled',
      credits_charged = 0
  where id = p_booking_id;

  if v_booking.status = 'confirmed'
    and v_schedule.status = 'scheduled'
    and v_schedule.start_time > now() then
    for v_next in
      select *
      from public.class_bookings
      where class_schedule_id = v_schedule.id
        and status = 'waitlist'
      order by booked_at
      for update
    loop
      select s.* into v_sub
      from public.member_subscriptions s
      where s.member_id = v_next.member_id
        and s.organization_id = v_schedule.organization_id
        and s.status = 'active'
        and s.start_date <= current_date
        and s.end_date >= current_date
      order by s.end_date desc
      limit 1
      for update;

      if not found then
        continue;
      end if;

      select * into v_plan from public.membership_plans where id = v_sub.plan_id;

      if coalesce(v_plan.class_credits, 0) > 0 and v_sub.remaining_credits <= 0 then
        continue;
      end if;

      if coalesce(v_plan.class_credits, 0) > 0 then
        update public.member_subscriptions
        set remaining_credits = remaining_credits - 1
        where id = v_sub.id;

        update public.class_bookings
        set status = 'confirmed',
            credits_charged = 1
        where id = v_next.id;
      else
        update public.class_bookings
        set status = 'confirmed'
        where id = v_next.id;
      end if;

      v_promoted := v_next.id;
      exit;
    end loop;
  end if;

  return jsonb_build_object(
    'booking_id', p_booking_id,
    'status', 'cancelled',
    'promoted_booking_id', v_promoted
  );
end;
$$;

create or replace function public.check_in_member(
  p_qr_token text default null,
  p_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_member public.profiles;
  v_active boolean := false;
  v_end date;
  v_status public.access_status;
  v_method public.access_method;
  v_log_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Only staff can check members in' using errcode = '42501';
  end if;

  if p_qr_token is not null and length(trim(p_qr_token)) > 0 then
    v_method := 'qr_scan';
    select * into v_member from public.profiles where qr_code_token = trim(p_qr_token);
  elsif p_member_id is not null then
    v_method := 'manual';
    select * into v_member from public.profiles where id = p_member_id;
  else
    raise exception 'QR token or member id is required' using errcode = 'P0001';
  end if;

  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  if v_actor.role <> 'super_admin'
    and v_member.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_member.status = 'suspended' or v_member.status = 'inactive' then
    v_status := 'denied_suspended';
  else
    select s.end_date into v_end
    from public.member_subscriptions s
    where s.member_id = v_member.id
      and s.organization_id = v_member.organization_id
      and s.status = 'active'
      and s.start_date <= current_date
      and s.end_date >= current_date
    order by s.end_date desc
    limit 1;

    v_active := found and v_end is not null;
    v_status := case when v_active then 'granted' else 'denied_expired' end;
  end if;

  insert into public.gym_access_logs (
    organization_id, member_id, access_method, status
  ) values (
    v_member.organization_id, v_member.id, v_method, v_status
  )
  returning id into v_log_id;

  return jsonb_build_object(
    'log_id', v_log_id,
    'member_id', v_member.id,
    'full_name', v_member.full_name,
    'status', v_status,
    'membership_end', v_end,
    'access_method', v_method
  );
end;
$$;

create or replace function public.mark_booking_attendance(
  p_booking_id uuid,
  p_status public.booking_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_booking public.class_bookings;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  if p_status not in ('attended', 'no_show') then
    raise exception 'Attendance status must be attended or no_show' using errcode = 'P0001';
  end if;

  select * into v_actor from public.profiles where id = auth.uid();
  if v_actor.role not in ('trainer', 'gym_admin', 'super_admin') then
    raise exception 'Only staff can mark attendance' using errcode = '42501';
  end if;

  select * into v_booking
  from public.class_bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_actor.role <> 'super_admin'
    and v_booking.organization_id is distinct from v_actor.organization_id then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if v_booking.status <> 'confirmed' then
    raise exception 'Only a confirmed booking can be marked' using errcode = 'P0001';
  end if;

  update public.class_bookings
  set status = p_status,
      checked_in_at = case when p_status = 'attended' then now() else checked_in_at end
  where id = p_booking_id;

  return jsonb_build_object('booking_id', p_booking_id, 'status', p_status);
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.promotions enable row level security;
alter table public.member_subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.promotion_redemptions enable row level security;
alter table public.exercises_library enable row level security;
alter table public.routines enable row level security;
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_logs enable row level security;
alter table public.class_types enable row level security;
alter table public.class_schedules enable row level security;
alter table public.class_bookings enable row level security;
alter table public.gym_access_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.push_tokens enable row level security;

create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_super_admin() or id = public.current_organization_id());

create policy organizations_update on public.organizations
  for update to authenticated
  using (public.is_org_admin() and public.is_same_org(id))
  with check (public.is_org_admin() and public.is_same_org(id));

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (public.is_staff() and public.is_same_org(organization_id))
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or (public.is_org_admin() and public.is_same_org(organization_id))
  )
  with check (
    id = auth.uid()
    or (public.is_org_admin() and public.is_same_org(organization_id))
  );

create policy plans_select on public.membership_plans
  for select to authenticated
  using (public.is_same_org(organization_id));

create policy plans_write on public.membership_plans
  for all to authenticated
  using (public.is_org_admin() and public.is_same_org(organization_id))
  with check (public.is_org_admin() and public.is_same_org(organization_id));

create policy promotions_select on public.promotions
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (
      public.is_staff()
      or (is_active and show_in_mobile_app and now() between starts_at and ends_at)
    )
  );

create policy promotions_write on public.promotions
  for all to authenticated
  using (public.is_org_admin() and public.is_same_org(organization_id))
  with check (public.is_org_admin() and public.is_same_org(organization_id));

create policy subscriptions_select on public.member_subscriptions
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy subscriptions_admin_write on public.member_subscriptions
  for update to authenticated
  using (public.is_org_admin() and public.is_same_org(organization_id))
  with check (public.is_org_admin() and public.is_same_org(organization_id));

create policy payments_select on public.payments
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy redemptions_select on public.promotion_redemptions
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy exercises_select on public.exercises_library
  for select to authenticated
  using (
    is_active
    and (organization_id is null or public.is_same_org(organization_id))
  );

create policy exercises_write on public.exercises_library
  for all to authenticated
  using (
    organization_id is not null
    and public.is_staff()
    and public.is_same_org(organization_id)
  )
  with check (
    organization_id is not null
    and public.is_staff()
    and public.is_same_org(organization_id)
  );

create policy routines_select on public.routines
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy routines_insert on public.routines
  for insert to authenticated
  with check (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy routines_update on public.routines
  for update to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  )
  with check (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy routine_days_select on public.routine_days
  for select to authenticated
  using (
    exists (
      select 1
      from public.routines r
      where r.id = routine_id
        and public.is_same_org(r.organization_id)
        and (public.is_staff() or r.member_id = auth.uid())
    )
  );

create policy routine_days_write on public.routine_days
  for all to authenticated
  using (
    public.is_same_org(organization_id)
    and (
      public.is_staff()
      or exists (
        select 1 from public.routines r
        where r.id = routine_id and r.member_id = auth.uid()
      )
    )
  )
  with check (
    public.is_same_org(organization_id)
    and (
      public.is_staff()
      or exists (
        select 1 from public.routines r
        where r.id = routine_id and r.member_id = auth.uid()
      )
    )
  );

create policy routine_exercises_select on public.routine_exercises
  for select to authenticated
  using (
    exists (
      select 1
      from public.routine_days d
      join public.routines r on r.id = d.routine_id
      where d.id = routine_day_id
        and public.is_same_org(r.organization_id)
        and (public.is_staff() or r.member_id = auth.uid())
    )
  );

create policy routine_exercises_write on public.routine_exercises
  for all to authenticated
  using (
    public.is_same_org(organization_id)
    and (
      public.is_staff()
      or exists (
        select 1
        from public.routine_days d
        join public.routines r on r.id = d.routine_id
        where d.id = routine_day_id and r.member_id = auth.uid()
      )
    )
  )
  with check (
    public.is_same_org(organization_id)
    and (
      public.is_staff()
      or exists (
        select 1
        from public.routine_days d
        join public.routines r on r.id = d.routine_id
        where d.id = routine_day_id and r.member_id = auth.uid()
      )
    )
  );

create policy workout_logs_select on public.workout_logs
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy workout_logs_insert on public.workout_logs
  for insert to authenticated
  with check (
    member_id = auth.uid()
    and organization_id = public.current_organization_id()
    and exists (
      select 1
      from public.routine_exercises re
      join public.routine_days rd on rd.id = re.routine_day_id
      join public.routines r on r.id = rd.routine_id
      where re.id = routine_exercise_id
        and r.member_id = auth.uid()
    )
  );

create policy class_types_select on public.class_types
  for select to authenticated
  using (public.is_same_org(organization_id));

create policy class_types_write on public.class_types
  for all to authenticated
  using (public.is_org_admin() and public.is_same_org(organization_id))
  with check (public.is_org_admin() and public.is_same_org(organization_id));

create policy class_schedules_select on public.class_schedules
  for select to authenticated
  using (public.is_same_org(organization_id));

create policy class_schedules_write on public.class_schedules
  for all to authenticated
  using (public.is_staff() and public.is_same_org(organization_id))
  with check (public.is_staff() and public.is_same_org(organization_id));

create policy class_bookings_select on public.class_bookings
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy access_logs_select on public.gym_access_logs
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy measurements_select on public.body_measurements
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy measurements_insert on public.body_measurements
  for insert to authenticated
  with check (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy photos_select on public.progress_photos
  for select to authenticated
  using (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy photos_insert on public.progress_photos
  for insert to authenticated
  with check (
    public.is_same_org(organization_id)
    and (public.is_staff() or member_id = auth.uid())
  );

create policy push_tokens_all on public.push_tokens
  for all to authenticated
  using (profile_id = auth.uid() and organization_id = public.current_organization_id())
  with check (profile_id = auth.uid() and organization_id = public.current_organization_id());

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke all on all functions in schema public from public, anon;
grant execute on function public.set_updated_at() to authenticated, service_role;
grant execute on function public.normalize_promotion_code() to authenticated, service_role;
grant execute on function public.ensure_exercise_in_catalog() to authenticated, service_role;
grant execute on function public.guard_profile_changes() to authenticated, service_role;
grant execute on function public.handle_new_user() to supabase_auth_admin, service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.current_organization_id() to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.is_org_admin() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_same_org(uuid) to authenticated, service_role;
grant execute on function public.create_organization(text, text, text, text) to authenticated, service_role;
grant execute on function public.subscribe_member(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.redeem_promotion_code(text, uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.preview_promotion(text, uuid, uuid) to authenticated, service_role;
grant execute on function public.book_class_slot(uuid, uuid) to authenticated, service_role;
grant execute on function public.cancel_class_booking(uuid) to authenticated, service_role;
grant execute on function public.check_in_member(text, uuid) to authenticated, service_role;
grant execute on function public.mark_booking_attendance(uuid, public.booking_status) to authenticated, service_role;

alter publication supabase_realtime add table public.class_bookings;
alter publication supabase_realtime add table public.class_schedules;

insert into storage.buckets (id, name, public)
values
  ('org-assets', 'org-assets', true),
  ('exercise-media', 'exercise-media', true),
  ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy progress_photos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        public.is_staff()
        and (storage.foldername(name))[1] = public.current_organization_id()::text
      )
    )
  );

create policy progress_photos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = public.current_organization_id()::text
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.is_staff()
    )
  );

create policy org_assets_read on storage.objects
  for select to authenticated
  using (bucket_id in ('org-assets', 'exercise-media'));

create policy org_assets_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('org-assets', 'exercise-media')
    and public.is_staff()
    and (storage.foldername(name))[1] = public.current_organization_id()::text
  );
