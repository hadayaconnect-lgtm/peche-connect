import { NextResponse } from "next/server";
import donneesZones from "@/data/zones.json";

// Open-Meteo — API REST publique, gratuite, sans clé, avec CORS ouvert.
// Contrairement à Copernicus Marine (SST/chlorophylle, quotidien via script
// Python), le vent et les vagues sont ici récupérés en quasi temps réel
// (données horaires, généralement à jour à moins d'une heure près).
//
// COURANTS MARINS : résolution ~8km (0.08°). Open-Meteo précise
// explicitement que la précision est limitée en zone côtière et que ces
// données "ne remplacent pas un almanach nautique" — à traiter comme
// indicatif, jamais comme référence de navigation précise près du rivage.
//
// TEMPÉRATURE DE SURFACE (RELAIS) : Open-Meteo Marine intègre désormais des
// modèles issus notamment de Copernicus Marine, avec une fraîcheur horaire
// (contrairement au script Python quotidien, qui peut avoir un retard de
// publication de plusieurs jours). Utilisée en RELAIS uniquement quand la
// donnée Copernicus quotidienne est indisponible pour une zone — la source
// principale reste prioritaire quand elle est fraîche, jamais mélangée
// silencieusement avec ce relais (voir lib/peche/scoring.ts).
//
// Toutes les zones sont interrogées en UN SEUL appel par API (coordonnées
// séparées par des virgules), Open-Meteo retourne alors un tableau de
// résultats dans le même ordre que les coordonnées envoyées.

export const revalidate = 900; // recache toutes les 15 min côté Vercel
export const dynamic = "force-dynamic"; // jamais figé au build, toujours exécuté à la demande

interface ReponseMeteoCourante {
  current?: {
    time: string;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
}

interface ReponseMarineCourante {
  current?: {
    time: string;
    wave_height?: number;
    ocean_current_velocity?: number;
    ocean_current_direction?: number;
    sea_surface_temperature?: number;
  };
}

export async function GET() {
  const zones = donneesZones.zones;
  const lats = zones.map((z) => z.lat).join(",");
  const lons = zones.map((z) => z.lon).join(",");

  const resultat: Record<
    string,
    {
      vitesseVentKmh: number | null;
      directionVentDeg: number | null;
      hauteurVagueM: number | null;
      vitesseCourantKmh: number | null;
      directionCourantDeg: number | null;
      temperatureSurfaceRelaisC: number | null;
      heure: string | null;
    }
  > = {};
  for (const z of zones) {
    resultat[z.id] = {
      vitesseVentKmh: null,
      directionVentDeg: null,
      hauteurVagueM: null,
      vitesseCourantKmh: null,
      directionCourantDeg: null,
      temperatureSurfaceRelaisC: null,
      heure: null,
    };
  }

  try {
    const [reponseVent, reponseVague] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC&cell_selection=sea`,
        { next: { revalidate: 900 } }
      ),
      fetch(
        `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&current=wave_height,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&timezone=UTC&cell_selection=sea`,
        { next: { revalidate: 900 } }
      ),
    ]);

    if (reponseVent.ok) {
      const donnees = await reponseVent.json();
      const liste: ReponseMeteoCourante[] = Array.isArray(donnees) ? donnees : [donnees];
      liste.forEach((entree, i) => {
        const zone = zones[i];
        if (!zone || !entree.current) return;
        resultat[zone.id].vitesseVentKmh = entree.current.wind_speed_10m ?? null;
        resultat[zone.id].directionVentDeg = entree.current.wind_direction_10m ?? null;
        resultat[zone.id].heure = entree.current.time ?? null;
      });
    } else {
      console.error("Open-Meteo (vent) erreur:", await reponseVent.text());
    }

    if (reponseVague.ok) {
      const donnees = await reponseVague.json();
      const liste: ReponseMarineCourante[] = Array.isArray(donnees) ? donnees : [donnees];
      liste.forEach((entree, i) => {
        const zone = zones[i];
        if (!zone || !entree.current) return;
        resultat[zone.id].hauteurVagueM = entree.current.wave_height ?? null;
        resultat[zone.id].vitesseCourantKmh = entree.current.ocean_current_velocity ?? null;
        resultat[zone.id].directionCourantDeg = entree.current.ocean_current_direction ?? null;
        resultat[zone.id].temperatureSurfaceRelaisC = entree.current.sea_surface_temperature ?? null;
        if (!resultat[zone.id].heure) resultat[zone.id].heure = entree.current.time ?? null;
      });
    } else {
      console.error("Open-Meteo (marine) erreur:", await reponseVague.text());
    }
  } catch (err) {
    console.error("Open-Meteo injoignable:", err);
    // resultat reste avec des valeurs null pour toutes les zones — le
    // client saura retomber sur la simulation, champ par champ, sans
    // jamais faire croire que ces valeurs null sont réelles.
  }

  return NextResponse.json(resultat);
}
