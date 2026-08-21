"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

const ENTREES = [
  { couleur: "#1B7A72", libelle: "Potentiel élevé", description: "Bonnes conditions pour la pêche" },
  { couleur: "#C99A3C", libelle: "Potentiel moyen", description: "Conditions correctes, à évaluer" },
  { couleur: "#8A5A3A", libelle: "Potentiel faible", description: "Peu favorable aujourd'hui" },
  { couleur: "#E85D3D", libelle: "Mer dangereuse", description: "Sortie déconseillée" },
];

export default function LegendeCarte() {
  const [ouverte, setOuverte] = useState(false);

  return (
    <div className="absolute left-4 top-4 z-[1000]">
      <button
        onClick={() => setOuverte((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-dusk-indigo/90 px-3 py-2 text-xs font-medium text-sand-foam shadow-lg backdrop-blur"
      >
        {ouverte ? <X size={14} /> : <Info size={14} />}
        Légende
      </button>

      {ouverte && (
        <div className="mt-2 w-60 rounded-xl bg-dusk-indigo/95 p-3 shadow-xl backdrop-blur">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-sand-foam/50">
            Couleurs des zones sur la carte
          </p>
          <div className="flex flex-col gap-2">
            {ENTREES.map((e) => (
              <div key={e.libelle} className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: e.couleur }}
                />
                <div>
                  <div className="text-xs font-medium text-sand-foam">{e.libelle}</div>
                  <div className="text-[11px] text-sand-foam/60">{e.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
