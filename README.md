# Energym

Monorepo del portal administrativo, la app de atletas y la base multi-tenant.

## Arranque

1. Instala Supabase CLI y Docker.
2. `supabase start`
3. Copia `.env.example` a `apps/web/.env.local` y a `apps/mobile/.env` con la URL y la anon key. En la web agrega también `SUPABASE_SERVICE_ROLE_KEY`.
4. `supabase db reset`
5. `npm install` y `npm run dev` en la raíz.

La semilla crea Energym Centro. La contraseña local es `Energym123!`.

- `admin@energym.local` (Erick)

Gemini solo se llama desde `supabase/functions/generate-ai-routine`. Configura el secreto con `supabase secrets set GEMINI_API_KEY=...`. Sin esa clave, el estudio de rutinas sigue permitiendo armar el plan a mano.
