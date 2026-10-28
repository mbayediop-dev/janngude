-- ============================================================================
-- Janngude — schéma initial
-- À exécuter dans l’éditeur SQL de Supabase (ou `supabase db push`).
-- Le script est idempotent : il peut être relancé sans erreur.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Utilitaires
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Profils (1 ligne par utilisateur auth)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  voice_id text,
  voice_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created' and n.nspname = 'auth' and c.relname = 'users'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- Voix personnalisées (plusieurs par étudiant)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Cours
-- ----------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  domain text not null,
  subject text not null,
  file_path text,
  file_name text,
  file_type text,
  file_size integer,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'error')),
  error_message text,
  content_text text,
  overview text,
  outline jsonb,
  key_points jsonb,
  keywords jsonb,
  word_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists courses_user_idx on public.courses (user_id, created_at desc);

alter table public.courses enable row level security;
drop policy if exists "courses_all_own" on public.courses;
create policy "courses_all_own" on public.courses for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists courses_set_updated_at on public.courses;
create trigger courses_set_updated_at before update on public.courses
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Résumés
-- ----------------------------------------------------------------------------
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  length text not null default 'medium' check (length in ('short', 'medium', 'long')),
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists summaries_course_idx on public.summaries (course_id, created_at desc);

alter table public.summaries enable row level security;
drop policy if exists "summaries_all_own" on public.summaries;
create policy "summaries_all_own" on public.summaries for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Quiz
-- questions : [{ question, options: [..], answer_index, explanation }]
-- ----------------------------------------------------------------------------
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  questions jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists quizzes_course_idx on public.quizzes (course_id, created_at desc);

alter table public.quizzes enable row level security;
drop policy if exists "quizzes_all_own" on public.quizzes;
create policy "quizzes_all_own" on public.quizzes for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  guest_name text,
  answers jsonb not null,
  score integer not null,
  total integer not null,
  via_share boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_quiz_idx on public.quiz_attempts (quiz_id, created_at desc);

alter table public.quiz_attempts enable row level security;
drop policy if exists "quiz_attempts_insert_own" on public.quiz_attempts;
create policy "quiz_attempts_insert_own" on public.quiz_attempts for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "quiz_attempts_select_own_or_quiz_owner" on public.quiz_attempts;
create policy "quiz_attempts_select_own_or_quiz_owner" on public.quiz_attempts for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Lectures audio
-- ----------------------------------------------------------------------------
create table if not exists public.audio_readings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  summary_id uuid references public.summaries (id) on delete set null,
  source text not null check (source in ('course', 'summary', 'outline', 'keypoints')),
  voice_kind text not null default 'default' check (voice_kind in ('default', 'custom')),
  voice_label text,
  title text not null,
  file_path text not null,
  duration_seconds integer,
  char_count integer,
  created_at timestamptz not null default now()
);

create index if not exists audio_readings_course_idx on public.audio_readings (course_id, created_at desc);

alter table public.audio_readings enable row level security;
drop policy if exists "audio_readings_all_own" on public.audio_readings;
create policy "audio_readings_all_own" on public.audio_readings for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Discussions
-- ----------------------------------------------------------------------------
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Nouvelle discussion',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_course_idx on public.chats (course_id, updated_at desc);

alter table public.chats enable row level security;
drop policy if exists "chats_all_own" on public.chats;
create policy "chats_all_own" on public.chats for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at before update on public.chats
  for each row execute function public.set_updated_at();

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id, created_at);

alter table public.chat_messages enable row level security;
drop policy if exists "chat_messages_all_own" on public.chat_messages;
create policy "chat_messages_all_own" on public.chat_messages for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Partages
-- ----------------------------------------------------------------------------
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  resource_type text not null check (resource_type in ('summary', 'quiz', 'audio', 'chat')),
  resource_id uuid not null,
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  title text not null,
  recipient_email text,
  view_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists shares_user_idx on public.shares (user_id, created_at desc);
create index if not exists shares_resource_idx on public.shares (resource_type, resource_id);

