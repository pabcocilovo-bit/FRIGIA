-- Les réponses au questionnaire de la bêta (« Ton avis compte », page /avis de l'appli).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Pour lire les réponses : select created_at, answers from public.beta_feedback order by created_at desc;
--
-- answers : les réponses telles qu'affichées (ex. {"manque": "Beaucoup", "utilise": ["Les recettes proposées"], …}).
-- source : d'où vient la personne (« accueil » : la carte du 5e jour ; « profil » : Mon profil).

create table if not exists public.beta_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers jsonb not null check (pg_column_size(answers) <= 16000),
  source text check (char_length(source) <= 20),
  created_at timestamptz not null default now()
);
create index if not exists beta_feedback_user on public.beta_feedback (user_id);

alter table public.beta_feedback enable row level security;

-- Chacun envoie ses propres réponses et peut les relire ; personne ne lit celles des autres.
drop policy if exists "beta_feedback: insert own" on public.beta_feedback;
create policy "beta_feedback: insert own" on public.beta_feedback
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "beta_feedback: read own" on public.beta_feedback;
create policy "beta_feedback: read own" on public.beta_feedback
  for select to authenticated using (user_id = auth.uid());
