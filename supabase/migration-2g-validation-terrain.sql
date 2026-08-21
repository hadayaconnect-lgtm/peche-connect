-- Migration incrémentale — à exécuter si vous avez déjà lancé schema.sql
-- avant l'ajout de la colonne score_au_moment (étape 2G, validation terrain).
-- Sans effet si la colonne existe déjà.

alter table signalements
  add column if not exists score_au_moment numeric;