alter table public.shares enable row level security;
drop policy if exists "shares_all_own" on public.shares;
create policy "shares_all_own" on public.shares for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.share_recipients (
  share_id uuid not null references public.shares (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (share_id, user_id)
);

alter table public.share_recipients enable row level security;
drop policy if exists "share_recipients_select_own" on public.share_recipients;
create policy "share_recipients_select_own" on public.share_recipients for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "share_recipients_delete_own" on public.share_recipients;
create policy "share_recipients_delete_own" on public.share_recipients for delete to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Fonctions publiques (consultation d’un partage sans compte)
-- ----------------------------------------------------------------------------
create or replace function public.get_share(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
  owner_name text;
  payload jsonb;
begin
  select * into s from public.shares
  where token = p_token and (expires_at is null or expires_at > now());
  if not found then
    return null;
  end if;

  update public.shares set view_count = view_count + 1 where id = s.id;

  select coalesce(nullif(full_name, ''), 'Un étudiant') into owner_name
  from public.profiles where id = s.user_id;

  if s.resource_type = 'summary' then
    select jsonb_build_object(
      'id', su.id, 'title', su.title, 'content', su.content, 'length', su.length, 'created_at', su.created_at,
      'course', jsonb_build_object('title', c.title, 'domain', c.domain, 'subject', c.subject)
    ) into payload
    from public.summaries su join public.courses c on c.id = su.course_id
    where su.id = s.resource_id;

  elsif s.resource_type = 'quiz' then
    select jsonb_build_object(
      'id', q.id, 'title', q.title, 'difficulty', q.difficulty, 'created_at', q.created_at,
      'course', jsonb_build_object('title', c.title, 'domain', c.domain, 'subject', c.subject),
      'questions', (
        select coalesce(jsonb_agg(jsonb_build_object('question', t.e ->> 'question', 'options', t.e -> 'options') order by t.i), '[]'::jsonb)
        from jsonb_array_elements(q.questions) with ordinality as t(e, i)
      )
    ) into payload
    from public.quizzes q join public.courses c on c.id = q.course_id
    where q.id = s.resource_id;

  elsif s.resource_type = 'audio' then
    select jsonb_build_object(
      'id', a.id, 'title', a.title, 'file_path', a.file_path, 'duration_seconds', a.duration_seconds,
      'voice_label', a.voice_label, 'source', a.source, 'created_at', a.created_at,
      'course', jsonb_build_object('title', c.title, 'domain', c.domain, 'subject', c.subject)
    ) into payload
    from public.audio_readings a join public.courses c on c.id = a.course_id
    where a.id = s.resource_id;

  elsif s.resource_type = 'chat' then
    select jsonb_build_object(
      'id', ch.id, 'title', ch.title, 'created_at', ch.created_at,
      'course', jsonb_build_object('title', c.title, 'domain', c.domain, 'subject', c.subject),
      'messages', (
        select coalesce(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at) order by m.created_at), '[]'::jsonb)
        from public.chat_messages m where m.chat_id = ch.id
      )
    ) into payload
    from public.chats ch join public.courses c on c.id = ch.course_id
    where ch.id = s.resource_id;
  end if;

  if payload is null then
    return null;
  end if;

  return jsonb_build_object(
    'share', jsonb_build_object(
      'id', s.id, 'token', s.token, 'type', s.resource_type, 'title', s.title,
      'created_at', s.created_at, 'owner_name', owner_name
    ),
    'resource', payload
  );
end;
$$;

grant execute on function public.get_share(text) to anon, authenticated;

create or replace function public.grade_shared_quiz(p_token text, p_answers jsonb, p_guest_name text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
  q public.quizzes%rowtype;
  results jsonb := '[]'::jsonb;
  score integer := 0;
  total integer := 0;
  e jsonb;
  i integer := 0;
  sel integer;
  corr integer;
  ok boolean;
begin
  select * into s from public.shares
  where token = p_token and resource_type = 'quiz' and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'share_not_found';
  end if;

  select * into q from public.quizzes where id = s.resource_id;
  if not found then
    raise exception 'quiz_not_found';
  end if;

  for e in select value from jsonb_array_elements(q.questions) loop
    corr := (e ->> 'answer_index')::integer;
    sel := case when jsonb_typeof(p_answers -> i) = 'number' then (p_answers ->> i)::integer else null end;
    ok := coalesce(sel = corr, false);
    total := total + 1;
    if ok then
      score := score + 1;
    end if;
    results := results || jsonb_build_object(
      'index', i, 'selected', sel, 'answer_index', corr, 'correct', ok, 'explanation', e ->> 'explanation'
    );
    i := i + 1;
  end loop;

  insert into public.quiz_attempts (quiz_id, user_id, guest_name, answers, score, total, via_share)
  values (q.id, auth.uid(), nullif(p_guest_name, ''), p_answers, score, total, true);

  return jsonb_build_object('score', score, 'total', total, 'results', results);
end;
$$;

grant execute on function public.grade_shared_quiz(text, jsonb, text) to anon, authenticated;

create or replace function public.save_share(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select * into s from public.shares where token = p_token;
  if not found then
    raise exception 'share_not_found';
  end if;
  if s.user_id = auth.uid() then
    return;
  end if;
  insert into public.share_recipients (share_id, user_id) values (s.id, auth.uid())
  on conflict do nothing;
end;
$$;

grant execute on function public.save_share(text) to authenticated;

create or replace function public.list_received_shares()
returns table (
  share_id uuid,
  token text,
  resource_type text,
  title text,
  owner_name text,
  created_at timestamptz,
  saved_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select
    s.id,
    s.token,
    s.resource_type,
    s.title,
    coalesce(nullif(p.full_name, ''), 'Un étudiant'),
    s.created_at,
    r.saved_at
  from public.shares s
  left join public.share_recipients r on r.share_id = s.id and r.user_id = auth.uid()
  left join public.profiles p on p.id = s.user_id
  where s.user_id <> auth.uid()
    and (
      r.user_id is not null
      or (s.recipient_email is not null and lower(s.recipient_email) = lower(coalesce(auth.email(), '')))
    )
  order by coalesce(r.saved_at, s.created_at) desc;
$$;

grant execute on function public.list_received_shares() to authenticated;

-- ----------------------------------------------------------------------------
-- Stockage
--   courses : fichiers de cours (privé, dossier = user_id)
--   audio   : lectures MP3 (public, chemins non devinables, dossier = user_id)
--   voices  : échantillons de voix (privé, dossier = user_id)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('courses', 'courses', false, 52428800)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('audio', 'audio', true, 104857600)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('voices', 'voices', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "storage_courses_owner" on storage.objects;
create policy "storage_courses_owner" on storage.objects for all to authenticated
  using (bucket_id = 'courses' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'courses' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_audio_owner" on storage.objects;
create policy "storage_audio_owner" on storage.objects for all to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_audio_public_read" on storage.objects;
create policy "storage_audio_public_read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'audio');

drop policy if exists "storage_voices_owner" on storage.objects;
create policy "storage_voices_owner" on storage.objects for all to authenticated
  using (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'voices' and (storage.foldername(name))[1] = auth.uid()::text);
