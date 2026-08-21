# Pêche Connect Djibouti

PWA d'aide à la pêche artisanale, couvrant le littoral d'Érythrée, Djibouti
et Somalie (mer Rouge sud, Golfe de Tadjoura, Golfe d'Aden, océan Indien
nord-ouest) — 29 zones de référence, réparties autour de 6 ports de
référence (Djibouti-ville, Massawa, Assab, Berbera, Bosaso, Mogadiscio).
Chaque zone affiche sa distance au port de référence le plus proche.
Combine des
données satellite (température de surface, chlorophylle) avec un moteur de
scoring de zones et un assistant IA conversationnel.

## Stack

- Next.js 14 (App Router) / TypeScript / Tailwind CSS
- Leaflet / react-leaflet pour la carte
- Façade localStorage `pecheDb` pour les signalements (voir migration
  Supabase ci-dessous)
- API Anthropic (route serveur `/api/assistant`) pour l'assistant IA
- Script Python + GitHub Actions pour les données satellite réelles
  (Copernicus Marine Service) + Supabase pour les stocker

## État des données satellite : réelles ou simulées ?

L'app distingue désormais trois statuts **par donnée individuelle** (pas
seulement par zone) : `reel`, `simule`, `indisponible`. Visible sur chaque
zone (petite puce colorée à côté de chaque valeur) et dans le tableau
admin.

