ALTER TABLE public.profiles ADD COLUMN login_id text, ADD COLUMN first_name text NOT NULL DEFAULT '', ADD COLUMN last_name text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX profiles_login_id_unique ON public.profiles (lower(login_id)) WHERE login_id IS NOT NULL;
CREATE TYPE public.warranty_role AS ENUM ('Warranty Supervisor', 'Warranty Lead Roughneck');
CREATE TABLE public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role public.warranty_role NOT NULL, UNIQUE(user_id));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own role read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());