-- Le dessert au scan (« Dessert », à côté de Ce midi, Ce soir, La semaine) : le repas « d » est accepté.
-- À lancer une fois dans Supabase : SQL Editor > New query > coller > Run. Sans elle, un scan dessert est gardé sans le repas.

alter table public.user_history drop constraint if exists user_history_meal_check;
alter table public.user_history add constraint user_history_meal_check check (meal in ('m', 's', 'w', 'd'));
