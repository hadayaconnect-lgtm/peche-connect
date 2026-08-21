// Signalements des pêcheurs — centralisés sur Supabase (étape 2F) afin
// d'être visibles par tous les utilisateurs et depuis le tableau de bord
// ministère, plutôt que stockés par appareil (ancien comportement
// localStorage, conservé uniquement comme repli si Supabase est absent —
// voir ajouterSignalementAvecRepli ci-dessous).

import { Signalement, TypeSignalement } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function supabaseConfigure(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

interface LigneSignalementSupabase {
  id: string;
  zone_id: string;
  type: TypeSignalement;
  especes: string | null;
  date: string;
  auteur: string | null;
  score_au_moment: number | null;
}

function depuisLigne(l: LigneSignalementSupabase): Signalement {
  return {
    id: l.id,
    zoneId: l.zone_id,
    type: l.type,
    especes: l.especes ?? undefined,
    date: l.date,
    auteur: l.auteur ?? undefined,
    scoreAuMoment: l.score_au_moment,
  };
}

export async function getSignalementsSupabase(): Promise<Signalement[]> {
  if (!supabaseConfigure()) return [];
  try {
    const reponse = await fetch(
      `${SUPABASE_URL}/rest/v1/signalements?select=*&order=date.desc&limit=500`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY as string,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        cache: "no-store",
      }
    );
    if (!reponse.ok) {
      console.error("Erreur lecture signalements Supabase:", await reponse.text());
      return [];
    }
    const lignes: LigneSignalementSupabase[] = await reponse.json();
    return lignes.map(depuisLigne);
  } catch (err) {
    console.error("Impossible de contacter Supabase pour les signalements:", err);
    return [];
  }
}

export async function ajouterSignalementSupabase(signalement: {
  zoneId: string;
  type: TypeSignalement;
  especes?: string;
  scoreAuMoment?: number | null;
}): Promise<Signalement | null> {
  if (!supabaseConfigure()) return null;
  try {
    const reponse = await fetch(`${SUPABASE_URL}/rest/v1/signalements`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY as string,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        zone_id: signalement.zoneId,
        type: signalement.type,
        especes: signalement.especes ?? null,
        score_au_moment: signalement.scoreAuMoment ?? null,
      }),
    });
    if (!reponse.ok) {
      console.error("Erreur écriture signalement Supabase:", await reponse.text());
      return null;
    }
    const lignes: LigneSignalementSupabase[] = await reponse.json();
    return lignes[0] ? depuisLigne(lignes[0]) : null;
  } catch (err) {
    console.error("Impossible d'écrire le signalement sur Supabase:", err);
    return null;
  }
}
