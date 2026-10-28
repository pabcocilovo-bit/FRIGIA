-- Repas cuisinés, deux chiffres (étape 9) : kg / eur deviennent « sauvé » (les produits marqués « À finir » au scan),
-- used_kg / used_eur « cuisiné de ton frigo » (tous les produits frais déjà là).
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, seul « sauvé » est gardé sur le compte.
-- Les repas déjà gardés comptaient tout le frigo comme sauvé : ce chiffre passe en « cuisiné », et leur « sauvé » repart de 0.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cooked_meals' and column_name = 'used_kg'
  ) then
    alter table public.cooked_meals
      add column used_kg numeric(6, 2) not null default 0 check (used_kg >= 0),
      add column used_eur numeric(7, 2) not null default 0 check (used_eur >= 0);
    update public.cooked_meals set used_kg = kg, used_eur = eur, kg = 0, eur = 0;
  end if;
end $$;
