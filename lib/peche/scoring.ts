import { NiveauScore, NiveauConfiance, Signalement, ZonePeche, ChampDonnee } from "./types";
import { ZONES_REFERENCE, PORTS_REFERENCE } from "./zones-reference";
import { genererVentVagueSimules } from "./satellite";
import { getSignalements } from "./db";
import { recupererDonneesSatelliteReelles, FRAICHEUR_MAX_HEURES } from "./supabase-satellite";
import { recupererMeteoTempsReel, type MeteoTempsReelZone } from "./openmeteo-client";
import { recupererBathymetrie } from "./bathymetrie-client";
import { recupererChlorophylleRelais } from "./chlorophylle-relais-client";

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** Trouve le port de référence le plus proche d'une zone, parmi la liste
 * couvrant Érythrée, Djibouti et Somalie. */
function portLePlusProche(lat: number, lon: number): { nom: string; distanceKm: number } {
  let meilleur = { nom: PORTS_REFERENCE[0].nom, distanceKm: Infinity };
  for (const port of PORTS_REFERENCE) {
    const d = distanceKm(lat, lon, port.lat, port.lon);
    if (d < meilleur.distanceKm) meilleur = { nom: port.nom, distanceKm: d };
  }
  return meilleur;
}

// =============================================================================
// PONDÉRATION DU SCORE — moteur multi-paramètres
// =============================================================================
// Poids de chaque critère dans le calcul du "potentiel de pêche" (0-100).
// La somme des poids fait 1.0. Ces valeurs sont volontairement centralisées
// ici et documentées pour être facilement modifiables/retunées, par exemple
// une fois des données de comparaison recommandation ↔ captures réelles
// disponibles (voir signalements / score_au_moment, étape validation
// terrain). Seuls la température de surface et la chlorophylle sont
// obligatoires pour qu'un score soit calculé (données Copernicus fiables) ;
// les autres critères sont pris en compte quand ils sont disponibles, avec
// renormalisation des poids parmi les critères effectivement présents.
export const PONDERATION_SCORE = {
  sst: 0.15, // proximité à la plage de température jugée favorable
  gradientThermique: 0.2, // front thermique (zone de concentration probable)
  chlorophylle: 0.2, // richesse en nutriments / base de la chaîne alimentaire
  gradientChlorophylle: 0.15, // front chlorophyllien
  convergenceCourants: 0.15, // rencontre de masses d'eau de directions différentes
  bathymetrie: 0.15, // profondeur dans une fourchette favorable
} as const;

const SEUIL_FAVORABLE = 60; // score de composant au-delà duquel on affiche un ✓

// Plage de température jugée favorable pour la pêche pélagique dans le
// Golfe de Tadjoura / Golfe d'Aden — approximation à calibrer avec des
// données de captures réelles au fil du temps (voir validation terrain).
const SST_OPTIMALE_MIN = 26;
const SST_OPTIMALE_MAX = 29;

// Plage de profondeur jugée favorable (plateau/tombant continental) —
// également approximative, à affiner par zone/espèce avec le temps.
const PROFONDEUR_OPTIMALE_MIN = 20;
const PROFONDEUR_OPTIMALE_MAX = 200;

function scoreDepuisSST(tempC: number): number {
  if (tempC >= SST_OPTIMALE_MIN && tempC <= SST_OPTIMALE_MAX) return 100;
  const ecart = tempC < SST_OPTIMALE_MIN ? SST_OPTIMALE_MIN - tempC : tempC - SST_OPTIMALE_MAX;
  return Math.max(0, 100 - ecart * 25);
}

function scoreDepuisBathymetrie(profondeurM: number): number {
  if (profondeurM >= PROFONDEUR_OPTIMALE_MIN && profondeurM <= PROFONDEUR_OPTIMALE_MAX) return 100;
  if (profondeurM < PROFONDEUR_OPTIMALE_MIN) return Math.max(0, (profondeurM / PROFONDEUR_OPTIMALE_MIN) * 100);
  const exces = profondeurM - PROFONDEUR_OPTIMALE_MAX;
  return Math.max(0, 100 - exces / 20);
}

interface ComposantesDisponibles {
  sst?: number;
  gradientThermique: number; // requis
  chlorophylle: number; // requis
  gradientChlorophylle?: number;
  convergence?: number; // déjà 0-100
  bathymetrie?: number;
}

