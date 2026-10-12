-- Le repas choisi au scan (ce midi, ce soir, la semaine) : « Scan de 18 h 42 · pour ce soir », et Tes scans (étape 7).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, les scans sont gardés sans le repas.

alter table public.user_history add column if not exists meal text check (meal in ('m', 's', 'w'));
