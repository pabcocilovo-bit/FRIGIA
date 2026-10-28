-- La liste d'attente du site, avant l'ouverture à tous (api/waitlist.ts).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, le formulaire répond « ça n'a pas marché ».
-- Seul le serveur lit et écrit cette table. Pour voir les inscrits : select * from public.waitlist order by created_at;
-- invited_at / invite_code : remplis quand la personne reçoit son accès à l'alpha.

create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  first_name text not null check (char_length(first_name) between 1 and 40),
  source text check (char_length(source) <= 60),
  created_at timestamptz not null default now(),
  invited_at timestamptz,
  invite_code text
);
create unique index if not exists waitlist_email on public.waitlist (email);
create index if not exists waitlist_created on public.waitlist (created_at);
alter table public.waitlist enable row level security;
