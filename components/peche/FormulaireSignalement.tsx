"use client";

import { useState } from "react";
import { TypeSignalement, ZonePeche } from "@/lib/peche/types";
import { ajouterSignalement } from "@/lib/peche/db";
import { X, Fish } from "lucide-react";

const OPTIONS: { valeur: TypeSignalement; libelle: string; emoji: string }[] = [
  { valeur: "beaucoup", libelle: "Beaucoup de poisson", emoji: "🐟🐟🐟" },
  { valeur: "peu", libelle: "Peu de poisson", emoji: "🐟" },
  { valeur: "rien", libelle: "Rien trouvé", emoji: "—" },
];

export default function FormulaireSignalement({
  zone,
  onFermer,
  onEnvoye,
}: {
  zone: ZonePeche;
  onFermer: () => void;
  onEnvoye: () => void;
}) {
  const [choix, setChoix] = useState<TypeSignalement | null>(null);
  const [especes, setEspeces] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);

  async function envoyer() {
    if (!choix || envoiEnCours) return;
    setEnvoiEnCours(true);
    try {
      await ajouterSignalement({
        zoneId: zone.id,
        type: choix,
        especes: especes || undefined,
        scoreAuMoment: zone.score,
      });
      onEnvoye();
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-2xl bg-dusk-indigo px-5 pt-4 pb-6 border-t border-lagoon-cyan/20">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-sand-foam flex items-center gap-2">
            <Fish size={20} className="text-lagoon-cyan" />
            Signaler — {zone.nom}
          </h2>
          <button onClick={onFermer} className="rounded-full p-1.5 text-sand-foam/60 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.valeur}
              onClick={() => setChoix(opt.valeur)}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                choix === opt.valeur
                  ? "border-reef-teal bg-reef-teal/15 text-sand-foam"
                  : "border-white/10 text-sand-foam/75 hover:border-white/25"
              }`}
            >
              <span>{opt.libelle}</span>
              <span>{opt.emoji}</span>
            </button>
          ))}
        </div>

        <input
          value={especes}
          onChange={(e) => setEspeces(e.target.value)}
          placeholder="Espèces observées (optionnel)"
          className="mt-4 w-full rounded-lg border border-white/10 bg-abyss-navy px-3 py-2.5 text-sm text-sand-foam placeholder:text-sand-foam/40 focus:border-lagoon-cyan focus:outline-none"
        />

        <button
          onClick={envoyer}
          disabled={!choix || envoiEnCours}
          className="mt-5 w-full rounded-xl bg-reef-teal py-3 font-medium text-sand-foam transition hover:bg-reef-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {envoiEnCours ? "Envoi en cours…" : "Envoyer le signalement"}
        </button>
      </div>
    </div>
  );
}
