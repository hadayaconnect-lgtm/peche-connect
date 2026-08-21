-- Pêche Connect — schéma Supabase
-- À exécuter dans l'éditeur SQL de Supabase (Project > SQL Editor > New query)

-- Table des données satellite réelles, alimentée quotidiennement par le
-- script scripts/fetch_copernicus.py via GitHub Actions.
create table if not exists zones_satellite (
  zone_id text primary key,
  temperature_surface numeric not null,
  chlorophylle numeric not null,
  gradient_thermique numeric not null,
  gradient_chlorophylle numeric,
  score_satellite integer not null,
  date_reference timestamptz not null,
  source text not null default 'copernicus',
  updated_at timestamptz not null default now()
);

-- Lecture publique (données non sensibles, nécessaire pour que l'app les
-- affiche via la clé anonyme côté client)
alter table zones_satellite enable row level security;

create policy "Lecture publique zones_satellite"
  on zones_satellite for select
  using (true);

-- Aucune policy d'écriture pour anon/authenticated : seule la clé
-- service_role (utilisée uniquement par le script GitHub Actions, jamais
-- exposée côté client) peut écrire, car elle contourne RLS par défaut.


-- Table des signalements de pêcheurs (remplace le stockage localStorage
-- pour un déploiement multi-utilisateurs — voir migration dans lib/peche/db.ts)
create table if not exists signalements (
  id uuid primary key default gen_random_uuid(),
  zone_id text not null,
  type text not null check (type in ('beaucoup', 'peu', 'rien')),
  especes text,
  date timestamptz not null default now(),
  auteur text,
  -- Validation terrain (comparaison recommandation ↔ résultat réel) :
  -- score affiché au pêcheur au moment de son signalement
  score_au_moment numeric
);

alter table signalements enable row level security;

create policy "Lecture publique signalements"
  on signalements for select
  using (true);

create policy "Ecriture publique signalements"
  on signalements for insert
  with check (true);

create index if not exists idx_signalements_zone on signalements (zone_id);
create index if not exists idx_signalements_date on signalements (date desc);