/**
 * Calcule le potentiel de pêche (0-100) en combinant tous les critères
 * disponibles, pondérés selon PONDERATION_SCORE (renormalisé parmi les
 * critères présents). Produit aussi la liste des raisons en langage clair,
 * avec ✓ pour les critères favorables — jamais présenté comme une
 * probabilité de présence de poisson, toujours comme un "potentiel".
 */
function calculerPotentielPeche(
  composantes: ComposantesDisponibles,
  signalementsZone: Signalement[]
): { score: number; raisons: string[] } {
  const parts: { poids: number; score: number; texteFavorable: string; texteDefavorable: string }[] = [];

  parts.push({
    poids: PONDERATION_SCORE.gradientThermique,
    score: Math.min(100, composantes.gradientThermique * 100),
    texteFavorable: `Front thermique détecté (${Math.round(composantes.gradientThermique * 100)}%) ✓`,
    texteDefavorable: "Pas de front thermique marqué actuellement",
  });

  parts.push({
    poids: PONDERATION_SCORE.chlorophylle,
    score: Math.min(100, (composantes.chlorophylle / 1.8) * 100),
    texteFavorable: `Chlorophylle favorable (${composantes.chlorophylle.toFixed(2)} mg/m³) ✓`,
    texteDefavorable: `Chlorophylle faible (${composantes.chlorophylle.toFixed(2)} mg/m³)`,
  });

  if (composantes.sst !== undefined) {
    parts.push({
      poids: PONDERATION_SCORE.sst,
      score: scoreDepuisSST(composantes.sst),
      texteFavorable: `Température favorable (${composantes.sst.toFixed(1)}°C) ✓`,
      texteDefavorable: `Température hors plage optimale (${composantes.sst.toFixed(1)}°C)`,
    });
  }

  if (composantes.gradientChlorophylle !== undefined) {
    parts.push({
      poids: PONDERATION_SCORE.gradientChlorophylle,
      score: Math.min(100, composantes.gradientChlorophylle * 100),
      texteFavorable: `Front chlorophyllien détecté (${Math.round(composantes.gradientChlorophylle * 100)}%) ✓`,
      texteDefavorable: "Pas de front chlorophyllien marqué",
    });
  }

  if (composantes.convergence !== undefined) {
    parts.push({
      poids: PONDERATION_SCORE.convergenceCourants,
      score: composantes.convergence,
      texteFavorable: `Convergence de courants détectée (${Math.round(composantes.convergence)}%) ✓`,
      texteDefavorable: "Pas de convergence de courants marquée",
    });
  }

  if (composantes.bathymetrie !== undefined) {
    parts.push({
      poids: PONDERATION_SCORE.bathymetrie,
      score: scoreDepuisBathymetrie(composantes.bathymetrie),
      texteFavorable: `Profondeur favorable (${Math.round(composantes.bathymetrie)} m) ✓`,
      texteDefavorable: `Profondeur hors plage habituelle (${Math.round(composantes.bathymetrie)} m)`,
    });
  }

  const poidsTotal = parts.reduce((acc, p) => acc + p.poids, 0);
  const scoreBase = parts.reduce((acc, p) => acc + p.score * p.poids, 0) / poidsTotal;

  const raisons = parts.map((p) => (p.score >= SEUIL_FAVORABLE ? p.texteFavorable : p.texteDefavorable));

  // Signature possible de remontée d'eau (upwelling) : front thermique ET
  // chlorophylle élevée simultanément — combinaison classique.
  if (composantes.gradientThermique >= 0.4 && composantes.chlorophylle >= 1.0) {
    raisons.push("Signature possible de remontée d'eau (upwelling)");
  }

  let scoreFinal = scoreBase;
  const recents = signalementsZone.slice(-10);
  if (recents.length > 0) {
    const poids = { beaucoup: 100, peu: 50, rien: 10 } as const;
    const scoreFeedback = recents.reduce((acc, s) => acc + poids[s.type], 0) / recents.length;
    scoreFinal = scoreBase * 0.7 + scoreFeedback * 0.3;
    raisons.push(`${recents.length} signalement(s) pêcheur récent(s) pris en compte`);
  }

  return { score: Math.round(Math.min(100, Math.max(0, scoreFinal))), raisons };
}

