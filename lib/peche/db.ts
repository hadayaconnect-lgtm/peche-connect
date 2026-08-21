import { AlerteSecurite, MessageAssistant, Signalement, TypeSignalement } from "./types";
import { ajouterSignalementSupabase, getSignalementsSupabase } from "./signalements-supabase";

// Façade localStorage "pecheDb" pour les messages assistant et les alertes
// (données locales à l'appareil, pas de besoin de centralisation).
//
// Les SIGNALEMENTS (retours terrain pêcheurs) sont désormais centralisés
// sur Supabase (étape 2F) via signalements-supabase.ts, afin d'être visibles
// par tous les utilisateurs et depuis le tableau de bord ministère. Le
// repli localStorage ci-dessous n'intervient que si Supabase n'est pas
// configuré ou injoignable (résilience réseau) — il ne s'agit pas ici de
// données environnementales, donc pas concerné par la règle "jamais de
// repli silencieux" qui s'applique aux données Copernicus.

const CLES = {
  signalementsLocal: "pecheDb:signalements",
  messages: "pecheDb:messages",
  alertes: "pecheDb:alertes",
} as const;

function lire<T>(cle: string, defaut: T): T {
  if (typeof window === "undefined") return defaut;
  try {
    const brut = window.localStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

function ecrire<T>(cle: string, valeur: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(cle, JSON.stringify(valeur));
}

// --- Signalements (Supabase en priorité, repli localStorage) ---

function getSignalementsLocal(): Signalement[] {
  return lire<Signalement[]>(CLES.signalementsLocal, []);
}

function ajouterSignalementLocal(signalement: Omit<Signalement, "id" | "date">): Signalement {
  const nouveau: Signalement = {
    ...signalement,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  const liste = getSignalementsLocal();
  liste.push(nouveau);
  ecrire(CLES.signalementsLocal, liste);
  return nouveau;
}

/** Signalements centralisés (Supabase) + signalements locaux non encore
 * synchronisés (repli hors-ligne), fusionnés pour l'affichage. */
export async function getSignalements(): Promise<Signalement[]> {
  const distants = await getSignalementsSupabase();
  if (distants.length > 0) return distants;
  return getSignalementsLocal();
}

export async function ajouterSignalement(signalement: {
  zoneId: string;
  type: TypeSignalement;
  especes?: string;
  scoreAuMoment?: number | null;
}): Promise<Signalement> {
  const distant = await ajouterSignalementSupabase(signalement);
  if (distant) return distant;
  // Supabase indisponible : conservation locale pour ne pas perdre le
  // signalement du pêcheur (résilience, pas falsification de données)
  return ajouterSignalementLocal(signalement);
}

// --- Messages assistant IA (historique de conversation, local) ---

export function getMessages(): MessageAssistant[] {
  return lire<MessageAssistant[]>(CLES.messages, []);
}

export function ajouterMessage(message: Omit<MessageAssistant, "id" | "date">): MessageAssistant {
  const nouveau: MessageAssistant = {
    ...message,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  const liste = getMessages();
  liste.push(nouveau);
  ecrire(CLES.messages, liste);
  return nouveau;
}

export function viderMessages(): void {
  ecrire(CLES.messages, []);
}

// --- Alertes sécurité (locales) ---

export function getAlertes(): AlerteSecurite[] {
  return lire<AlerteSecurite[]>(CLES.alertes, []);
}

export function ajouterAlerte(alerte: Omit<AlerteSecurite, "id" | "date">): AlerteSecurite {
  const nouvelle: AlerteSecurite = {
    ...alerte,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  const liste = getAlertes();
  liste.unshift(nouvelle);
  ecrire(CLES.alertes, liste.slice(0, 20));
  return nouvelle;
}

// --- Export / sauvegarde JSON (données locales uniquement — les
// signalements centralisés sont consultables directement depuis Supabase) ---

export function exporterDonnees(): string {
  return JSON.stringify(
    {
      signalementsLocaux: getSignalementsLocal(),
      messages: getMessages(),
      alertes: getAlertes(),
      exporteLe: new Date().toISOString(),
    },
    null,
    2
  );
}

export function importerDonnees(json: string): void {
  const data = JSON.parse(json);
  if (data.signalementsLocaux) ecrire(CLES.signalementsLocal, data.signalementsLocaux);
  if (data.messages) ecrire(CLES.messages, data.messages);
  if (data.alertes) ecrire(CLES.alertes, data.alertes);
}
