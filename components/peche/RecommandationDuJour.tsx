"use client";

import { ZonePeche } from "@/lib/peche/types";
import { libellePotentiel, libelleConditionsMer } from "@/lib/peche/format";
import { Fish, Waves, Wind, Sparkles } from "lucide-react";

const COULEURS_POTENTIEL: Record<string, string> = {
  Bon: "text-reef-teal",
  Moyen: "text-[#C99A3C]",
  Faible: "text-[#8A5A3A]",
  Dangereux: "text-coral-alert",
};

export default function RecommandationDuJour({ zone }: { zone: ZonePeche }) {
  const potentiel = libellePotentiel(zone.niveau);
  const hauteurVague = zone.satellite.hauteurVague.valeur ?? 0;
  const vitesseVent = zone.satellite.vitesseVent.valeur ?? 0;
  const conditions = libelleConditionsMer(hauteurVague, vitesseVent);

  return (
    <div className="z-10 border-b border-white/5 bg-dusk-indigo/90 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-lagoon-cyan">
          <Sparkles size={12} />
          Zone conseillée aujourd&apos;hui
        </span>
        <span className="rounded-full bg-reef-teal/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-reef-teal">
          Basé sur données réelles
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <span className="font-display text-base font-semibold text-sand-foam">
          📍 {zone.nom} <span className="font-sans text-sm font-normal text-sand-foam/60">— {zone.distancePortKm} km de {zone.portReferenceNom}</span>
        </span>

        <span className="flex items-center gap-1.5 text-sand-foam/85">
          <Fish size={15} className="text-lagoon-cyan" />
          Potentiel : <span className={`font-medium ${COULEURS_POTENTIEL[potentiel]}`}>{potentiel}</span>
        </span>

        <span className="flex items-center gap-1.5 text-sand-foam/85">
          <Waves size={15} className="text-lagoon-cyan" />
          Mer : <span className="font-medium">{conditions}</span>
          {zone.estimeParSimulation && <span className="text-[10px] text-sand-foam/40">(estimation)</span>}
        </span>

        <span className="flex items-center gap-1.5 text-sand-foam/85">
          <Wind size={15} className="text-lagoon-cyan" />
          Vent : <span className="font-medium">{vitesseVent} km/h</span>
        </span>

        <span className="ml-auto flex items-center gap-1.5 font-mono text-sand-foam/70">
          Score IA : <span className="font-semibold text-sand-foam">{zone.score}/100</span>
        </span>
      </div>
    </div>
  );
}
