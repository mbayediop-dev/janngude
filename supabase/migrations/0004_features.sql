-- ============================================================================
-- Janngude — cartes mémoire, examens blancs, groupes de classe, partage de cours,
-- podcast, recherche globale, administration, onboarding
-- À exécuter dans l’éditeur SQL de Supabase (idempotent).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profils : rôle et onboarding
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists role text not null default 'student';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('student', 'admin'));
alter table public.profiles add column if not exists onboarded_at timestamptz;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- Cartes mémoire (répétition espacée, SM-2)
-- ----------------------------------------------------------------------------
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  front text not null,
  back text not null,
  ease real not null default 2.5,
  interval_days real not null default 0,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists flashcards_due_idx on public.flashcards (user_id, due_at);
create index if not exists flashcards_course_idx on public.flashcards (course_id);
alter table public.flashcards enable row level security;
drop policy if exists "flashcards_all_own" on public.flashcards;
create policy "flashcards_all_own" on public.flashcards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  grade smallint not null check (grade between 0 and 3),
  reviewed_at timestamptz not null default now()
);
create index if not exists flashcard_reviews_user_idx on public.flashcard_reviews (user_id, reviewed_at desc);
alter table public.flashcard_reviews enable row level security;
drop policy if exists "flashcard_reviews_all_own" on public.flashcard_reviews;
create policy "flashcard_reviews_all_own" on public.flashcard_reviews for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Examens blancs (plusieurs cours, chronométrés)
-- ----------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  course_ids jsonb not null,
  questions jsonb not null,
  duration_minutes integer not null default 30,
  created_at timestamptz not null default now()
);
create index if not exists exams_user_idx on public.exams (user_id, created_at desc);
alter table public.exams enable row level security;
drop policy if exists "exams_all_own" on public.exams;
create policy "exams_all_own" on public.exams for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null,
  score integer not null,
  total integer not null,
  time_spent_seconds integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists exam_attempts_exam_idx on public.exam_attempts (exam_id, created_at desc);
alter table public.exam_attempts enable row level security;
drop policy if exists "exam_attempts_all_own" on public.exam_attempts;
create policy "exam_attempts_all_own" on public.exam_attempts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Groupes de classe
-- ----------------------------------------------------------------------------
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  code text not null unique default upper(encode(gen_random_bytes(3), 'hex')),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