/**
 * Niveau de confiance (étape 2D, enrichi) — heuristique documentée :
 * - "eleve"  : donnée Copernicus (temp ET chlorophylle, sources
 *              principales) < 12h ET (≥3 signalements terrain OU ≥2
 *              critères complémentaires réels en plus du socle)
 * - "moyen"  : donnée principale < 24h, OU un seul des deux relais
 *              (température ou chlorophylle) utilisé
 * - "faible" : donnée proche de l'expiration (24-36h), OU les deux relais
 *              utilisés simultanément (aucune source principale
 *              Copernicus disponible) — la confiance est explicitement
 *              réduite quand on s'appuie sur des sources de secours.
 */
function calculerNiveauConfiance(
  ageHeuresDonnee: number,
  nbSignalements: number,
  nbCriteresComplementairesReels: number,
  nbRelaisUtilises: number
): NiveauConfiance {
  if (nbRelaisUtilises >= 2) return "faible";
  if (nbRelaisUtilises === 1) return ageHeuresDonnee <= 24 ? "moyen" : "faible";
  if (ageHeuresDonnee <= 12 && (nbSignalements >= 3 || nbCriteresComplementairesReels >= 2)) return "eleve";
  if (ageHeuresDonnee <= 24) return "moyen";
  return "faible";
}

/** Sécurité en mer — utilise le vent/vagues réels (Open-Meteo) quand
 * disponibles, avec repli transparent sur simulation champ par champ sinon. */
export function niveauDepuisConditions(hauteurVagueM: number, vitesseVentKmh: number, score: number | null): NiveauScore {
  if (hauteurVagueM >= 2.2 || vitesseVentKmh >= 35) return "danger";
  if (score === null) return "moyen";
  if (score >= 65) return "favorable";
  if (score >= 40) return "moyen";
  return "deconseille";
}

/** Choisit la valeur réelle si disponible, sinon retombe sur la simulation
 * en la marquant explicitement "simule" — jamais de repli silencieux. */
function champAvecRepli<T>(reel: ChampDonnee<T> | undefined, simule: ChampDonnee<T>): ChampDonnee<T> {
  if (reel && reel.statut === "reel") return reel;
  return simule;
}

const DIRECTIONS_COMPAS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
function angleDepuisCompas(compas: string): number {
  return DIRECTIONS_COMPAS.indexOf(compas) * 45;
}

function champIndisponibleGenerique<T>(unite: string, source: string): ChampDonnee<T> {
  return {
    valeur: null,
    statut: "indisponible",
    unite,
    source,
    dateObservation: null,
    dateRecuperation: null,
  };
}

function champConvergenceIndisponible(): ChampDonnee<number> {
  return champIndisponibleGenerique<number>("", "Calculé à partir des courants réels (Open-Meteo, zones voisines)");
}

/**
 * Indice de convergence des courants (0-100) — calculé, PAS mesuré
 * directement : compare la direction du courant réel de chaque zone à
 * celle de ses zones voisines (≤100km). Un écart angulaire moyen élevé
 * (courants de directions opposées/divergentes qui se rencontrent) est
 * interprété comme un indice de convergence plus fort. N'utilise QUE des
 * courants réels Open-Meteo (jamais de valeurs simulées en entrée) — reste
 * "indisponible" si moins de 2 zones voisines ont un courant réel.
 */
function calculerIndiceConvergence(
  points: { id: string; lat: number; lon: number; directionCourant: ChampDonnee<string> }[]
): Record<string, ChampDonnee<number>> {
  const resultat: Record<string, ChampDonnee<number>> = {};
  const maintenant = new Date().toISOString();

  for (const zone of points) {
    if (zone.directionCourant.statut !== "reel" || zone.directionCourant.valeur === null) {
      resultat[zone.id] = champConvergenceIndisponible();
      continue;
    }
    const voisines = points.filter(
      (v) =>
        v.id !== zone.id &&
        v.directionCourant.statut === "reel" &&
        v.directionCourant.valeur !== null &&
        distanceKm(zone.lat, zone.lon, v.lat, v.lon) <= 100
    );
    if (voisines.length < 2) {
      resultat[zone.id] = champConvergenceIndisponible();
      continue;
    }
    const angleZone = angleDepuisCompas(zone.directionCourant.valeur);
    const ecarts = voisines.map((v) => {
      const diff = Math.abs(angleZone - angleDepuisCompas(v.directionCourant.valeur as string));
      return Math.min(diff, 360 - diff);
    });
    const ecartMoyen = ecarts.reduce((a, b) => a + b, 0) / ecarts.length;
    const indice = Math.round(Math.min(100, (ecartMoyen / 180) * 100));

    resultat[zone.id] = {
      valeur: indice,
      statut: "reel",
      unite: "",
      source: "Calculé à partir des courants réels (Open-Meteo, zones voisines)",
      dateObservation: maintenant,
      dateRecuperation: maintenant,
    };
  }

  return resultat;
}

