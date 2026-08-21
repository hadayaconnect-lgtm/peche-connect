-- Migration incrémentale — à exécuter si vous avez déjà lancé schema.sql
-- avant l'ajout du gradient de chlorophylle (front chlorophyllien).
-- Sans effet si la colonne existe déjà.

alter table zones_satellite
  add column if not exists gradient_chlorophylle numeric;