**Règle stricte (jamais de repli silencieux)** : si la température de
surface ou la chlorophylle Copernicus est absente ou périmée (>36h) pour
une zone, le potentiel de pêche de cette zone n'est **pas calculé** (`score:
null`, affiché "Indisponible") — il n'est jamais remplacé par une valeur
simulée sans le dire.

**Toujours simulés à ce stade** : rien — vent, hauteur de vague, et
**courants marins** sont désormais récupérés en quasi temps réel via
**Open-Meteo** (API REST publique, gratuite, sans clé, mise à jour horaire).
Un repli simulé existe uniquement si l'API est temporairement injoignable
pour une zone, et reste alors marqué explicitement `simule` (jamais
présenté comme réel). Les courants marins ont une résolution d'environ 8km
et une précision réduite près des côtes (limite documentée par Open-Meteo
lui-même) — affichés avec cette réserve dans l'interface.

## Moteur de scoring multi-paramètres

Une seule fonction, `genererZonesAvecScore()` dans `lib/peche/scoring.ts`,
calcule le potentiel de pêche pour toutes les zones. Le score n'est calculé
que si SST et chlorophylle (Copernicus) sont toutes deux réelles et
fraîches — les autres critères sont optionnels et pris en compte quand ils
sont disponibles, avec renormalisation des poids parmi les critères
présents.

**Pondération** (`PONDERATION_SCORE`, exportée et facilement modifiable
dans `lib/peche/scoring.ts`) :

| Critère | Poids | Source |
|---|---|---|
| Gradient thermique (front SST) | 20% | Copernicus (dérivé) |
| Chlorophylle | 20% | Copernicus (réel) |
| Température de surface (SST) | 15% | Copernicus (réel) |
| Gradient chlorophylle (front) | 15% | Copernicus (dérivé) |
| Convergence des courants | 15% | Calculé — voir ci-dessous |
| Bathymétrie (profondeur) | 15% | Open Topo Data / GEBCO (réel) |

Si des signalements pêcheurs récents existent pour la zone, le score de
base est ensuite pondéré à 70%/30% avec le retour terrain (donnée réelle
déclarée par un utilisateur).

**Convergence des courants** — n'est pas une mesure directe : calculée à
partir des courants réels Open-Meteo déjà récupérés (aucun nouvel appel
API), en comparant la direction du courant de chaque zone à celle de ses
zones voisines (≤100km). Un écart angulaire important entre courants
voisins est interprété comme un indice de rencontre/convergence. Reste
"indisponible" si les courants environnants ne sont pas réels — jamais
calculé à partir de valeurs simulées.

**Bathymétrie** — [Open Topo Data](https://www.opentopodata.org) (jeu de
données GEBCO 2020), API gratuite sans clé. Donnée statique (profondeur ne
change pas), mise en cache 30 jours côté serveur.

**Relais automatique en cas de panne Copernicus** — si le script quotidien
Copernicus échoue ou a un retard de publication pour une zone (température
et gradient thermique indisponibles), l'app bascule automatiquement sur la
température de surface d'**Open-Meteo Marine** (mise à jour horaire,
dérivée en partie de modèles Copernicus) comme relais, avec un gradient
thermique recalculé à partir des zones voisines de ce relais. Copernicus
reste toujours prioritaire quand il est frais ; le relais n'est utilisé
qu'en secours, et sa source est étiquetée distinctement partout dans
l'interface (jamais confondu avec une donnée Copernicus). Le compteur
"Copernicus réel" du tableau de bord reste strict et ne compte que les
zones où le pipeline Copernicus principal a réellement réussi ce jour-là —
le relais permet à l'app de rester utile, mais n'est pas comptabilisé comme
la source scientifique de référence.

**Cascade de secours pour la chlorophylle** — même principe, appliqué à la
chlorophylle, avec trois niveaux :

1. **Copernicus Marine** (source principale, script quotidien)
2. Si indisponible → **NOAA CoastWatch VIIRS Suomi-NPP** (`noaacwNPPVIIRSchlaDaily`,
   un seul satellite, 4km, quasi temps réel — [documentation](https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSchlaDaily.html))
3. Si toujours indisponible → **NOAA CoastWatch VIIRS DINEOF** (`noaacwNPPN20VIIRSDINEOFDaily`,
   fusion Suomi-NPP + NOAA-20 avec comblement algorithmique des trous
   (DINEOF), 9km, quasi temps réel — [documentation](https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPN20VIIRSDINEOFDaily.html)) —
   spécifiquement conçu pour réduire les trous de données typiques des
   produits mono-satellite

Un gradient chlorophyllien est recalculé à partir des zones voisines
lorsque l'un de ces relais est utilisé. Chaque zone affiche la source
exacte ayant fourni la valeur (visible dans "Provenance des données clés").

**Fenêtre temporelle** — chaque dataset est interrogé sur les 20 derniers
pas de temps (pas seulement le plus récent), la valeur valide la plus
récente étant retenue : les produits quotidiens de couleur de l'océan ont
fréquemment des trous (nuages, contamination du signal), et certains
produits NOAA se sont révélés avoir un retard de publication plus
important qu'anticipé lors des tests.

**Contrainte connue** — le serveur NOAA CoastWatch impose explicitement une
requête à la fois (erreur 429 sinon). L'app n'interroge donc ces relais que
pour les zones où Copernicus a réellement échoué (pas systématiquement les
38), en séquentiel avec une courte pause entre chaque appel — y compris
entre le 2ᵉ et le 3ᵉ niveau pour une même zone. Dans le cas extrême où
Copernicus est indisponible pour **toutes** les zones en même temps, cette
cascade séquentielle peut prendre plusieurs dizaines de secondes (voire
plus si le 3ᵉ niveau est nécessaire pour beaucoup de zones) et risque de
dépasser la limite de durée d'une fonction serverless sur un plan Vercel
gratuit (Hobby, plafonné à 10s) — fonctionne normalement sur un plan Pro
(jusqu'à 60s déclarés). Ce cas (panne totale simultanée sur toutes les
zones) reste rare ; l'usage normal ne concerne qu'un petit nombre de zones
à la fois.

Sources envisagées mais **non intégrées**, avec la raison précise :
- **Sentinel-3 OLCI** (aussi hébergé par NOAA CoastWatch) : uniquement
  disponible par "secteurs" régionaux dont la couverture géographique pour
  la Corne de l'Afrique n'a pas pu être confirmée de façon fiable
- **NASA PACE** : nécessite une authentification Earthdata (OAuth),
  complexité disproportionnée pour un simple relais de secours

**Niveau de confiance réduit avec les relais** — si un ou deux relais sont
utilisés pour une zone donnée, le niveau de confiance est explicitement
plafonné (`moyen` avec un seul relais, `faible` avec les deux) plutôt que
de laisser croire à une fiabilité équivalente aux sources principales.

**Sources volontairement non ajoutées** — Sentinel-3, VIIRS NOAA, NASA PACE
mesurent des grandeurs déjà couvertes par les produits Copernicus utilisés
(SST/chlorophylle). Les ajouter en plus aurait dupliqué une donnée déjà
réelle sans apporter de nouvelle variable. Salinité et anomalie de hauteur
de mer (détection de tourbillons/eddies) sont identifiées comme pistes
futures mais pas encore intégrées : elles nécessitent de vérifier au
préalable les identifiants exacts des produits Copernicus correspondants
(la même prudence qui avait révélé un mauvais identifiant pour le produit
SST initial).

Chaque zone reçoit aussi un **niveau de confiance** (`eleve` / `moyen` /
`faible`, basé sur la fraîcheur de la donnée, le nombre de signalements
terrain, et le nombre de critères complémentaires réels disponibles) et une
liste de **raisons** en français expliquant le score (avec ✓ pour les
critères favorables) — jamais présenté comme une "probabilité de présence
de poisson", toujours comme un "potentiel de pêche" ou des "conditions
favorables".

## Signalements pêcheurs (Supabase)

Les signalements (`beaucoup`/`peu`/`rien` + espèces) sont désormais
centralisés dans la table Supabase `signalements` (visible par tous les
utilisateurs et depuis le tableau de bord), avec repli localStorage
uniquement si Supabase est injoignable (résilience, pas falsification de
données environnementales). Chaque signalement conserve le score affiché au
moment de l'envoi (`score_au_moment`), pour comparer plus tard
recommandation du système et résultat réel constaté par le pêcheur
(validation terrain).

### 1. Compte Copernicus Marine (gratuit)

Créer un compte sur https://marine.copernicus.eu → notez le nom
d'utilisateur et le mot de passe.

### 2. Vérifier les identifiants de dataset

Les identifiants utilisés dans `scripts/fetch_copernicus.py` sont :
- SST : `METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2` (variable `analysed_sst`, en
  Kelvin — le script convertit en °C)
- Chlorophylle : `cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D`
  (variable `CHL`)

Ces identifiants peuvent changer avec le temps (Copernicus fait évoluer son
catalogue). Avant la première utilisation, vérifier avec :

```bash
pip install copernicusmarine
copernicusmarine describe --contains "sea surface temperature" --return-fields dataset_id
copernicusmarine describe --contains "chlorophyll" --return-fields dataset_id
```

Si les identifiants ont changé, les mettre à jour dans les secrets GitHub
Actions (`COPERNICUS_SST_DATASET_ID`, `COPERNICUS_CHL_DATASET_ID`) plutôt que
dans le code — le script les lit depuis l'environnement avec ces valeurs par
défaut.

### 3. Créer le projet Supabase

1. Créer un projet sur https://supabase.com (gratuit)
2. Dans **SQL Editor**, exécuter le contenu de `supabase/schema.sql`
3. Récupérer dans **Project Settings → API** :
   - `Project URL` → variable `SUPABASE_URL` (secret GitHub) et
     `NEXT_PUBLIC_SUPABASE_URL` (Vercel)
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (secret GitHub
     **uniquement** — ne jamais exposer cette clé côté client, elle
     contourne les règles de sécurité)

### 4. Configurer les secrets GitHub Actions

Dans le repo GitHub → **Settings → Secrets and variables → Actions**,
ajouter :
- `COPERNICUSMARINE_SERVICE_USERNAME`
- `COPERNICUSMARINE_SERVICE_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Le workflow `.github/workflows/fetch-satellite-data.yml` tourne
automatiquement chaque jour à 04h00 UTC. Il peut aussi être déclenché
manuellement depuis l'onglet **Actions** du repo GitHub (bouton "Run
workflow").

