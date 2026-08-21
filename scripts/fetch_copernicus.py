#!/usr/bin/env python3
"""
Récupère les données satellite réelles (Copernicus Marine Service) pour le
littoral d'Érythrée, Djibouti et Somalie (mer Rouge sud, Golfe de Tadjoura,
Golfe d'Aden, océan Indien nord-ouest), calcule un score par zone, et pousse
le résultat vers Supabase pour que l'app Pêche Connect les lise.

Prérequis :
- Compte Copernicus Marine (gratuit) : https://marine.copernicus.eu
- Variables d'environnement :
    COPERNICUSMARINE_SERVICE_USERNAME
    COPERNICUSMARINE_SERVICE_PASSWORD
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
- Dépendances : pip install -r scripts/requirements.txt

Exécution prévue via GitHub Actions (.github/workflows/fetch-satellite-data.yml),
une fois par jour. Peut aussi être lancé manuellement :
    python scripts/fetch_copernicus.py

Datasets utilisés (à vérifier/mettre à jour via `copernicusmarine describe`,
les identifiants exacts peuvent évoluer) :
- SST  : cmems_obs-sst_glo_phy_nrt_l4_P1D-m   (variable: analysed_sst, en Kelvin)
- CHL  : cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D (variable: CHL)
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests
import xarray as xr

import copernicusmarine

RACINE = Path(__file__).resolve().parent.parent
ZONES_JSON = RACINE / "data" / "zones.json"

SST_DATASET_ID = os.environ.get("COPERNICUS_SST_DATASET_ID", "METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2")
SST_VARIABLE = os.environ.get("COPERNICUS_SST_VARIABLE", "analysed_sst")
CHL_DATASET_ID = os.environ.get(
    "COPERNICUS_CHL_DATASET_ID", "cmems_obs-oc_glo_bgc-plankton_nrt_l4-gapfree-multi-4km_P1D"
)
CHL_VARIABLE = os.environ.get("COPERNICUS_CHL_VARIABLE", "CHL")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Marge autour de la zone couverte (littoral Érythrée → Djibouti → Somalie)
MARGE_DEG = 0.15


def charger_zones() -> dict:
    with open(ZONES_JSON, "r", encoding="utf-8") as f:
        return json.load(f)


def emprise_globale(zones: list[dict]) -> tuple[float, float, float, float]:
    lats = [z["lat"] for z in zones]
    lons = [z["lon"] for z in zones]
    return (
        min(lons) - MARGE_DEG,
        max(lons) + MARGE_DEG,
        min(lats) - MARGE_DEG,
        max(lats) + MARGE_DEG,
    )


def telecharger_subset(dataset_id: str, variable: str, bbox: tuple, dossier: Path) -> Path:
    lon_min, lon_max, lat_min, lat_max = bbox

    # Fenêtre décalée dans le passé plutôt que "hier → aujourd'hui" : les
    # produits Copernicus NRT ont un retard de publication variable (1 à
    # plusieurs jours selon les périodes). On essaie plusieurs marges
    # croissantes jusqu'à ce que la fenêtre demandée recouvre effectivement
    # des données publiées, plutôt que de supposer un délai fixe qui
    # pourrait redevenir incorrect. valeur_au_point sélectionne ensuite le
    # pas de temps le plus récent disponible dans la fenêtre retenue.
    MARGES_A_ESSAYER_JOURS = [1, 2, 4, 7]
    derniere_erreur: Exception | None = None

    for marge in MARGES_A_ESSAYER_JOURS:
        fin_fenetre = (datetime.now(timezone.utc) - timedelta(days=marge)).strftime("%Y-%m-%d")
        debut_fenetre = (datetime.now(timezone.utc) - timedelta(days=marge + 5)).strftime("%Y-%m-%d")
        try:
            copernicusmarine.subset(
                dataset_id=dataset_id,
                variables=[variable],
                minimum_longitude=lon_min,
                maximum_longitude=lon_max,
                minimum_latitude=lat_min,
                maximum_latitude=lat_max,
                start_datetime=debut_fenetre,
                end_datetime=fin_fenetre,
                output_directory=str(dossier),
                output_filename=f"{dataset_id}.nc",
                overwrite=True,
                disable_progress_bar=True,
            )
            if marge > MARGES_A_ESSAYER_JOURS[0]:
                print(f"  (Réussi avec une marge de {marge} jour(s) — retard de publication détecté.)")
            return dossier / f"{dataset_id}.nc"
        except Exception as exc:  # noqa: BLE001
            derniere_erreur = exc
            continue

    print(
        f"\nERREUR : impossible de récupérer le dataset '{dataset_id}' même après plusieurs marges de "
        f"retard testées ({MARGES_A_ESSAYER_JOURS} jours).\n"
        f"Deux causes possibles :\n"
        f"  1. L'identifiant a changé dans le catalogue Copernicus. Vérifiez avec :\n"
        f"     copernicusmarine describe --contains \"<mot-clé du produit>\" --return-fields dataset_id\n"
        f"     Puis mettez à jour le secret GitHub COPERNICUS_SST_DATASET_ID ou COPERNICUS_CHL_DATASET_ID.\n"
        f"  2. Le retard de publication dépasse {max(MARGES_A_ESSAYER_JOURS)} jours (rare, souvent lié à\n"
        f"     une maintenance côté Copernicus) — réessayez plus tard ou augmentez MARGES_A_ESSAYER_JOURS.\n"
        f"Détail de la dernière erreur : {derniere_erreur}\n",
        file=sys.stderr,
    )
    raise derniere_erreur


def valeur_au_point(chemin_nc: Path, variable: str, lat: float, lon: float) -> float | None:
    try:
        ds = xr.open_dataset(chemin_nc)
        point = ds[variable].sel(latitude=lat, longitude=lon, method="nearest")
        # Prend le dernier pas de temps disponible s'il y a une dimension temporelle
        if "time" in point.dims:
            point = point.isel(time=-1)
        valeur = float(point.values)
        ds.close()
        return valeur if not np.isnan(valeur) else None
    except Exception as exc:  # noqa: BLE001
        print(f"  Avertissement lecture {variable} à ({lat},{lon}) : {exc}", file=sys.stderr)
        return None


def gradient_local(chemin_nc: Path, variable: str, lat: float, lon: float, decalage: float = 0.08) -> float:
    """Front thermique/biogéochimique local, même logique que la simulation TS :
    écart moyen avec 4 points voisins, normalisé 0-1."""
    centre = valeur_au_point(chemin_nc, variable, lat, lon)
    if centre is None:
        return 0.0
    voisins = [
        valeur_au_point(chemin_nc, variable, lat + decalage, lon),
        valeur_au_point(chemin_nc, variable, lat - decalage, lon),
        valeur_au_point(chemin_nc, variable, lat, lon + decalage),
        valeur_au_point(chemin_nc, variable, lat, lon - decalage),
    ]
    voisins = [v for v in voisins if v is not None]
    if not voisins:
        return 0.0
    ecart_moyen = sum(abs(v - centre) for v in voisins) / len(voisins)
    return min(1.0, ecart_moyen / 1.5)


def calculer_score(gradient: float, chlorophylle: float) -> int:
    score_gradient = gradient * 100
    score_chlorophylle = min(100, (chlorophylle / 1.8) * 100)
    # Note : la part "retours terrain" (30% côté simulation TS) est ajoutée
    # séparément côté application à partir des signalements réels stockés
    # dans Supabase — ce script ne fournit que la composante satellite.
    score = score_gradient * 0.6 + score_chlorophylle * 0.4
    return round(min(100, max(0, score)))


def pousser_vers_supabase(lignes: list[dict]) -> None:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        print("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY non définis — écriture ignorée.", file=sys.stderr)
        print(json.dumps(lignes, indent=2, ensure_ascii=False))
        return

    url = f"{SUPABASE_URL}/rest/v1/zones_satellite?on_conflict=zone_id"
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    reponse = requests.post(url, headers=headers, json=lignes, timeout=30)
    if reponse.status_code >= 300:
        print(f"Erreur Supabase ({reponse.status_code}) : {reponse.text}", file=sys.stderr)
        sys.exit(1)
    print(f"{len(lignes)} zones mises à jour dans Supabase.")


def main() -> None:
    donnees = charger_zones()
    zones = donnees["zones"]
    bbox = emprise_globale(zones)

    with tempfile.TemporaryDirectory() as tmp:
        dossier = Path(tmp)
        print(f"Téléchargement SST ({SST_DATASET_ID}) pour l'emprise {bbox}...")
        chemin_sst = telecharger_subset(SST_DATASET_ID, SST_VARIABLE, bbox, dossier)

        print(f"Téléchargement chlorophylle ({CHL_DATASET_ID}) pour l'emprise {bbox}...")
        chemin_chl = telecharger_subset(CHL_DATASET_ID, CHL_VARIABLE, bbox, dossier)

        maintenant = datetime.now(timezone.utc).isoformat()
        lignes = []
        for zone in zones:
            lat, lon = zone["lat"], zone["lon"]
            sst_kelvin = valeur_au_point(chemin_sst, SST_VARIABLE, lat, lon)
            chlorophylle = valeur_au_point(chemin_chl, CHL_VARIABLE, lat, lon)
            gradient = gradient_local(chemin_sst, SST_VARIABLE, lat, lon)

            if sst_kelvin is None or chlorophylle is None:
                print(f"  Zone {zone['id']} : données manquantes, ignorée pour cette exécution.")
                continue

            # Gradient de chlorophylle (front chlorophyllien) — calcul isolé
            # dans son propre try/except : s'il échoue, on continue quand
            # même à pousser SST/chlorophylle/gradient thermique plutôt que
            # de perdre toute la zone pour cette exécution.
            try:
                gradient_chl = gradient_local(chemin_chl, CHL_VARIABLE, lat, lon)
            except Exception as exc:  # noqa: BLE001
                print(f"  Avertissement gradient chlorophylle {zone['id']} : {exc}", file=sys.stderr)
                gradient_chl = None

            temperature_celsius = round(sst_kelvin - 273.15, 1)
            score = calculer_score(gradient, chlorophylle)

            lignes.append(
                {
                    "zone_id": zone["id"],
                    "temperature_surface": temperature_celsius,
                    "chlorophylle": round(chlorophylle, 2),
                    "gradient_thermique": round(gradient, 3),
                    "gradient_chlorophylle": round(gradient_chl, 3) if gradient_chl is not None else None,
                    "score_satellite": score,
                    "date_reference": maintenant,
                    "source": "copernicus",
                }
            )
            print(f"  {zone['nom']}: {temperature_celsius}°C, chl={chlorophylle:.2f}, score={score}")

        pousser_vers_supabase(lignes)


if __name__ == "__main__":
    main()
