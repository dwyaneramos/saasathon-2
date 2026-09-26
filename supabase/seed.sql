-- Local/dev-only demo user. There is no login UI yet - the client signs in as this
-- fixed account automatically (client/src/lib/supabase.ts) so `auth.uid()` works for
-- RLS while a real auth flow doesn't exist. Never use these credentials in production.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo@pika.local',
  crypt('demo-password-123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  false,
  -- GoTrue's driver errors scanning NULL into these string columns - must be '' not NULL.
  '', '', '', '', '', '', '', ''
)
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo@pika.local"}',
  'email', now(), now(), now()
)
on conflict (provider_id, provider) do nothing;
