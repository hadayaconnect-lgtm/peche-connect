import { NiveauScore, StatutDonnee } from "./types";

/** Traduit le niveau technique en langage courant pour le pêcheur/le jury */
export function libellePotentiel(niveau: NiveauScore): string {
  switch (niveau) {
    case "favorable":
      return "Bon";
    case "moyen":
      return "Moyen";
    case "deconseille":
      return "Faible";
    case "danger":
      return "Dangereux";
  }
}

/** Résumé qualitatif des conditions de mer, à partir des valeurs brutes */
export function libelleConditionsMer(hauteurVagueM: number, vitesseVentKmh: number): string {
  if (hauteurVagueM >= 2.2 || vitesseVentKmh >= 35) return "Difficiles";
  if (hauteurVagueM >= 1.3 || vitesseVentKmh >= 22) return "Modérées";
  return "Favorables";
}

/** État de la mer en un mot, pour la fiche détaillée */
export function libelleEtatMer(hauteurVagueM: number): string {
  if (hauteurVagueM >= 2.2) return "Agité";
  if (hauteurVagueM >= 1.3) return "Modéré";
  return "Calme";
}

/** Qualifie la chlorophylle (proxy de richesse en nutriments/poissons) */
export function libelleChlorophylle(chlorophylle: number): string {
  if (chlorophylle >= 1.2) return "Favorable";
  if (chlorophylle >= 0.6) return "Moyenne";
  return "Faible";
}

/** Libellé + couleur pour un statut de donnée (réel/simulé/indisponible) */
export function libelleStatutDonnee(statut: StatutDonnee): { texte: string; classeCouleur: string } {
  switch (statut) {
    case "reel":
      return { texte: "Réel", classeCouleur: "bg-reef-teal/20 text-reef-teal" };
    case "simule":
      return { texte: "Simulé", classeCouleur: "bg-[#C99A3C]/20 text-[#C99A3C]" };
    case "indisponible":
      return { texte: "Indisponible", classeCouleur: "bg-white/10 text-sand-foam/50" };
  }
}

export function formaterFraicheur(dateIso: string | null): string {
  if (!dateIso) return "date inconnue";
  const date = new Date(dateIso);
  const heuresEcoulees = (Date.now() - date.getTime()) / 3_600_000;

  if (heuresEcoulees < 1) return "il y a moins d'une heure";
  if (heuresEcoulees < 24) return `il y a ${Math.round(heuresEcoulees)} h`;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
