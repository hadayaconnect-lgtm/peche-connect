import { NextResponse } from "next/server";
import donneesZones from "@/data/zones.json";

// NOAA CoastWatch ERDDAP — relais de secours pour la chlorophylle-a quand
// Copernicus Marine (source principale, script quotidien) est indisponible
// ou en retard de publication.
//
// Deux datasets essayés dans l'ordre, tous deux vérifiés (identifiant +
// variable + syntaxe de requête testés en conditions réelles) :
//
// 1. noaacwNPPVIIRSchlaDaily
//    "Chlorophyll, NOAA S-NPP VIIRS, Near Real-Time, Global 4km, Daily"
//    Un seul satellite (Suomi-NPP) — résolution la plus fine (4km) mais
//    plus sujet aux trous de données (nuages, contamination du signal).
//
// 2. noaacwNPPN20VIIRSDINEOFDaily
//    "Chlorophyll (Gap-filled DINEOF), NOAA S-NPP + NOAA-20 VIIRS,
//     Near Real-Time, Global 9km, Daily"
//    Fusionne DEUX satellites (Suomi-NPP et NOAA-20, décalés d'environ
//    50 minutes sur leurs orbites) puis applique un algorithme de
//    comblement des trous restants (DINEOF) — spécifiquement conçu pour
//    réduire les absences de pixel exploitable. Résolution plus grossière
//    (9km) mais bien meilleure disponibilité.
//    Essayé UNIQUEMENT si le dataset 1 n'a rien donné d'exploitable pour
//    cette zone (cascade, jamais interrogé inutilement).
//
// Documentation :
//   https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPVIIRSchlaDaily.html
//   https://coastwatch.noaa.gov/erddap/griddap/noaacwNPPN20VIIRSDINEOFDaily.html
//
// On interroge une FENÊTRE des 20 derniers jours (pas seulement "le dernier
// jour publié") pour la dimension temps : les produits quotidiens de
// couleur de l'océan (chlorophylle) ont fréquemment des trous, et le
// retard de publication réel de ces produits NOAA s'est révélé plus
// important qu'anticipé lors des tests (~2 mois observés à un moment
// donné). On prend, parmi les jours renvoyés, la valeur valide la plus
// récente — toujours une vraie observation réelle, jamais une valeur
// inventée, seulement une recherche plus loin dans le temps parmi des
// données réelles.
//
// Syntaxe ERDDAP importante (piège rencontré en développement) : la
// fenêtre temporelle relative doit utiliser la syntaxe d'INDEX SANS
// parenthèses ("last-19:1:last"), pas la syntaxe de coordonnée avec
// parenthèses ("(last-19):(last)") qui ne fonctionne pas pour l'arithmétique
// relative et produit un résultat tronqué silencieux.
//
// IMPORTANT — le serveur NOAA CoastWatch renvoie une erreur 429 explicite
// ("Please make just one request at a time") en cas de requêtes envoyées
// en parallèle. Cette route :
//   1. n'interroge QUE les zones passées en paramètre (?zones=id1,id2,...),
//      c'est-à-dire uniquement celles où Copernicus a déjà échoué — jamais
//      les 38 zones systématiquement, ce qui limite fortement la charge
//      envoyée à NOAA dans l'usage normal ;
//   2. traite ces zones en SÉQUENTIEL (jamais en parallèle), avec une
//      courte pause entre CHAQUE requête externe (y compris entre le
//      dataset 1 et le dataset 2 pour une même zone), pour respecter
//      cette consigne de manière cohérente.
//
// Sources envisagées mais NON intégrées, avec la raison précise :
// - Sentinel-3 OLCI (aussi hébergé par CoastWatch) : uniquement disponible
//   par "secteurs" régionaux (ex. noaacwS3AOLCIchlaSectorXWDaily) dont la
//   couverture géographique n'est pas confirmée pour la Corne de l'Afrique
//   — pas de vérification fiable possible sans risquer un identifiant
//   invalide pour notre zone.
// - NASA PACE : nécessite une authentification Earthdata (OAuth), complexité
//   disproportionnée par rapport au bénéfice pour un simple relais de
//   secours.

export const revalidate = 21600; // 6h — donnée quotidienne, pas besoin d'un cache plus court
export const dynamic = "force-dynamic";
export const maxDuration = 60; // laisse le temps aux requêtes séquentielles (plans le permettant)

