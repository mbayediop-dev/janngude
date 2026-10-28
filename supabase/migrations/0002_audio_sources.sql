-- ============================================================================
-- Janngude — lectures audio des grandes lignes et des points à retenir
-- À exécuter dans l’éditeur SQL de Supabase (idempotent).
-- ============================================================================

alter table public.audio_readings drop constraint if exists audio_readings_source_check;
alter table public.audio_readings
  add constraint audio_readings_source_check
  check (source in ('course', 'summary', 'outline', 'keypoints'));
