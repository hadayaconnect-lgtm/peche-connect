"use client";

import { ZonePeche, Signalement } from "@/lib/peche/types";
import TableauZones from "./TableauZones";
import GraphiqueSignalements from "./GraphiqueSignalements";
import { Download, RefreshCw, Waves, Fish, TrendingUp, Satellite, CircleAlert, X } from "lucide-react";

export default function PanneauSuivi({
  zones,
  signalements,
  chargement,
  zoneSelectionneeId,
  onSelectionZone,
  onActualiser,
  onExporter,
  onFermer,
}: {
  zones: ZonePeche[];
  signalements: Signalement[];
  chargement: boolean;
  zoneSelectionneeId?: string;
  onSelectionZone: (zoneId: string) => void;
  onActualiser: () => void;
  onExporter: () => void;
  onFermer?: () => void;
}) {
  const zonesAvecScore = zones.filter((z) => z.score !== null);
  const zonesFavorables = zones.filter((z) => z.niveau === "favorable").length;
  const zonesDanger = zones.filter((z) => z.niveau === "danger").length;
  const zonesReelles = zones.filter((z) => z.donneesReellesDisponibles).length;
  const scoreMoyen = zonesAvecScore.length
    ? Math.round(zonesAvecScore.reduce((acc, z) => acc + (z.score ?? 0), 0) / zonesAvecScore.length)
    : null;

  return (
    <div className="flex h-full flex-col bg-abyss-navy text-sand-foam">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3.5">
        <div>
          <h2 className="font-display text-base font-semibold">Suivi — Pêche Connect</h2>
          <p className="text-xs text-sand-foam/50">Vue institutionnelle</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onActualiser}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-sand-foam/80 hover:bg-white/5"
          >
            <RefreshCw size={13} className={chargement ? "animate-spin" : ""} />
          </button>
          <button
            onClick={onExporter}
            className="flex items-center gap-1.5 rounded-lg bg-reef-teal px-2.5 py-1.5 text-xs font-medium text-sand-foam hover:bg-reef-teal/90"
          >
            <Download size={13} />
          </button>
          {onFermer && (
            <button onClick={onFermer} className="rounded-full p-1.5 text-sand-foam/60 hover:bg-white/5 lg:hidden">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Indicateurs clés */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-sand-foam/50 text-[11px]">
              <Waves size={12} /> Zones suivies
            </div>
            <div className="mt-1 font-mono text-xl font-semibold">{zones.length}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-sand-foam/50 text-[11px]">
              <TrendingUp size={12} /> Score moyen
            </div>
            <div className="mt-1 font-mono text-xl font-semibold">{scoreMoyen ?? "—"}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-sand-foam/50 text-[11px]">
              <Fish size={12} /> Favorables
            </div>
            <div className="mt-1 font-mono text-xl font-semibold text-reef-teal">{zonesFavorables}</div>
          </div>
          <div className="rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-sand-foam/50 text-[11px]">
              <CircleAlert size={12} /> Sécurité (estimé)
            </div>
            <div className="mt-1 font-mono text-xl font-semibold text-coral-alert">{zonesDanger}</div>
          </div>
          <div className="col-span-2 rounded-xl border border-white/10 p-3">
            <div className="flex items-center gap-1.5 text-sand-foam/50 text-[11px]">
              <Satellite size={12} /> Copernicus réel
            </div>
            <div className="mt-1 font-mono text-xl font-semibold">
              {zonesReelles}/{zones.length}
            </div>
          </div>
        </div>

        {/* Graphique signalements */}
        <div className="mt-6">
          <h3 className="mb-2 font-display text-xs font-medium uppercase tracking-wide text-sand-foam/60">
            Signalements ({signalements.length} au total)
          </h3>
          <GraphiqueSignalements zones={zones} signalements={signalements} />
        </div>

        {/* Tableau détaillé */}
        <div className="mt-6">
          <h3 className="mb-2 font-display text-xs font-medium uppercase tracking-wide text-sand-foam/60">
            Données par zone{" "}
            <span className="font-sans text-[10px] font-normal normal-case text-sand-foam/40">
              (cliquez une ligne pour la localiser)
            </span>
          </h3>
          <TableauZones zones={zones} zoneSelectionneeId={zoneSelectionneeId} onSelectionZone={onSelectionZone} />
        </div>

        <div className="mt-6 space-y-1 pb-4 text-[11px] text-sand-foam/35">
          <p>
            <span className="font-medium text-sand-foam/50">Température (SST) et chlorophylle</span> : mesures
            réelles Copernicus quand disponibles et fraîches (moins de 36h), sinon &quot;Indisponible&quot; —
            jamais remplacées silencieusement par une simulation.
          </p>
          <p>
            <span className="font-medium text-sand-foam/50">Vent, vagues et courants</span> : données réelles
            Open-Meteo quand disponibles, avec repli transparent et marqué &quot;Simulé&quot; sinon. Le niveau
            de sécurité reste indicatif — vérifiez toujours un bulletin météo marine officiel.
          </p>
        </div>
      </div>
    </div>
  );
}
