// Lecture du vent/vagues en quasi temps réel (Open-Meteo) via la route
// serveur /api/meteo. Même règle de transparence que pour Copernicus :
// une valeur absente reste "indisponible" ici — c'est scoring.ts qui
// décide, champ par champ, de retomber sur la simulation en le marquant
// explicitement "simule" (jamais un repli silencieux qui se ferait passer
// pour du réel).

import { ChampDonnee } from "./types";

interface LigneMeteoBrute {
  vitesseVentKmh: number | null;
  directionVentDeg: number | null;
  hauteurVagueM: number | null;
  vitesseCourantKmh: number | null;
  directionCourantDeg: number | null;
  temperatureSurfaceRelaisC: number | null;
  heure: string | null;
}

export interface MeteoTempsReelZone {
  vitesseVent: ChampDonnee<number>;
  directionVent: ChampDonnee<string>;
  hauteurVague: ChampDonnee<number>;
  vitesseCourant: ChampDonnee<number>;
  directionCourant: ChampDonnee<string>;
  temperatureSurfaceRelais: ChampDonnee<number>;
}

const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

function degresVersCompas(deg: number): string {
  const index = Math.round(deg / 45) % 8;
  return DIRECTIONS[index];
}

function champIndisponible<T>(unite: string): ChampDonnee<T> {
  return {
    valeur: null,
    statut: "indisponible",
    unite,
    source: "Open-Meteo",
    dateObservation: null,
    dateRecuperation: null,
  };
}

export async function recupererMeteoTempsReel(): Promise<Record<string, MeteoTempsReelZone>> {
  try {
    const reponse = await fetch("/api/meteo", { cache: "no-store" });
    if (!reponse.ok) {
      console.error("Erreur route /api/meteo:", await reponse.text());
      return {};
    }
    const lignes: Record<string, LigneMeteoBrute> = await reponse.json();
    const maintenant = new Date().toISOString();

    const resultat: Record<string, MeteoTempsReelZone> = {};
    for (const [zoneId, ligne] of Object.entries(lignes)) {
      resultat[zoneId] = {
        vitesseVent:
          ligne.vitesseVentKmh !== null
            ? {
                valeur: ligne.vitesseVentKmh,
                statut: "reel",
                unite: "km/h",
                source: "Open-Meteo (modèle météo horaire)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible("km/h"),
        directionVent:
          ligne.directionVentDeg !== null
            ? {
                valeur: degresVersCompas(ligne.directionVentDeg),
                statut: "reel",
                unite: "",
                source: "Open-Meteo (modèle météo horaire)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible(""),
        hauteurVague:
          ligne.hauteurVagueM !== null
            ? {
                valeur: ligne.hauteurVagueM,
                statut: "reel",
                unite: "m",
                source: "Open-Meteo Marine (modèle houle/vagues)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible("m"),
        vitesseCourant:
          ligne.vitesseCourantKmh !== null
            ? {
                valeur: ligne.vitesseCourantKmh,
                statut: "reel",
                unite: "km/h",
                source: "Open-Meteo Marine (courants, ~8km résolution — précision limitée près des côtes)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible("km/h"),
        directionCourant:
          ligne.directionCourantDeg !== null
            ? {
                valeur: degresVersCompas(ligne.directionCourantDeg),
                statut: "reel",
                unite: "",
                source: "Open-Meteo Marine (courants, ~8km résolution — précision limitée près des côtes)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible(""),
        temperatureSurfaceRelais:
          ligne.temperatureSurfaceRelaisC !== null
            ? {
                valeur: ligne.temperatureSurfaceRelaisC,
                statut: "reel",
                unite: "°C",
                source: "Open-Meteo Marine (relais horaire, dérivé notamment de Copernicus)",
                dateObservation: ligne.heure,
                dateRecuperation: maintenant,
              }
            : champIndisponible("°C"),
      };
    }
    return resultat;
  } catch (err) {
    console.error("Impossible de contacter /api/meteo:", err);
    return {};
  }
}
