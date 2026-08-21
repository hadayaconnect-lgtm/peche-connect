// Lecture de la bathymétrie (profondeur) via la route serveur
// /api/bathymetrie (Open Topo Data / GEBCO). Donnée statique, mise en cache
// longuement côté serveur — ce module ne fait que la mettre en forme en
// ChampDonnee pour rester cohérent avec les autres sources.

import { ChampDonnee } from "./types";

interface LigneBathymetrieBrute {
  profondeurM: number | null;
}

function champIndisponible(): ChampDonnee<number> {
  return {
    valeur: null,
    statut: "indisponible",
    unite: "m",
    source: "Open Topo Data (GEBCO)",
    dateObservation: null,
    dateRecuperation: null,
  };
}

export async function recupererBathymetrie(): Promise<Record<string, ChampDonnee<number>>> {
  try {
    const reponse = await fetch("/api/bathymetrie", { cache: "no-store" });
    if (!reponse.ok) {
      console.error("Erreur route /api/bathymetrie:", await reponse.text());
      return {};
    }
    const lignes: Record<string, LigneBathymetrieBrute> = await reponse.json();
    const maintenant = new Date().toISOString();

    const resultat: Record<string, ChampDonnee<number>> = {};
    for (const [zoneId, ligne] of Object.entries(lignes)) {
      resultat[zoneId] =
        ligne.profondeurM !== null
          ? {
              valeur: ligne.profondeurM,
              statut: "reel",
              unite: "m",
              source: "Open Topo Data (GEBCO 2020)",
              dateObservation: null, // donnée statique, pas d'horodatage de mesure pertinent
              dateRecuperation: maintenant,
            }
          : champIndisponible();
    }
    return resultat;
  } catch (err) {
    console.error("Impossible de contacter /api/bathymetrie:", err);
    return {};
  }
}