create or replace function public.is_group_member(p_group uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;
grant execute on function public.is_group_member(uuid) to authenticated;

alter table public.groups enable row level security;
drop policy if exists "groups_select_members" on public.groups;
create policy "groups_select_members" on public.groups for select to authenticated using (public.is_group_member(id) or owner_id = auth.uid());
drop policy if exists "groups_insert_own" on public.groups;
create policy "groups_insert_own" on public.groups for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "groups_update_own" on public.groups;
create policy "groups_update_own" on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "groups_delete_own" on public.groups;
create policy "groups_delete_own" on public.groups for delete to authenticated using (owner_id = auth.uid());

alter table public.group_members enable row level security;
drop policy if exists "group_members_select" on public.group_members;
create policy "group_members_select" on public.group_members for select to authenticated using (public.is_group_member(group_id));
drop policy if exists "group_members_insert_owner" on public.group_members;
create policy "group_members_insert_owner" on public.group_members for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
drop policy if exists "group_members_delete" on public.group_members;
create policy "group_members_delete" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- Rejoindre un groupe par son code
create or replace function public.join_group(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  g public.groups%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into g from public.groups where code = upper(trim(p_code));
  if not found then raise exception 'group_not_found'; end if;
  insert into public.group_members (group_id, user_id, role) values (g.id, auth.uid(), case when g.owner_id = auth.uid() then 'owner' else 'member' end)
  on conflict do nothing;
  return g.id;
end;
$$;
grant execute on function public.join_group(text) to authenticated;

-- Membres d’un groupe avec leur nom
create or replace function public.group_members_list(p_group uuid)
returns table (user_id uuid, name text, role text, joined_at timestamptz)
language sql security definer set search_path = public stable as $$
  select m.user_id, coalesce(nullif(p.full_name, ''), 'Étudiant'), m.role, m.joined_at
  from public.group_members m
  left join public.profiles p on p.id = m.user_id
  where m.group_id = p_group and public.is_group_member(p_group)
  order by m.role, m.joined_at;
$$;
grant execute on function public.group_members_list(uuid) to authenticated;

-- Partages adressés à un groupe
alter table public.shares add column if not exists group_id uuid references public.groups (id) on delete cascade;
create index if not exists shares_group_idx on public.shares (group_id, created_at desc);
drop policy if exists "shares_select_group_members" on public.shares;
create policy "shares_select_group_members" on public.shares for select to authenticated
  using (group_id is not null and public.is_group_member(group_id));

-- Classement amical : scores des membres sur les quiz partagés au groupe
create or replace function public.group_leaderboard(p_group uuid)
returns table (user_id uuid, name text, attempts bigint, avg_percent numeric, best_percent numeric)
language sql security definer set search_path = public stable as $$
  select m.user_id,
         coalesce(nullif(p.full_name, ''), 'Étudiant') as name,
         count(a.id) as attempts,
         round(avg(a.score::numeric / nullif(a.total, 0) * 100), 0) as avg_percent,
         round(max(a.score::numeric / nullif(a.total, 0) * 100), 0) as best_percent
  from public.group_members m
  left join public.profiles p on p.id = m.user_id
  left join public.shares s on s.group_id = p_group and s.resource_type = 'quiz'
  left join public.quiz_attempts a on a.quiz_id = s.resource_id and a.user_id = m.user_id
  where m.group_id = p_group and public.is_group_member(p_group)
  group by m.user_id, p.full_name
  order by best_percent desc nulls last, attempts desc;
$$;
grant execute on function public.group_leaderboard(uuid) to authenticated;

-- Contenus partagés dans un groupe, avec le nom de l’auteur
create or replace function public.group_shares_list(p_group uuid)
returns table (share_id uuid, token text, resource_type text, title text, owner_name text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select s.id, s.token, s.resource_type, s.title, coalesce(nullif(p.full_name, ''), 'Étudiant'), s.created_at
  from public.shares s
  left join public.profiles p on p.id = s.user_id
  where s.group_id = p_group and public.is_group_member(p_group)
  order by s.created_at desc;
$$;
grant execute on function public.group_shares_list(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Partage d’un cours complet ; podcast
-- ----------------------------------------------------------------------------
alter table public.shares drop constraint if exists shares_resource_type_check;
alter table public.shares add constraint shares_resource_type_check check (resource_type in ('summary', 'quiz', 'audio', 'chat', 'course'));

alter table public.audio_readings drop constraint if exists audio_readings_source_check;
alter table public.audio_readings add constraint audio_readings_source_check check (source in ('course', 'summary', 'outline', 'keypoints', 'podcast'));

-- Copie d’un cours partagé dans son propre espace
create or replace function public.copy_shared_course(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
  c public.courses%rowtype;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into s from public.shares where token = p_token and resource_type = 'course';
  if not found then raise exception 'share_not_found'; end if;
  select * into c from public.courses where id = s.resource_id;
  if not found then raise exception 'course_not_found'; end if;
  insert into public.courses (user_id, title, domain, subject, file_name, file_type, status, content_text, overview, outline, key_points, keywords, word_count)
  values (auth.uid(), c.title, c.domain, c.subject, c.file_name, c.file_type, 'ready', c.content_text, c.overview, c.outline, c.key_points, c.keywords, c.word_count)
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.copy_shared_course(text) to authenticated;

-- get_share : ajout du type « course » et des informations de groupe
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

  elsif s.resource_type = 'course' then
    select jsonb_build_object(
      'id', c.id, 'title', c.title, 'overview', c.overview, 'outline', coalesce(c.outline, '[]'::jsonb),
      'key_points', coalesce(c.key_points, '[]'::jsonb), 'keywords', coalesce(c.keywords, '[]'::jsonb),
      'word_count', c.word_count, 'created_at', c.created_at,
      'course', jsonb_build_object('title', c.title, 'domain', c.domain, 'subject', c.subject)
    ) into payload
    from public.courses c
    where c.id = s.resource_id and c.status = 'ready';
  end if;

  if payload is null then
    return null;
  end if;

  return jsonb_build_object(
    'share', jsonb_build_object(
      'id', s.id, 'token', s.token, 'type', s.resource_type, 'title', s.title,
      'created_at', s.created_at, 'owner_name', owner_name, 'group_id', s.group_id
    ),
    'resource', payload
  );
end;
$$;
grant execute on function public.get_share(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Recherche globale (plein texte, français)
-- ----------------------------------------------------------------------------
alter table public.courses add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(domain, '') || ' ' || coalesce(subject, '') || ' ' || coalesce(keywords::text, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(overview, '') || ' ' || coalesce(key_points::text, '')), 'C') ||
    setweight(to_tsvector('french', left(coalesce(content_text, ''), 200000)), 'D')
  ) stored;
create index if not exists courses_search_idx on public.courses using gin (search);

create or replace function public.search_courses(p_query text, p_limit integer default 20)
returns table (id uuid, title text, domain text, subject text, status text, rank real, headline text)
language sql security definer set search_path = public stable as $$
  with q as (select websearch_to_tsquery('french', p_query) as tsq)
  select c.id, c.title, c.domain, c.subject, c.status,
         ts_rank(c.search, q.tsq) as rank,
         ts_headline('french', coalesce(c.overview, '') || ' ' || left(coalesce(c.content_text, ''), 20000), q.tsq,
                     'MaxWords=28, MinWords=12, StartSel=<mark>, StopSel=</mark>, MaxFragments=2, FragmentDelimiter= … ') as headline
  from public.courses c, q
  where c.user_id = auth.uid() and c.search @@ q.tsq
  order by rank desc
  limit greatest(1, least(p_limit, 50));
$$;
grant execute on function public.search_courses(text, integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Suivi d’usage (administration)
-- ----------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  units integer not null default 0,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_idx on public.usage_events (user_id, created_at desc);
create index if not exists usage_events_kind_idx on public.usage_events (kind, created_at desc);
alter table public.usage_events enable row level security;
drop policy if exists "usage_events_insert_own" on public.usage_events;
create policy "usage_events_insert_own" on public.usage_events for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "usage_events_select_own_or_admin" on public.usage_events;
create policy "usage_events_select_own_or_admin" on public.usage_events for select to authenticated using (auth.uid() = user_id or public.is_admin());

-- Vue d’ensemble pour l’administration
create or replace function public.admin_overview()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'courses', (select count(*) from public.courses),
    'summaries', (select count(*) from public.summaries),
    'quizzes', (select count(*) from public.quizzes),
    'audios', (select count(*) from public.audio_readings),
    'chats', (select count(*) from public.chats),
    'groups', (select count(*) from public.groups),
    'usage', (select coalesce(jsonb_object_agg(kind, units), '{}'::jsonb) from (select kind, sum(units) as units from public.usage_events group by kind) u),
    'usage_30d', (select coalesce(jsonb_object_agg(kind, units), '{}'::jsonb) from (select kind, sum(units) as units from public.usage_events where created_at > now() - interval '30 days' group by kind) u)
  );
end;
$$;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_users(p_query text default null, p_limit integer default 100)
returns table (id uuid, email text, name text, role text, created_at timestamptz, last_sign_in_at timestamptz, courses bigint, audios bigint, tts_chars bigint, ai_chars bigint)
language sql security definer set search_path = public stable as $$
  select u.id, u.email::text, coalesce(nullif(p.full_name, ''), split_part(u.email, '@', 1)), coalesce(p.role, 'student'), u.created_at, u.last_sign_in_at,
         (select count(*) from public.courses c where c.user_id = u.id),
         (select count(*) from public.audio_readings a where a.user_id = u.id),
         (select coalesce(sum(units), 0) from public.usage_events e where e.user_id = u.id and e.kind = 'tts_chars'),
         (select coalesce(sum(units), 0) from public.usage_events e where e.user_id = u.id and e.kind like 'ai_%')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.is_admin()
    and (p_query is null or p_query = '' or u.email ilike '%' || p_query || '%' or p.full_name ilike '%' || p_query || '%')
  order by u.created_at desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.admin_users(text, integer) to authenticated;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  if p_role not in ('student', 'admin') then raise exception 'invalid_role'; end if;
  insert into public.profiles (id, role) values (p_user, p_role)
  on conflict (id) do update set role = excluded.role;
end;
$$;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