const SOURCE_GRADIENT_RELAIS = "Calculé à partir du relais Open-Meteo (zones voisines)";

/**
 * Gradient thermique de RELAIS — même principe que le gradient calculé côté
 * script Copernicus (écart moyen avec les zones voisines, normalisé), mais
 * appliqué à la température de relais Open-Meteo. Utilisé uniquement en
 * secours quand le gradient Copernicus (dérivé de la grille satellite
 * quotidienne) est indisponible ET que la température de relais l'est
 * réellement — jamais de valeur inventée.
 */
function calculerGradientDepuisPoints(
  points: { id: string; lat: number; lon: number; valeur: number | null }[],
  rayonKm = 100
): Record<string, ChampDonnee<number>> {
  const resultat: Record<string, ChampDonnee<number>> = {};
  const maintenant = new Date().toISOString();

  for (const p of points) {
    if (p.valeur === null) {
      resultat[p.id] = champIndisponibleGenerique<number>("", SOURCE_GRADIENT_RELAIS);
      continue;
    }
    const voisins = points.filter(
      (v) => v.id !== p.id && v.valeur !== null && distanceKm(p.lat, p.lon, v.lat, v.lon) <= rayonKm
    );
    if (voisins.length < 2) {
      resultat[p.id] = champIndisponibleGenerique<number>("", SOURCE_GRADIENT_RELAIS);
      continue;
    }
    const ecarts = voisins.map((v) => Math.abs((v.valeur as number) - (p.valeur as number)));
    const ecartMoyen = ecarts.reduce((a, b) => a + b, 0) / ecarts.length;
    const gradient = Math.min(1, ecartMoyen / 1.5); // même normalisation que scripts/fetch_copernicus.py

    resultat[p.id] = {
      valeur: Math.round(gradient * 1000) / 1000,
      statut: "reel",
      unite: "",
      source: SOURCE_GRADIENT_RELAIS,
      dateObservation: maintenant,
      dateRecuperation: maintenant,
    };
  }

  return resultat;
}

