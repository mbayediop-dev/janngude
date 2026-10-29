-- ============================================================================
-- Janngude — migration 0006 : reprise d’une discussion partagée, copies de cours sans doublon
-- Idempotente : peut être rejouée sans effet de bord.
-- ============================================================================

-- Origine d’une copie (cours copié depuis un partage, discussion reprise depuis un partage) : évite les doublons.
alter table public.courses add column if not exists copied_from uuid references public.courses (id) on delete set null;
create index if not exists courses_copied_from_idx on public.courses (user_id, copied_from);
alter table public.chats add column if not exists copied_from uuid references public.chats (id) on delete set null;
create index if not exists chats_copied_from_idx on public.chats (user_id, copied_from);

-- Cours partagé → espace du lecteur : son propre cours, une copie déjà faite, ou une nouvelle copie.
create or replace function public.copy_shared_course(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
  c public.courses%rowtype;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into s from public.shares where token = p_token and resource_type = 'course' and (expires_at is null or expires_at > now());
  if not found then raise exception 'share_not_found'; end if;
  select * into c from public.courses where id = s.resource_id;
  if not found then raise exception 'course_not_found'; end if;
  if c.user_id = auth.uid() then return c.id; end if;
  select id into new_id from public.courses where user_id = auth.uid() and copied_from = c.id order by created_at limit 1;
  if new_id is not null then return new_id; end if;
  insert into public.courses (user_id, title, domain, subject, file_name, file_type, status, content_text, overview, outline, key_points, keywords, word_count, copied_from)
  values (auth.uid(), c.title, c.domain, c.subject, c.file_name, c.file_type, 'ready', c.content_text, c.overview, c.outline, c.key_points, c.keywords, c.word_count, c.id)
  returning id into new_id;
  return new_id;
end;
$$;
grant execute on function public.copy_shared_course(text) to authenticated;

-- Discussion partagée → reprise dans l’espace du lecteur : le cours (copié si besoin) et une copie de la discussion
-- avec ses messages, pour poser ses propres questions à l’assistant. Réutilise la copie existante lors d’un second appel.
create or replace function public.continue_shared_chat(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.shares%rowtype;
  ch public.chats%rowtype;
  c public.courses%rowtype;
  v_course uuid;
  v_chat uuid;
  v_created boolean := false;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into s from public.shares where token = p_token and resource_type = 'chat' and (expires_at is null or expires_at > now());
  if not found then raise exception 'share_not_found'; end if;
  select * into ch from public.chats where id = s.resource_id;
  if not found then raise exception 'chat_not_found'; end if;
  select * into c from public.courses where id = ch.course_id;
  if not found then raise exception 'course_not_found'; end if;

  -- Cours : le sien, une copie existante ou une nouvelle copie.
  if c.user_id = auth.uid() then
    v_course := c.id;
  else
    select id into v_course from public.courses where user_id = auth.uid() and copied_from = c.id order by created_at limit 1;
    if v_course is null then
      insert into public.courses (user_id, title, domain, subject, file_name, file_type, status, content_text, overview, outline, key_points, keywords, word_count, copied_from)
      values (auth.uid(), c.title, c.domain, c.subject, c.file_name, c.file_type, 'ready', c.content_text, c.overview, c.outline, c.key_points, c.keywords, c.word_count, c.id)
      returning id into v_course;
    end if;
  end if;

  -- Discussion : la sienne, une reprise existante ou une nouvelle copie avec ses messages.
  if ch.user_id = auth.uid() then
    v_chat := ch.id;
  else
    select id into v_chat from public.chats where user_id = auth.uid() and copied_from = ch.id order by created_at limit 1;
    if v_chat is null then
      insert into public.chats (course_id, user_id, title, copied_from)
      values (v_course, auth.uid(), ch.title, ch.id)
      returning id into v_chat;
      insert into public.chat_messages (chat_id, user_id, role, content, created_at)
      select v_chat, auth.uid(), m.role, m.content, m.created_at
      from public.chat_messages m where m.chat_id = ch.id order by m.created_at;
      v_created := true;
    end if;
  end if;

  return jsonb_build_object('course_id', v_course, 'chat_id', v_chat, 'created', v_created);
end;
$$;
grant execute on function public.continue_shared_chat(text) to authenticated;
