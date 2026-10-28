-- ============================================================================
-- Janngude — plusieurs voix personnalisées par étudiant
-- À exécuter dans l’éditeur SQL de Supabase (idempotent).
-- ============================================================================

create table if not exists public.voices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  provider_voice_id text not null,
  sample_path text,
  created_at timestamptz not null default now()
);

create index if not exists voices_user_idx on public.voices (user_id, created_at desc);

alter table public.voices enable row level security;
drop policy if exists "voices_all_own" on public.voices;
create policy "voices_all_own" on public.voices for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reprise de la voix unique enregistrée précédemment dans le profil.
insert into public.voices (user_id, name, provider_voice_id)
select p.id, coalesce(nullif(p.voice_name, ''), 'Ma voix'), p.voice_id
from public.profiles p
where p.voice_id is not null
  and not exists (select 1 from public.voices v where v.provider_voice_id = p.voice_id);
