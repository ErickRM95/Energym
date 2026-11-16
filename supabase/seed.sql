-- Datos sintéticos para `supabase db reset`. Contraseña local de todas las cuentas: Energym123!

insert into public.organizations (id, name, slug, timezone, currency, ai_routines_enabled)
values (
  'a1111111-1111-4111-8111-111111111111',
  'Energym Centro',
  'energym-centro',
  'America/Mexico_City',
  'CRC',
  true
)
on conflict (id) do nothing;

insert into public.membership_plans (id, organization_id, name, description, price, duration_days, class_credits)
values
  ('b1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'Mensual abierto', 'Acceso libre y clases incluidas.', 899, 30, 0),
  ('b2222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111', 'Mensual 8 clases', 'Ocho créditos para clases grupales.', 599, 30, 8)
on conflict (id) do nothing;

insert into public.promotions (
  id, organization_id, code, title, description, discount_type, discount_value,
  applicable_plan_ids, target_audience, starts_at, ends_at, max_redemptions, max_per_member, show_in_mobile_app
)
values
  (
    'e1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    'BIENVENIDA20',
    'Bienvenida 20%',
    '20% de descuento en la primera membresía.',
    'percentage',
    20,
    '{}'::uuid[],
    'new_members',
    now() - interval '1 day',
    now() + interval '90 days',
    100,
    1,
    true
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    'a1111111-1111-4111-8111-111111111111',
    'REACTIVA100',
    'Reactiva $100',
    'Cien pesos de descuento al renovar.',
    'fixed_amount',
    100,
    '{}'::uuid[],
    'renewals',
    now() - interval '1 day',
    now() + interval '90 days',
    100,
    1,
    false
  ),
  (
    'e3333333-3333-4333-8333-333333333333',
    'a1111111-1111-4111-8111-111111111111',
    'PAREJA15',
    '15 días de regalo',
    'Suma 15 días a cualquier plan vigente.',
    'extra_days',
    15,
    '{}'::uuid[],
    'all',
    now() - interval '1 day',
    now() + interval '90 days',
    null,
    1,
    true
  )
on conflict (id) do nothing;

insert into public.exercises_library (id, organization_id, name, muscle_group, equipment, difficulty, instructions)
values
  ('c1111111-1111-4111-8111-111111111101', null, 'Sentadilla con barra', 'Piernas', 'Barra', 'intermediate', 'Baja hasta que el muslo quede paralelo al suelo.'),
  ('c1111111-1111-4111-8111-111111111102', null, 'Peso muerto rumano', 'Posteriores', 'Barra', 'intermediate', 'Empuja la cadera hacia atrás con la espalda neutra.'),
  ('c1111111-1111-4111-8111-111111111103', null, 'Press de banca', 'Pecho', 'Barra', 'intermediate', 'Baja la barra al pecho y empuja sin despegar la espalda.'),
  ('c1111111-1111-4111-8111-111111111104', null, 'Press militar', 'Hombros', 'Barra', 'intermediate', 'Empuja la barra sobre la cabeza sin arquear la lumbar.'),
  ('c1111111-1111-4111-8111-111111111105', null, 'Remo con barra', 'Espalda', 'Barra', 'intermediate', 'Lleva la barra a la cintura y aprieta las escápulas.'),
  ('c1111111-1111-4111-8111-111111111106', null, 'Dominadas', 'Espalda', 'Barra de dominadas', 'advanced', 'Sube hasta que la barbilla pase la barra.'),
  ('c1111111-1111-4111-8111-111111111107', null, 'Zancadas', 'Piernas', 'Mancuernas', 'beginner', 'Da un paso largo y baja la rodilla de atrás.'),
  ('c1111111-1111-4111-8111-111111111108', null, 'Hip thrust', 'Glúteos', 'Barra', 'beginner', 'Empuja la cadera hasta extenderla por completo.'),
  ('c1111111-1111-4111-8111-111111111109', null, 'Plancha', 'Core', 'Peso corporal', 'beginner', 'Mantén el cuerpo en línea desde la cabeza hasta los talones.'),
  ('c1111111-1111-4111-8111-111111111110', null, 'Caminata en cinta', 'Cardio', 'Caminadora', 'beginner', 'Camina a ritmo constante sin soltar la postura.'),
  ('c1111111-1111-4111-8111-111111111111', null, 'Jalón al pecho', 'Espalda', 'Polea', 'beginner', 'Lleva la barra hacia el pecho sin balancear el torso.'),
  ('c1111111-1111-4111-8111-111111111112', null, 'Curl de bíceps', 'Brazos', 'Mancuernas', 'beginner', 'Flexiona el codo sin mover el hombro.'),
  ('c1111111-1111-4111-8111-111111111113', null, 'Extensión de tríceps', 'Brazos', 'Polea', 'beginner', 'Extiende el codo y controla la vuelta.'),
  ('c1111111-1111-4111-8111-111111111114', null, 'Prensa de piernas', 'Piernas', 'Máquina', 'beginner', 'Baja sin despegar la zona lumbar del respaldo.'),
  ('c1111111-1111-4111-8111-111111111115', null, 'Fondos en paralelas', 'Pecho', 'Paralelas', 'advanced', 'Baja hasta que el codo pase el hombro.')
on conflict (id) do nothing;

insert into public.class_types (id, organization_id, name, description, color_hex, duration_minutes)
values
  ('d1111111-1111-4111-8111-111111111111', 'a1111111-1111-4111-8111-111111111111', 'HIIT', 'Intervalos de alta intensidad.', '#E85D04', 45),
  ('d2222222-2222-4222-8222-222222222222', 'a1111111-1111-4111-8111-111111111111', 'Fuerza', 'Trabajo de fuerza en grupo.', '#B6E632', 60),
  ('d3333333-3333-4333-8333-333333333333', 'a1111111-1111-4111-8111-111111111111', 'Movilidad', 'Rango de movimiento y recuperación.', '#4CC9F0', 40)
on conflict (id) do nothing;

do $$
declare
  v_password text := extensions.crypt('Energym123!', extensions.gen_salt('bf'));
  v_user record;
begin
  for v_user in
    select *
    from (values
      ('a2222222-2222-4222-8222-222222222222'::uuid, 'admin@energym.local', 'Erick', 'gym_admin'::public.user_role)
    ) as seed(id, email, full_name, role)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_token_current, is_sso_user, is_anonymous
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      v_user.id,
      'authenticated',
      'authenticated',
      v_user.email,
      v_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_user.full_name),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      false,
      false
    )
    on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    )
    values (
      v_user.id,
      v_user.id,
      jsonb_build_object('sub', v_user.id::text, 'email', v_user.email, 'email_verified', true),
      'email',
      v_user.id::text,
      now(),
      now(),
      now()
    )
    on conflict (id) do nothing;

    update public.profiles
    set organization_id = 'a1111111-1111-4111-8111-111111111111',
        role = v_user.role,
        full_name = v_user.full_name,
        status = 'active'
    where id = v_user.id;
  end loop;
end $$;

insert into public.class_schedules (
  id, organization_id, class_type_id, trainer_id, start_time, end_time, max_capacity
)
values (
  'f6666666-6666-4666-8666-666666666666',
  'a1111111-1111-4111-8111-111111111111',
  'd2222222-2222-4222-8222-222222222222',
  null,
  timezone('America/Mexico_City', ((now() at time zone 'America/Mexico_City')::date + 1) + time '07:00'),
  timezone('America/Mexico_City', ((now() at time zone 'America/Mexico_City')::date + 1) + time '08:00'),
  12
)
on conflict (id) do nothing;
