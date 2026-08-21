// Lecture de la chlorophylle de relais (NOAA CoastWatch VIIRS) via la
// route serveur /api/chlorophylle-relais. Utilisée uniquement en secours
// par scoring.ts quand Copernicus est indisponible pour une zone — jamais
// mélangée silencieusement, toujours étiquetée avec sa propre source.

import { ChampDonnee } from "./types";

interface LigneChlorophylleBrute {
  chlorophylleMgM3: number | null;
  dateObservation: string | null;
  sourceLibelle?: string;
}

function champIndisponible(): ChampDonnee<number> {
  return {
    valeur: null,
    statut: "indisponible",
    unite: "mg/m³",
    source: "NOAA CoastWatch VIIRS",
    dateObservation: null,
    dateRecuperation: null,
  };
}

export async function recupererChlorophylleRelais(idsZonesNecessaires: string[]): Promise<Record<string, ChampDonnee<number>>> {
  // Rien à interroger si aucune zone n'a besoin du relais — évite un appel
  // inutile au serveur NOAA (et respecte d'autant mieux leur limite de débit).
  if (idsZonesNecessaires.length === 0) return {};

  try {
    const parametre = encodeURIComponent(idsZonesNecessaires.join(","));
    const reponse = await fetch(`/api/chlorophylle-relais?zones=${parametre}`, { cache: "no-store" });
    if (!reponse.ok) {
      console.error("Erreur route /api/chlorophylle-relais:", await reponse.text());
      return {};
    }
    const lignes: Record<string, LigneChlorophylleBrute> = await reponse.json();
    const maintenant = new Date().toISOString();

    const resultat: Record<string, ChampDonnee<number>> = {};
    for (const [zoneId, ligne] of Object.entries(lignes)) {
      resultat[zoneId] =
        ligne.chlorophylleMgM3 !== null
          ? {
              valeur: Math.round(ligne.chlorophylleMgM3 * 100) / 100,
              statut: "reel",
              unite: "mg/m³",
              source: ligne.sourceLibelle ?? "NOAA CoastWatch VIIRS (relais)",
              dateObservation: ligne.dateObservation,
              dateRecuperation: maintenant,
            }
          : champIndisponible();
    }
    return resultat;
  } catch (err) {
    console.error("Impossible de contacter /api/chlorophylle-relais:", err);
    return {};
  }
}
