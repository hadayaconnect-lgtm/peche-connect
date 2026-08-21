// Fonctions vocales — reconnaissance et synthèse vocale via l'API Web
// Speech du navigateur (gratuite, aucune dépendance externe). Support
// variable selon navigateur : fonctionne bien sur Chrome/Edge desktop et
// Android, plus limité sur Firefox/Safari.
//
// LIMITE CONNUE : aucun navigateur ne propose la reconnaissance vocale en
// somali à ce jour. Le français et l'arabe sont disponibles en entrée
// vocale ; le somali reste utilisable en texte écrit, la réponse de
// l'assistant peut aussi être lue à voix haute (moins fidèle en somali,
// faute de voix dédiée sur la plupart des appareils).

export type LangueVoix = "fr-FR" | "ar-SA";

// L'API Web Speech n'est pas standardisée dans lib.dom.d.ts — déclaration
// minimale des seules propriétés utilisées ici.
interface EvenementReconnaissanceVocale {
  results: { [index: number]: { [index: number]: { transcript: string } } };
}
interface ReconnaissanceVocaleInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (event: EvenementReconnaissanceVocale) => void;
  onerror: (event: { error?: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type ConstructeurReconnaissanceVocale = new () => ReconnaissanceVocaleInstance;

function obtenirConstructeurReconnaissance(): ConstructeurReconnaissanceVocale | undefined {
  const fenetre = window as unknown as {
    SpeechRecognition?: ConstructeurReconnaissanceVocale;
    webkitSpeechRecognition?: ConstructeurReconnaissanceVocale;
  };
  return fenetre.SpeechRecognition || fenetre.webkitSpeechRecognition;
}

export function reconnaissanceVocaleDisponible(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(obtenirConstructeurReconnaissance());
}

export function syntheseVocaleDisponible(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Démarre une écoute unique (pas de mode continu) et retourne le texte
 * transcrit via le callback. Retourne une fonction d'arrêt manuel.
 */
export function demarrerEcoute(
  langue: LangueVoix,
  onResultat: (texte: string) => void,
  onErreur: (erreur: string) => void,
  onFin: () => void
): () => void {
  const ConstructeurReconnaissance = obtenirConstructeurReconnaissance();
  if (!ConstructeurReconnaissance) {
    onErreur("Reconnaissance vocale non disponible sur ce navigateur.");
    return () => {};
  }

  const reconnaissance = new ConstructeurReconnaissance();
  reconnaissance.lang = langue;
  reconnaissance.interimResults = false;
  reconnaissance.maxAlternatives = 1;

  reconnaissance.onresult = (event) => {
    const texte = event.results?.[0]?.[0]?.transcript ?? "";
    onResultat(texte);
  };
  reconnaissance.onerror = (event) => {
    onErreur(event.error ?? "Erreur de reconnaissance vocale");
  };
  reconnaissance.onend = () => onFin();

  reconnaissance.start();
  return () => reconnaissance.stop();
}

/** Heuristique simple : script arabe détecté → langue arabe, sinon français
 * (le somali s'écrit en alphabet latin comme le français, indiscernable par
 * le script seul — la lecture utilisera donc une voix française, moins
 * fidèle mais fonctionnelle). */
function detecterLangueApprox(texte: string): LangueVoix {
  const contientArabe = /[\u0600-\u06FF]/.test(texte);
  return contientArabe ? "ar-SA" : "fr-FR";
}

export function lireTexteAVoixHaute(texte: string): void {
  if (!syntheseVocaleDisponible()) return;
  window.speechSynthesis.cancel(); // interrompt une lecture en cours avant d'en lancer une nouvelle
  const enonce = new SpeechSynthesisUtterance(texte);
  enonce.lang = detecterLangueApprox(texte);
  enonce.rate = 0.95;
  window.speechSynthesis.speak(enonce);
}

export function arreterLecture(): void {
  if (syntheseVocaleDisponible()) window.speechSynthesis.cancel();
}
