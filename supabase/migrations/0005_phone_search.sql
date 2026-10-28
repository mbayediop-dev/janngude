-- ============================================================================
-- Janngude — migration 0005 : téléphone sur le profil et recherche d’étudiants
-- Idempotente : peut être rejouée sans effet de bord.
-- ============================================================================

-- Téléphone (saisi à l’inscription ou dans Paramètres), normalisé côté application (+221…).
alter table public.profiles add column if not exists phone text;
create index if not exists profiles_phone_digits_idx on public.profiles (regexp_replace(coalesce(phone, ''), '\D', '', 'g'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Recherche d’un étudiant (nom, e-mail ou téléphone) pour le partage direct.
-- Deux caractères minimum ; l’utilisateur courant est exclu ; 20 résultats maximum.
create or replace function public.search_students(p_query text, p_limit integer default 8)
returns table (id uuid, name text, email text, phone text)
language sql security definer set search_path = public stable as $$
  with q as (
    select trim(coalesce(p_query, '')) as txt, regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
  )
  select u.id,
         coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)) as name,
         u.email::text,
         p.phone
  from auth.users u
  left join public.profiles p on p.id = u.id, q
  where auth.uid() is not null
    and u.id <> auth.uid()
    and length(q.txt) >= 2
    and (
      p.full_name ilike '%' || q.txt || '%'
      or u.email ilike '%' || q.txt || '%'
      or (length(q.digits) >= 4 and regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') like '%' || q.digits || '%')
    )
  order by (p.full_name ilike q.txt || '%') desc, p.full_name nulls last, u.email
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;
grant execute on function public.search_students(text, integer) to authenticated;

-- Liste des comptes (administration) enrichie du téléphone : le type de retour change, on recrée la fonction.
drop function if exists public.admin_users(text, integer);
create function public.admin_users(p_query text default null, p_limit integer default 100)
returns table (id uuid, email text, name text, phone text, role text, created_at timestamptz, last_sign_in_at timestamptz, courses bigint, audios bigint, tts_chars bigint, ai_chars bigint)
language sql security definer set search_path = public stable as $$
  select u.id, u.email::text, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)), p.phone, coalesce(p.role, 'student'), u.created_at, u.last_sign_in_at,
         (select count(*) from public.courses c where c.user_id = u.id),
         (select count(*) from public.audio_readings a where a.user_id = u.id),
         (select coalesce(sum(units), 0) from public.usage_events e where e.user_id = u.id and e.kind = 'tts_chars'),
         (select coalesce(sum(units), 0) from public.usage_events e where e.user_id = u.id and e.kind like 'ai\_%')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_admin()
    and (p_query is null or p_query = '' or u.email ilike '%' || p_query || '%' or p.full_name ilike '%' || p_query || '%' or coalesce(p.phone, '') ilike '%' || p_query || '%')
  order by u.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.admin_users(text, integer) to authenticated;
