import { NextResponse } from "next/server";
import donneesZones from "@/data/zones.json";

// Open Topo Data (https://www.opentopodata.org) — API REST publique,
// gratuite, sans clé, servant le jeu de données bathymétrique GEBCO 2020.
// La profondeur des océans ne change pas dans le temps (à l'échelle de
// cette app) : cache long (30 jours) plutôt que ré-interrogé à chaque
// visite, contrairement au vent/vagues qui eux varient en continu.
//
// L'API publique limite généralement les requêtes à ~100 points par appel
// — on découpe donc en lots si le nombre de zones dépasse ce seuil, pour
// rester robuste si de nouvelles zones sont ajoutées plus tard.

export const revalidate = 2592000; // 30 jours
export const dynamic = "force-dynamic";

interface ResultatGebco {
  elevation: number | null;
  location: { lat: number; lng: number };
}

const TAILLE_LOT = 90;

export async function GET() {
  const zones = donneesZones.zones;
  const resultat: Record<string, { profondeurM: number | null }> = {};
  for (const z of zones) resultat[z.id] = { profondeurM: null };

  try {
    for (let i = 0; i < zones.length; i += TAILLE_LOT) {
      const lot = zones.slice(i, i + TAILLE_LOT);
      const locations = lot.map((z) => `${z.lat},${z.lon}`).join("|");

      const reponse = await fetch(`https://api.opentopodata.org/v1/gebco2020?locations=${locations}`, {
        next: { revalidate: 2592000 },
      });

      if (!reponse.ok) {
        console.error("Open Topo Data (GEBCO) erreur:", await reponse.text());
        continue; // ce lot reste "indisponible", pas de repli inventé
      }

      const donnees = await reponse.json();
      const liste: ResultatGebco[] = donnees.results ?? [];
      liste.forEach((r, idx) => {
        const zone = lot[idx];
        if (!zone || r.elevation === null || r.elevation === undefined) return;
        // Élévation négative = sous le niveau de la mer. On exprime la
        // profondeur en mètres positifs ; une élévation positive (terre)
        // est ramenée à 0 (ne devrait pas arriver pour des zones en mer).
        resultat[zone.id].profondeurM = r.elevation < 0 ? Math.round(-r.elevation) : 0;
      });
    }
  } catch (err) {
    console.error("Open Topo Data injoignable:", err);
    // resultat reste avec des valeurs null — le client saura retomber sur
    // "indisponible", jamais sur une profondeur inventée.
  }

  return NextResponse.json(resultat);
}
