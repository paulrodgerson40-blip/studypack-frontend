-- Translations table for StudyPack.ai
-- Stores translated pack.json and rendered PDF metadata per job+language

create table if not exists translations (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references user_profiles(id) on delete cascade,
  job_id               text not null,
  pack_id              uuid references weekly_packs(id) on delete set null,
  target_language      text not null,          -- BCP-47 code: "es", "fr", etc.
  language_name        text not null,          -- Human label: "Spanish"
  status               text not null default 'processing'
                         check (status in ('processing', 'complete', 'failed')),
  translated_json_path text,                   -- Spaces key: packs/{job_id}/pack_{lang}.json
  translated_pdf_path  text,                   -- Spaces key: packs/{job_id}/pack_{lang}.pdf
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Prevent duplicate translation charges for same job+language per user
create unique index if not exists translations_user_job_lang_idx
  on translations (user_id, job_id, target_language);

-- Fast lookup by job_id
create index if not exists translations_job_id_idx on translations (job_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists translations_updated_at on translations;
create trigger translations_updated_at
  before update on translations
  for each row execute procedure update_updated_at();

-- RLS: users can only see their own translations
alter table translations enable row level security;

create policy "Users see own translations"
  on translations for select
  using (
    user_id = (
      select id from user_profiles
      where clerk_user_id = auth.uid()::text
    )
  );

-- Service role bypasses RLS (used by API routes with supabaseAdmin)