### 5. Configurer Vercel

Dans **Project Settings → Environment Variables**, ajouter :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Puis redéployer. L'app va automatiquement afficher les données réelles dès
qu'elles existent dans Supabase (avec repli automatique sur la simulation
pour toute zone sans donnée récente — voir `lib/peche/supabase-satellite.ts`,
seuil de fraîcheur 36h).

### Test manuel du script (avant d'attendre le premier run automatique)

```bash
pip install -r scripts/requirements.txt
export COPERNICUSMARINE_SERVICE_USERNAME=...
export COPERNICUSMARINE_SERVICE_PASSWORD=...
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
python scripts/fetch_copernicus.py
```

## Lancer l'app en local

```bash
npm install
npm run dev
```

## Variables d'environnement (app Next.js)

Copier `.env.example` vers `.env.local` :
- `ANTHROPIC_API_KEY` — indispensable pour l'assistant IA
- `ANTHROPIC_MODEL` — optionnel, `claude-sonnet-5` par défaut
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — optionnels,
  activent les données satellite réelles si présents

## Structure

```
app/
  page.tsx                 → écran principal (carte + panneaux)
  admin/page.tsx           → tableau de bord institutionnel
  api/assistant/route.ts   → route serveur appelant l'API Anthropic
  api/meteo/route.ts       → route serveur appelant Open-Meteo (vent/vagues/courants, temps réel)
  api/bathymetrie/route.ts → route serveur appelant Open Topo Data (GEBCO, profondeur, cache 30j)
components/peche/          → composants UI
lib/peche/
  types.ts
  zones-reference.ts       → lit data/zones.json (source unique)
  satellite.ts             → générateur de simulation (repli vent/vagues)
  supabase-satellite.ts    → lecture des données SST/chlorophylle réelles (Supabase)
  openmeteo-client.ts      → lecture vent/vagues/courants réels (via /api/meteo)
  bathymetrie-client.ts    → lecture profondeur réelle (via /api/bathymetrie)
  voix.ts                  → reconnaissance et synthèse vocale (navigateur)
  scoring.ts               → genererZonesAvecScore, moteur unifié (réel + repli transparent)
  db.ts                     → messages/alertes locaux + signalements (Supabase)
data/zones.json             → zones de référence (source unique, partagée
                               avec scripts/fetch_copernicus.py)
scripts/
  fetch_copernicus.py       → récupère SST + chlorophylle réelles, pousse
                               vers Supabase
  requirements.txt
.github/workflows/
  fetch-satellite-data.yml  → exécute le script chaque jour
supabase/
  schema.sql                → schéma des tables zones_satellite et signalements
  migration-2g-validation-terrain.sql
public/
  manifest.json, sw.js, icons/ → PWA
```

## Roadmap suggérée

1. ~~Intégration réelle Copernicus Marine~~ — fait, voir ci-dessus
2. Migration des signalements pêcheurs de localStorage vers la table
   Supabase `signalements` (déjà créée par `supabase/schema.sql`), pour les
   partager entre tous les utilisateurs plutôt que par appareil
3. Modèle de scoring entraîné (régression / random forest) sur l'historique
   réel de signalements, en remplacement de la pondération heuristique
   actuelle
4. Canal SMS pour les pêcheurs sans smartphone
