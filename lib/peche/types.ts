// Types principaux de Pêche Connect

export interface Coordonnees {
  lat: number;
  lon: number;
}

/**
 * Statut de traçabilité d'une donnée individuelle — coeur de la
 * transparence de l'app (section 12 du cahier des charges) :
 * - "reel"         : mesure Copernicus Marine Service réelle et fraîche
 * - "simule"        : générée par le moteur de simulation interne (vent,
 *                     vagues — sources réelles non encore intégrées)
 * - "indisponible"  : aucune valeur fiable (donnée manquante ou périmée) ;
 *                     ne JAMAIS remplacer silencieusement par une simulation
 */
export type StatutDonnee = "reel" | "simule" | "indisponible";

export interface ChampDonnee<T> {
  valeur: T | null;
  statut: StatutDonnee;
  unite: string;
  source: string; // ex: "Copernicus Marine Service", "Simulation interne"
  dateObservation: string | null; // horodatage de la mesure elle-même (ISO)
  dateRecuperation: string | null; // horodatage de récupération/génération (ISO)
}

export interface DonneesSatellite {
  temperatureSurface: ChampDonnee<number>; // °C — SST
  chlorophylle: ChampDonnee<number>; // mg/m³ — chlorophylle-a
  hauteurVague: ChampDonnee<number>; // m
  vitesseVent: ChampDonnee<number>; // km/h
  directionVent: ChampDonnee<string>; // N, NE, E... (direction d'où vient le vent)
  vitesseCourant: ChampDonnee<number>; // km/h — résolution ~8km, peu fiable très près des côtes
  directionCourant: ChampDonnee<string>; // N, NE, E... (direction vers laquelle le courant se dirige)
  gradientChlorophylle: ChampDonnee<number>; // 0-1 — front chlorophyllien, dérivé de la chlorophylle Copernicus
  bathymetrie: ChampDonnee<number>; // m — profondeur (Open Topo Data / GEBCO), donnée statique
  indiceConvergence: ChampDonnee<number>; // 0-100 — calculé à partir des courants réels des zones voisines
}

export type NiveauScore = "favorable" | "moyen" | "deconseille" | "danger";
export type NiveauConfiance = "eleve" | "moyen" | "faible";

export interface ZonePeche {
  id: string;
  nom: string;
  coordonnees: Coordonnees;
  rayonKm: number;
  distancePortKm: number; // depuis le port de référence le plus proche
  portReferenceNom: string; // nom du port de référence utilisé pour la distance

  satellite: DonneesSatellite;

  // Potentiel de pêche — jamais "probabilité de présence de poisson".
  // null si les données réelles (SST + chlorophylle) sont insuffisantes :
  // on n'invente pas de score à partir de données simulées ou absentes.
  score: number | null;
  niveauConfiance: NiveauConfiance | null;
  raisons: string[]; // explication courte du score, en langage clair

  gradientThermique: ChampDonnee<number>; // proxy front thermique (0-1)

  // Sécurité en mer — calculée à partir du vent/vagues, qui restent
  // simulés (hors périmètre de cette étape). Toujours accompagnée de
  // "estimeParSimulation: true" pour ne jamais faire passer une alerte
  // simulée pour une observation réelle.
  niveau: NiveauScore;
  estimeParSimulation: boolean;

  /** true uniquement si SST ET chlorophylle sont toutes deux "reel" */
  donneesReellesDisponibles: boolean;
}

export type TypeSignalement = "beaucoup" | "peu" | "rien";

export interface Signalement {
  id: string;
  zoneId: string;
  type: TypeSignalement;
  especes?: string;
  date: string; // ISO
  auteur?: string;
  // Pour la validation terrain (section 10/2G) : le score affiché au
  // pêcheur au moment de son signalement, pour comparer plus tard
  // recommandation ↔ résultat réel.
  scoreAuMoment?: number | null;
}

export interface MessageAssistant {
  id: string;
  role: "user" | "assistant";
  content: string;
  date: string;
}

export interface AlerteSecurite {
  id: string;
  niveau: "info" | "attention" | "danger";
  message: string;
  zoneId?: string;
  date: string;
}
