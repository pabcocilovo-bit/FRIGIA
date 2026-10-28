-- Réglages (étape 8) : la photo de profil suit le compte, et « Nous écrire » arrive dans une table.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Sans elle : la photo reste sur le téléphone seulement, et « Nous écrire » ne part pas.

-- Photo de profil : une petite image (256 px) ou l'adresse d'une photo de plat
alter table public.profiles add column if not exists avatar text;

-- Messages envoyés depuis l'appli (Nous écrire, Signaler un problème, Donner ton avis).
-- À lire dans Table Editor > support_messages, et répondre à l'email du message.
create table if not exists public.support_messages (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  kind text not null check (kind in ('contact', 'bug', 'idea')),
  topic text,
  message text not null check (char_length(message) between 1 and 5000),
  app_info text,
  created_at timestamptz not null default now()
);

-- Chacun peut seulement envoyer ses propres messages (pas les relire ni les changer)
alter table public.support_messages enable row level security;

drop policy if exists "message : envoi" on public.support_messages;
create policy "message : envoi" on public.support_messages
  for insert with check (auth.uid() = user_id);