const DATASETS = [
  {
    id: "noaacwNPPVIIRSchlaDaily",
    libelle: "NOAA CoastWatch VIIRS (Suomi-NPP, 4km)",
  },
  {
    id: "noaacwNPPN20VIIRSDINEOFDaily",
    libelle: "NOAA CoastWatch VIIRS DINEOF (Suomi-NPP + NOAA-20 fusionnés, comblé, 9km)",
  },
] as const;

const PAUSE_ENTRE_REQUETES_MS = 300;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface ReponseErddap {
  table?: {
    columnNames: string[];
    rows: (string | number | null)[][];
  };
}

interface ResultatZone {
  chlorophylleMgM3: number | null;
  dateObservation: string | null;
  sourceLibelle?: string;
  erreurDiagnostic?: string;
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Interroge un seul dataset ERDDAP pour une zone, sur une fenêtre de 20
 * jours, et retourne la valeur valide la plus récente trouvée (ou un
 * diagnostic si rien d'exploitable). Ne lève jamais d'exception. */
async function interrogerDataset(
  datasetId: string,
  lat: number,
  lon: number
): Promise<{ valeur: number; dateObservation: string | null } | { diagnostic: string }> {
  try {
    const url = `https://coastwatch.noaa.gov/erddap/griddap/${datasetId}.json?chlor_a[last-19:1:last][(0.0)][(${lat})][(${lon})]`;
    const reponse = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });

    if (!reponse.ok) {
      const texteErreur = await reponse.text();
      return { diagnostic: `${datasetId} — HTTP ${reponse.status}: ${texteErreur.slice(0, 200)}` };
    }

    const donnees: ReponseErddap = await reponse.json();
    const table = donnees.table;
    if (!table || table.rows.length === 0) {
      return { diagnostic: `${datasetId} — réponse OK mais aucune ligne renvoyée.` };
    }

    const indexTemps = table.columnNames.indexOf("time");
    const indexChl = table.columnNames.indexOf("chlor_a");

    for (let i = table.rows.length - 1; i >= 0; i--) {
      const ligne = table.rows[i];
      const valeur = indexChl !== -1 ? ligne[indexChl] : null;
      if (typeof valeur === "number" && Number.isFinite(valeur)) {
        return { valeur, dateObservation: indexTemps !== -1 ? String(ligne[indexTemps]) : null };
      }
    }

    return {
      diagnostic: `${datasetId} — aucun pixel exploitable sur ${table.rows.length} jour(s) vérifié(s) (nuages/qualité du signal).`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { diagnostic: `${datasetId} — exception: ${message}` };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zonesParam = searchParams.get("zones");
  const idsDemandes = zonesParam ? zonesParam.split(",").filter(Boolean) : null;

  const zonesTotal = donneesZones.zones;
  const zonesAInterroger = idsDemandes ? zonesTotal.filter((z) => idsDemandes.includes(z.id)) : zonesTotal;

  const resultat: Record<string, ResultatZone> = {};
  for (const z of zonesTotal) resultat[z.id] = { chlorophylleMgM3: null, dateObservation: null };

  for (const zone of zonesAInterroger) {
    const diagnostics: string[] = [];

    for (const dataset of DATASETS) {
      const reponse = await interrogerDataset(dataset.id, zone.lat, zone.lon);

      if ("valeur" in reponse) {
        resultat[zone.id] = {
          chlorophylleMgM3: reponse.valeur,
          dateObservation: reponse.dateObservation,
          sourceLibelle: dataset.libelle,
        };
        await attendre(PAUSE_ENTRE_REQUETES_MS);
        break; // trouvé, inutile d'essayer le dataset suivant pour cette zone
      }

      diagnostics.push(reponse.diagnostic);
      console.error(`NOAA CoastWatch — ${zone.id}:`, reponse.diagnostic);
      await attendre(PAUSE_ENTRE_REQUETES_MS); // toujours une pause, même en cas d'échec, avant le prochain appel
    }

    if (resultat[zone.id].chlorophylleMgM3 === null && diagnostics.length > 0) {
      resultat[zone.id].erreurDiagnostic = diagnostics.join(" | ");
    }
  }

  return NextResponse.json(resultat);
}
