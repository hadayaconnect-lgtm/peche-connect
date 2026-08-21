// Lecture des données satellite réelles depuis Supabase (alimentées par
// scripts/fetch_copernicus.py via GitHub Actions).
//
// RÈGLE STRICTE (étape 2B) : si une donnée est absente ou périmée pour une
// zone, cette fonction NE DOIT JAMAIS la remplacer par une valeur simulée.
// Elle retourne statut="indisponible" et laisse l'appelant (scoring.ts)
// décider explicitement de ne pas calculer de score plutôt que d'inventer
// une valeur.

import { ChampDonnee } from "./types";

export interface LigneSatelliteReelle {
  zone_id: string;
  temperature_surface: number;
  chlorophylle: number;
  gradient_thermique: number;
  gradient_chlorophylle: number | null;
  score_satellite: number;
  date_reference: string;
  source: string;
  updated_at: string;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Au-delà de ce seuil, une donnée Copernicus est considérée périmée (le job
// GitHub Actions tourne une fois par jour ; 36h laisse une marge en cas de
// run manqué une nuit).
export const FRAICHEUR_MAX_HEURES = 36;

export function supabaseConfigure(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export interface DonneesReellesZone {
  temperatureSurface: ChampDonnee<number>;
  chlorophylle: ChampDonnee<number>;
  gradientThermique: ChampDonnee<number>;
  gradientChlorophylle: ChampDonnee<number>;
}

function champIndisponible<T>(unite: string): ChampDonnee<T> {
  return {
    valeur: null,
    statut: "indisponible",
    unite,
    source: "Copernicus Marine Service",
    dateObservation: null,
    dateRecuperation: null,
  };
}

/**
 * Retourne, pour CHAQUE zone demandée, un statut explicite (reel ou
 * indisponible — jamais simule pour SST/chlorophylle). Aucune zone n'est
 * omise du résultat : celles sans donnée fraîche apparaissent avec des
 * champs "indisponible" plutôt que d'être silencieusement absentes.
 */
export async function recupererDonneesSatelliteReelles(
  idsZones: string[]
): Promise<Record<string, DonneesReellesZone>> {
  const resultat: Record<string, DonneesReellesZone> = {};
  for (const id of idsZones) {
    resultat[id] = {
      temperatureSurface: champIndisponible("°C"),
      chlorophylle: champIndisponible("mg/m³"),
      gradientThermique: champIndisponible(""),
      gradientChlorophylle: champIndisponible(""),
    };
  }

  if (!supabaseConfigure()) {
    return resultat; // Supabase non configuré : tout reste "indisponible", pas de simulation de repli
  }

  try {
    const reponse = await fetch(`${SUPABASE_URL}/rest/v1/zones_satellite?select=*`, {
      headers: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: "no-store", // toujours revalider : donnée quotidienne, pas de cache Next.js périmé
    });

    if (!reponse.ok) {
      console.error("Erreur lecture Supabase zones_satellite:", await reponse.text());
      return resultat; // échec réseau/API → tout reste "indisponible", jamais de simulation silencieuse
    }

    const lignes: LigneSatelliteReelle[] = await reponse.json();
    const maintenant = Date.now();

    for (const ligne of lignes) {
      if (!(ligne.zone_id in resultat)) continue; // zone inconnue de la liste demandée, ignorée
      const ageHeures = (maintenant - new Date(ligne.updated_at).getTime()) / 3_600_000;
      const fraiche = ageHeures <= FRAICHEUR_MAX_HEURES;

      if (!fraiche) continue; // reste "indisponible" (donnée trop ancienne), PAS de repli simulé

      resultat[ligne.zone_id] = {
        temperatureSurface: {
          valeur: ligne.temperature_surface,
          statut: "reel",
          unite: "°C",
          source: "Copernicus Marine Service",
          dateObservation: ligne.date_reference,
          dateRecuperation: ligne.updated_at,
        },
        chlorophylle: {
          valeur: ligne.chlorophylle,
          statut: "reel",
          unite: "mg/m³",
          source: "Copernicus Marine Service",
          dateObservation: ligne.date_reference,
          dateRecuperation: ligne.updated_at,
        },
        gradientThermique: {
          valeur: ligne.gradient_thermique,
          statut: "reel",
          unite: "",
          source: "Copernicus Marine Service (dérivé de la SST)",
          dateObservation: ligne.date_reference,
          dateRecuperation: ligne.updated_at,
        },
        gradientChlorophylle:
          ligne.gradient_chlorophylle !== null && ligne.gradient_chlorophylle !== undefined
            ? {
                valeur: ligne.gradient_chlorophylle,
                statut: "reel",
                unite: "",
                source: "Copernicus Marine Service (dérivé de la chlorophylle)",
                dateObservation: ligne.date_reference,
                dateRecuperation: ligne.updated_at,
              }
            : champIndisponible(""),
      };
    }

    return resultat;
  } catch (err) {
    console.error("Impossible de contacter Supabase — données marquées indisponibles:", err);
    return resultat; // aucune exception ne doit faire retomber sur une simulation silencieuse
  }
}
