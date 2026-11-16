alter table public.payments add column member_name text;

update public.payments as payment
set member_name = profile.full_name
from public.profiles as profile
where profile.id = payment.member_id
  and payment.member_name is null;

alter table public.payments alter column member_id drop not null;
alter table public.payments alter column subscription_id drop not null;

alter table public.payments drop constraint payments_member_id_fkey;
alter table public.payments drop constraint payments_subscription_id_fkey;

alter table public.payments
  add constraint payments_member_id_fkey
  foreign key (member_id) references public.profiles (id) on delete set null;

alter table public.payments
  add constraint payments_subscription_id_fkey
  foreign key (subscription_id) references public.member_subscriptions (id) on delete set null;
