"use client";

import { useEffect, useRef, useState } from "react";
import { MessageAssistant, ZonePeche } from "@/lib/peche/types";
import { ajouterMessage, getMessages } from "@/lib/peche/db";
import { X, Send, Compass, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import {
  LangueVoix,
  demarrerEcoute,
  lireTexteAVoixHaute,
  arreterLecture,
  reconnaissanceVocaleDisponible,
  syntheseVocaleDisponible,
} from "@/lib/peche/voix";

export default function AssistantChat({ zones, onFermer }: { zones: ZonePeche[]; onFermer: () => void }) {
  const [messages, setMessages] = useState<MessageAssistant[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [ecouteActive, setEcouteActive] = useState(false);
  const [langueVoix, setLangueVoix] = useState<LangueVoix>("fr-FR");
  const [messageEnLecture, setMessageEnLecture] = useState<string | null>(null);
  const arretEcouteRef = useRef<(() => void) | null>(null);
  const finListeRef = useRef<HTMLDivElement>(null);

  const microDisponible = reconnaissanceVocaleDisponible();
  const lectureDisponible = syntheseVocaleDisponible();

  useEffect(() => {
    setMessages(getMessages());
  }, []);

  useEffect(() => {
    finListeRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Arrête toute lecture/écoute en cours si le panneau se ferme
    return () => {
      arreterLecture();
      arretEcouteRef.current?.();
    };
  }, []);

  function basculerEcoute() {
    if (ecouteActive) {
      arretEcouteRef.current?.();
      setEcouteActive(false);
      return;
    }
    setEcouteActive(true);
    arretEcouteRef.current = demarrerEcoute(
      langueVoix,
      (texte) => setSaisie((prec) => (prec ? `${prec} ${texte}` : texte)),
      () => setEcouteActive(false),
      () => setEcouteActive(false)
    );
  }

  function basculerLecture(id: string, texte: string) {
    if (messageEnLecture === id) {
      arreterLecture();
      setMessageEnLecture(null);
      return;
    }
    lireTexteAVoixHaute(texte);
    setMessageEnLecture(id);
  }

  async function envoyer() {
    const texte = saisie.trim();
    if (!texte || enCours) return;
    setSaisie("");

    const messageUtilisateur = ajouterMessage({ role: "user", content: texte });
    setMessages((prev) => [...prev, messageUtilisateur]);
    setEnCours(true);

    try {
      const contexteZones = zones.slice(0, 6).map((z) => ({
        nom: z.nom,
        score: z.score ?? "indisponible",
        niveauConfiance: z.niveauConfiance ?? "aucune donnée fiable",
        niveau: z.niveau,
        distancePortKm: z.distancePortKm,
        temperature:
          z.satellite.temperatureSurface.statut === "reel"
            ? `${z.satellite.temperatureSurface.valeur}°C (réel)`
            : "indisponible",
        vent: `${z.satellite.vitesseVent.valeur} km/h ${z.satellite.directionVent.valeur} (estimation simulée)`,
        vague: `${z.satellite.hauteurVague.valeur} m (estimation simulée)`,
      }));

      const reponse = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: texte,
          contexteZones,
          historique: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await reponse.json();
      const messageAssistant = ajouterMessage({ role: "assistant", content: data.reponse });
      setMessages((prev) => [...prev, messageAssistant]);
    } catch {
      const messageErreur = ajouterMessage({
        role: "assistant",
        content: "Connexion impossible. Vérifiez votre réseau et réessayez.",
      });
      setMessages((prev) => [...prev, messageErreur]);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[3000] flex flex-col bg-abyss-navy">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-lagoon-cyan" />
          <h2 className="font-display text-lg font-semibold text-sand-foam">Assistant Pêche</h2>
        </div>
        <button onClick={onFermer} className="rounded-full p-1.5 text-sand-foam/60 hover:bg-white/5">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-sand-foam/50">
            Posez une question, par exemple :
            <br />
            <span className="text-sand-foam/70">« Je pars du port ce matin, où aller ? »</span>
            <br />
            <span className="mt-2 block text-xs text-sand-foam/40">
              Vous pouvez écrire en français, en somali ou en arabe — l&apos;assistant répond dans la même
              langue.
            </span>
            {microDisponible && (
              <span className="mt-1 block text-xs text-sand-foam/40">
                Le micro reconnaît le français et l&apos;arabe parlés.
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`group flex max-w-[85%] items-start gap-1.5 rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "ml-auto bg-reef-teal text-sand-foam"
                  : "mr-auto bg-dusk-indigo text-sand-foam/90"
              }`}
            >
              <span className="flex-1">{m.content}</span>
              {m.role === "assistant" && lectureDisponible && (
                <button
                  onClick={() => basculerLecture(m.id, m.content)}
                  aria-label="Écouter la réponse"
                  className="mt-0.5 shrink-0 text-sand-foam/40 hover:text-lagoon-cyan"
                >
                  {messageEnLecture === m.id ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
              )}
            </div>
          ))}
          {enCours && (
            <div className="mr-auto rounded-2xl bg-dusk-indigo px-4 py-2.5 text-sm text-sand-foam/50">
              L&apos;assistant réfléchit…
            </div>
          )}
        </div>
        <div ref={finListeRef} />
      </div>

      {microDisponible && (
        <div className="flex items-center justify-center gap-2 border-t border-white/5 px-4 py-1.5">
          <span className="text-[10px] text-sand-foam/40">Langue du micro :</span>
          {(["fr-FR", "ar-SA"] as LangueVoix[]).map((l) => (
            <button
              key={l}
              onClick={() => setLangueVoix(l)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                langueVoix === l ? "bg-lagoon-cyan/20 text-lagoon-cyan" : "text-sand-foam/40 hover:text-sand-foam/70"
              }`}
            >
              {l === "fr-FR" ? "Français" : "العربية"}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3">
        {microDisponible && (
          <button
            onClick={basculerEcoute}
            aria-label={ecouteActive ? "Arrêter l'écoute" : "Parler à l'assistant"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
              ecouteActive
                ? "bg-coral-alert text-sand-foam animate-pulse"
                : "border border-white/10 text-sand-foam/70 hover:bg-white/5"
            }`}
          >
            {ecouteActive ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
        )}
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && envoyer()}
          placeholder={ecouteActive ? "Je vous écoute…" : "Écrivez ou parlez votre question…"}
          className="flex-1 rounded-xl border border-white/10 bg-dusk-indigo px-4 py-2.5 text-sm text-sand-foam placeholder:text-sand-foam/40 focus:border-lagoon-cyan focus:outline-none"
        />
        <button
          onClick={envoyer}
          disabled={enCours || !saisie.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-reef-teal text-sand-foam disabled:opacity-40"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
