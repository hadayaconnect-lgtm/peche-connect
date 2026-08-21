// Zones de référence — littoral d'Érythrée, Djibouti et Somalie (Golfe de
// Tadjoura, mer Rouge sud, Golfe d'Aden, océan Indien nord-ouest).
// Source unique de vérité : /data/zones.json (partagée avec
// scripts/fetch_copernicus.py pour que l'app et le script de récupération
// satellite pointent toujours vers les mêmes coordonnées).

import donnees from "@/data/zones.json";

export interface ZoneReference {
  id: string;
  nom: string;
  lat: number;
  lon: number;
  rayonKm: number;
}

export interface PortReference {
  id: string;
  nom: string;
  lat: number;
  lon: number;
}

export const ZONES_REFERENCE: ZoneReference[] = donnees.zones;
export const PORTS_REFERENCE: PortReference[] = donnees.ports;
