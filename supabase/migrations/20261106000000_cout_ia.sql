-- Le coût de Claude dans le dashboard (/admin), sans clé admin Anthropic (Hugo, 30 octobre) : chaque appel à Claude
-- (api/_ai.ts, askClaude) note ses tokens ici, et le dashboard calcule le coût avec les prix d'Anthropic (api/_finances.ts).
-- Quand Frigia aura une organisation chez Anthropic (la SAS), ANTHROPIC_ADMIN_KEY dans Vercel donne le coût réel à la place.
-- À lancer une fois dans Supabase (prod et frigia-test) : SQL Editor > New query > coller > Run.

create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cache_read_tokens integer not null default 0
);
create index if not exists ai_usage_created_at on public.ai_usage (created_at);
-- Lu et écrit par le serveur seulement (clé service) : aucune règle pour les comptes
alter table public.ai_usage enable row level security;