export async function genererZonesAvecScore(date: Date = new Date()): Promise<ZonePeche[]> {
  const idsZones = ZONES_REFERENCE.map((z) => z.id);
  const [donneesReelles, signalements, meteoReelle, bathymetrieReelle] = await Promise.all([
    recupererDonneesSatelliteReelles(idsZones),
    getSignalements(),
    recupererMeteoTempsReel(),
    recupererBathymetrie(),
  ]);

  // Le relais NOAA CoastWatch n'est interrogé QUE pour les zones où
  // Copernicus a déjà échoué — jamais systématiquement pour les 38 zones
  // (leur serveur limite explicitement à une requête à la fois, mieux vaut
  // limiter le nombre total de requêtes envoyées).
  const idsNecessitantRelaisChlorophylle = idsZones.filter((id) => donneesReelles[id]?.chlorophylle.statut !== "reel");
  const chlorophylleRelais = await recupererChlorophylleRelais(idsNecessitantRelaisChlorophylle);

  // Convergence calculée à partir des courants réels UNIQUEMENT (avant tout
  // repli simulé), sur l'ensemble des zones en une seule passe.
  const pointsCourants: { id: string; lat: number; lon: number; directionCourant: ChampDonnee<string> }[] =
    ZONES_REFERENCE.map((ref) => ({
      id: ref.id,
      lat: ref.lat,
      lon: ref.lon,
      directionCourant: (meteoReelle[ref.id]?.directionCourant ??
        champIndisponibleGenerique<string>(
          "",
          "Open-Meteo (modèle météo horaire)"
        )) as ChampDonnee<string>,
    }));
  const convergenceParZone = calculerIndiceConvergence(pointsCourants);

  // Gradient de RELAIS (voir calculerGradientDepuisPoints) — calculé à
  // partir de la température de relais Open-Meteo, disponible pour les
  // zones qui n'ont pas encore de données de relais réelles.
  const pointsTemperatureRelais = ZONES_REFERENCE.map((ref) => ({
    id: ref.id,
    lat: ref.lat,
    lon: ref.lon,
    valeur:
      meteoReelle[ref.id]?.temperatureSurfaceRelais.statut === "reel"
        ? meteoReelle[ref.id]!.temperatureSurfaceRelais.valeur
        : null,
  }));
  const gradientRelaisParZone = calculerGradientDepuisPoints(pointsTemperatureRelais);

  // Gradient chlorophyllien de RELAIS — même principe, appliqué à la
  // chlorophylle NOAA CoastWatch (utilisé en secours si Copernicus a aussi
  // échoué pour le gradient chlorophyllien de cette zone).
  const pointsChlorophylleRelais = ZONES_REFERENCE.map((ref) => ({
    id: ref.id,
    lat: ref.lat,
    lon: ref.lon,
    valeur: chlorophylleRelais[ref.id]?.statut === "reel" ? chlorophylleRelais[ref.id].valeur : null,
  }));
  const gradientChlorophylleRelaisParZone = calculerGradientDepuisPoints(pointsChlorophylleRelais);

  const zones: ZonePeche[] = ZONES_REFERENCE.map((ref) => {
    const reel = donneesReelles[ref.id];
    const meteoZone: MeteoTempsReelZone | undefined = meteoReelle[ref.id];
    const simulationRepli = genererVentVagueSimules(ref.lat, ref.lon, date);
    const bathymetrie = bathymetrieReelle[ref.id] ?? {
      valeur: null,
      statut: "indisponible" as const,
      unite: "m",
      source: "Open Topo Data (GEBCO)",
      dateObservation: null,
      dateRecuperation: null,
    };
    const convergence = convergenceParZone[ref.id];

    // RELAIS TEMPÉRATURE (étape "prise de relais") : Copernicus reste
    // prioritaire quand frais. S'il est indisponible pour cette zone
    // aujourd'hui, on utilise la température de relais Open-Meteo (source
    // distincte, jamais confondue avec Copernicus dans l'étiquetage), et le
    // gradient thermique de relais calculé à partir des zones voisines.
    let temperatureFinale = reel.temperatureSurface;
    let gradientFinale = reel.gradientThermique;
    let relaisUtilise = false;

    if (temperatureFinale.statut !== "reel" && meteoZone?.temperatureSurfaceRelais.statut === "reel") {
      temperatureFinale = meteoZone.temperatureSurfaceRelais;
      relaisUtilise = true;
    }
    if (gradientFinale.statut !== "reel" && relaisUtilise) {
      gradientFinale = gradientRelaisParZone[ref.id];
    }

    // RELAIS CHLOROPHYLLE (cascade Copernicus → NOAA CoastWatch VIIRS) :
    // même principe que le relais température ci-dessus.
    let chlorophylleFinale = reel.chlorophylle;
    let gradientChlorophylleFinale = reel.gradientChlorophylle;
    let relaisChlorophylleUtilise = false;

    if (chlorophylleFinale.statut !== "reel" && chlorophylleRelais[ref.id]?.statut === "reel") {
      chlorophylleFinale = chlorophylleRelais[ref.id];
      relaisChlorophylleUtilise = true;
    }
    if (gradientChlorophylleFinale.statut !== "reel" && relaisChlorophylleUtilise) {
      gradientChlorophylleFinale = gradientChlorophylleRelaisParZone[ref.id];
    }

    const hauteurVague = champAvecRepli(meteoZone?.hauteurVague, simulationRepli.hauteurVague);
    const vitesseVent = champAvecRepli(meteoZone?.vitesseVent, simulationRepli.vitesseVent);
    const directionVent = champAvecRepli(meteoZone?.directionVent, simulationRepli.directionVent);
    const vitesseCourant = champAvecRepli(meteoZone?.vitesseCourant, simulationRepli.vitesseCourant);
    const directionCourant = champAvecRepli(meteoZone?.directionCourant, simulationRepli.directionCourant);
    const meteoEstimee = hauteurVague.statut !== "reel" || vitesseVent.statut !== "reel";

    const portProche = portLePlusProche(ref.lat, ref.lon);
    const signalementsZone = signalements.filter((s) => s.zoneId === ref.id);

    const donneesReellesDisponibles =
      reel.temperatureSurface.statut === "reel" && reel.chlorophylle.statut === "reel";

    // Le score, lui, peut se calculer via les relais (température +
    // chlorophylle) même si Copernicus est temporairement indisponible pour
    // cette zone — c'est justement le but du relais.
    const donneesSuffisantesPourScore =
      temperatureFinale.statut === "reel" && chlorophylleFinale.statut === "reel" && gradientFinale.statut === "reel";

    let score: number | null = null;
    let raisons: string[] = [];
    let niveauConfiance: NiveauConfiance | null = null;

    if (
      donneesSuffisantesPourScore &&
      temperatureFinale.valeur !== null &&
      chlorophylleFinale.valeur !== null &&
      gradientFinale.valeur !== null
    ) {
      const composantes: ComposantesDisponibles = {
        sst: temperatureFinale.valeur,
        gradientThermique: gradientFinale.valeur,
        chlorophylle: chlorophylleFinale.valeur,
        gradientChlorophylle:
          gradientChlorophylleFinale.statut === "reel" && gradientChlorophylleFinale.valeur !== null
            ? gradientChlorophylleFinale.valeur
            : undefined,
        convergence: convergence.statut === "reel" && convergence.valeur !== null ? convergence.valeur : undefined,
        bathymetrie: bathymetrie.statut === "reel" && bathymetrie.valeur !== null ? bathymetrie.valeur : undefined,
      };

      const resultat = calculerPotentielPeche(composantes, signalementsZone);
      score = resultat.score;
      raisons = resultat.raisons;

      const ageHeures = temperatureFinale.dateRecuperation
        ? (Date.now() - new Date(temperatureFinale.dateRecuperation).getTime()) / 3_600_000
        : FRAICHEUR_MAX_HEURES;

      const nbCriteresComplementairesReels = [
        gradientChlorophylleFinale.statut === "reel",
        convergence.statut === "reel",
        bathymetrie.statut === "reel",
      ].filter(Boolean).length;

      const nbRelaisUtilises = [relaisUtilise, relaisChlorophylleUtilise].filter(Boolean).length;

      niveauConfiance = calculerNiveauConfiance(
        ageHeures,
        signalementsZone.length,
        nbCriteresComplementairesReels,
        nbRelaisUtilises
      );

      if (relaisUtilise) {
        raisons.push(
          `Température de relais Open-Meteo utilisée (Copernicus indisponible aujourd'hui pour cette zone), mise à jour il y a ${Math.round(ageHeures)} h`
        );
      } else {
        raisons.push(`Donnée Copernicus (température) mise à jour il y a ${Math.round(ageHeures)} h`);
      }

      if (relaisChlorophylleUtilise) {
        raisons.push("Chlorophylle de relais NOAA CoastWatch VIIRS utilisée (Copernicus indisponible aujourd'hui pour cette zone)");
      }
    } else {
      raisons = [
        "Données Copernicus et relais (Open-Meteo, NOAA CoastWatch VIIRS) indisponibles ou trop anciennes pour cette zone — aucun score calculé.",
      ];
    }

    const niveau = niveauDepuisConditions(hauteurVague.valeur ?? 0, vitesseVent.valeur ?? 0, score);

    return {
      id: ref.id,
      nom: ref.nom,
      coordonnees: { lat: ref.lat, lon: ref.lon },
      rayonKm: ref.rayonKm,
      distancePortKm: portProche.distanceKm,
      portReferenceNom: portProche.nom,
      satellite: {
        temperatureSurface: temperatureFinale,
        chlorophylle: chlorophylleFinale,
        hauteurVague,
        vitesseVent,
        directionVent,
        vitesseCourant,
        directionCourant,
        gradientChlorophylle: gradientChlorophylleFinale,
        bathymetrie,
        indiceConvergence: convergence,
      },
      score,
      niveauConfiance,
      raisons,
      gradientThermique: gradientFinale,
      niveau,
      estimeParSimulation: meteoEstimee,
      donneesReellesDisponibles,
    };
  });

  return zones.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
