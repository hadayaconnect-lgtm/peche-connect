import { ChampDonnee } from "./types";

/**
 * Génération du vent/hauteur de vague — TOUJOURS simulée à ce stade.
 * L'intégration d'une source réelle (Open-Meteo Marine, ou produit vent
 * Copernicus) est explicitement hors périmètre de cette étape (voir
 * instructions "Ne pas toucher au vent réel/vagues réelles"). Chaque champ
 * est marqué statut="simule" avec sa source, pour ne jamais être confondu
 * avec une observation réelle dans l'interface (transparence, section 12).
 */

function bruitPseudoAleatoire(lat: number, lon: number, jourAnnee: number, decalage = 0): number {
  const x = Math.sin(lat * 12.9898 + lon * 78.233 + jourAnnee * 0.017 + decalage) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

function jourDeLAnnee(date: Date): number {
  const debut = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - debut.getTime();
  return Math.floor(diff / 86400000);
}

const SOURCE_SIMULATION = "Simulation interne (vent/vagues — source réelle non encore intégrée)";

export interface VentVagueSimules {
  hauteurVague: ChampDonnee<number>;
  vitesseVent: ChampDonnee<number>;
  directionVent: ChampDonnee<string>;
  vitesseCourant: ChampDonnee<number>;
  directionCourant: ChampDonnee<string>;
}

export function genererVentVagueSimules(lat: number, lon: number, date: Date = new Date()): VentVagueSimules {
  const jour = jourDeLAnnee(date);
  const iso = date.toISOString();

  const hauteurVagueValeur = Math.round((0.4 + bruitPseudoAleatoire(lat, lon, jour, 3) * 1.3) * 10) / 10;
  const vitesseVentValeur = Math.round(8 + bruitPseudoAleatoire(lat, lon, jour, 4) * 22);
  const vitesseCourantValeur = Math.round((0.5 + bruitPseudoAleatoire(lat, lon, jour, 6) * 2.5) * 10) / 10;
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const directionVentValeur = directions[Math.floor(bruitPseudoAleatoire(lat, lon, jour, 5) * directions.length)];
  const directionCourantValeur = directions[Math.floor(bruitPseudoAleatoire(lat, lon, jour, 7) * directions.length)];

  return {
    hauteurVague: {
      valeur: hauteurVagueValeur,
      statut: "simule",
      unite: "m",
      source: SOURCE_SIMULATION,
      dateObservation: iso,
      dateRecuperation: iso,
    },
    vitesseVent: {
      valeur: vitesseVentValeur,
      statut: "simule",
      unite: "km/h",
      source: SOURCE_SIMULATION,
      dateObservation: iso,
      dateRecuperation: iso,
    },
    directionVent: {
      valeur: directionVentValeur,
      statut: "simule",
      unite: "",
      source: SOURCE_SIMULATION,
      dateObservation: iso,
      dateRecuperation: iso,
    },
    vitesseCourant: {
      valeur: vitesseCourantValeur,
      statut: "simule",
      unite: "km/h",
      source: SOURCE_SIMULATION,
      dateObservation: iso,
      dateRecuperation: iso,
    },
    directionCourant: {
      valeur: directionCourantValeur,
      statut: "simule",
      unite: "",
      source: SOURCE_SIMULATION,
      dateObservation: iso,
      dateRecuperation: iso,
    },
  };
}

/**
 * APERÇU DÉMONSTRATION UNIQUEMENT — non utilisé par le calcul de score réel
 * (lib/peche/scoring.ts::genererZonesAvecScore n'appelle jamais cette
 * fonction pour la température/chlorophylle). Conservée uniquement pour
 * référence/tests locaux sans connexion Supabase.
 */
export function genererApercuDemonstrationSST(lat: number, lon: number, date: Date = new Date()): number {
  const jour = jourDeLAnnee(date);
  const cycleSaisonnier = Math.sin(((jour - 60) / 365) * 2 * Math.PI);
  const sstBase = 28.5 + cycleSaisonnier * 2.2;
  const sstBruit = (bruitPseudoAleatoire(lat, lon, jour, 1) - 0.5) * 1.6;
  return Math.round((sstBase + sstBruit) * 10) / 10;
}
