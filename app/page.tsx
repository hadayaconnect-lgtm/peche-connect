"use client";

import { useEffect, useMemo, useState } from "react";
import { ZonePeche, Signalement } from "@/lib/peche/types";
import { genererZonesAvecScore } from "@/lib/peche/scoring";
import { getSignalements, exporterDonnees } from "@/lib/peche/db";
import CarteZonesClient from "@/components/peche/CarteZonesClient";
import PanneauZone from "@/components/peche/PanneauZone";
import FormulaireSignalement from "@/components/peche/FormulaireSignalement";
import AssistantChat from "@/components/peche/AssistantChat";
import BandeauAlerte from "@/components/peche/BandeauAlerte";
import RecommandationDuJour from "@/components/peche/RecommandationDuJour";
import LegendeCarte from "@/components/peche/LegendeCarte";
import PanneauSuivi from "@/components/peche/PanneauSuivi";
import { Compass, MessageCircle, BarChart3, X } from "lucide-react";

export default function PageAccueil() {
  const [zones, setZones] = useState<ZonePeche[]>([]);
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [chargementSuivi, setChargementSuivi] = useState(false);
  const [zoneSelectionneeId, setZoneSelectionneeId] = useState<string | undefined>();
  const [panneauSignalementOuvert, setPanneauSignalementOuvert] = useState(false);
  const [assistantOuvert, setAssistantOuvert] = useState(false);
  // Contrôle uniquement l'affichage plein écran du suivi sur MOBILE — sur
  // grand écran, le panneau de suivi reste affiché en permanence à côté de
  // la carte, indépendamment de cet état.
  const [suiviOuvertMobile, setSuiviOuvertMobile] = useState(false);

  async function charger() {
    setChargementSuivi(true);
    const [z, s] = await Promise.all([genererZonesAvecScore(), getSignalements()]);
    setZones(z);
    setSignalements(s);
    setChargementSuivi(false);
  }

  useEffect(() => {
    charger();
  }, []);

  // Priorité aux zones avec un score réel calculable et sans danger. Si
  // aucune zone n'a de score fiable, on l'indique clairement plutôt que
  // d'afficher une zone au hasard (pas de repli silencieux, étape 2B).
  const meilleureZone = useMemo(() => {
    const avecScore = zones.filter((z) => z.score !== null && z.niveau !== "danger");
    if (avecScore.length > 0) return avecScore[0];
    return undefined;
  }, [zones]);

  const aucuneZoneFiable = zones.length > 0 && zones.every((z) => z.score === null);

  const zoneSelectionnee = zones.find((z) => z.id === zoneSelectionneeId);

  function telechargerRapport() {
    const contenu = exporterDonnees();
    const blob = new Blob([contenu], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peche-connect-rapport-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="relative flex h-dvh flex-col overflow-hidden bg-abyss-navy">
      <BandeauAlerte zones={zones} />

      {/* En-tête */}
      <div className="z-10 flex items-center gap-3 border-b border-white/5 bg-abyss-navy/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Compass size={22} className="text-lagoon-cyan" />
          <span className="font-display text-base font-semibold text-sand-foam">Pêche Connect</span>
        </div>
        {/* Bouton visible uniquement sur mobile : sur grand écran le suivi
            est déjà affiché en permanence, pas besoin de bouton. */}
        <button
          onClick={() => setSuiviOuvertMobile((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition lg:hidden ${
            suiviOuvertMobile
              ? "border-lagoon-cyan/40 bg-lagoon-cyan/10 text-lagoon-cyan"
              : "border-white/10 text-sand-foam/60 hover:bg-white/5"
          }`}
        >
          {suiviOuvertMobile ? <X size={14} /> : <BarChart3 size={14} />}
          Suivi
        </button>
      </div>

      {/* Corps : carte à gauche, suivi à droite — toujours côte à côte sur
          grand écran ; sur mobile, suivi en plein écran par-dessus quand
          ouvert via le bouton. */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {meilleureZone && <RecommandationDuJour zone={meilleureZone} />}

          {!meilleureZone && aucuneZoneFiable && (
            <div className="z-10 bg-dusk-indigo/90 px-4 py-3 text-sm text-sand-foam/70">
              Aucune recommandation fiable pour le moment — les données satellite Copernicus ne sont pas
              disponibles actuellement. Consultez le suivi pour le détail par zone.
            </div>
          )}

          <div className="relative flex-1">
            <CarteZonesClient
              zones={zones}
              zoneSelectionneeId={zoneSelectionneeId}
              onSelectionZone={(id) => setZoneSelectionneeId(id)}
            />

            <LegendeCarte />

            {/* Masqué quand le panneau de zone est ouvert, pour ne jamais
                chevaucher ses boutons (Naviguer / Signaler ma pêche). */}
            {!zoneSelectionnee && (
              <button
                onClick={() => setAssistantOuvert(true)}
                className="absolute bottom-6 right-4 z-[2000] flex items-center gap-2 rounded-full bg-reef-teal px-5 py-3 font-medium text-sand-foam shadow-lg shadow-black/40 transition hover:bg-reef-teal/90"
              >
                <MessageCircle size={18} />
                Parler à l&apos;assistant
              </button>
            )}

            {/* Panneau de détail zone — cantonné à la colonne carte, ne
                chevauche jamais le panneau de suivi sur grand écran. */}
            {zoneSelectionnee && !panneauSignalementOuvert && (
              <div className="absolute inset-x-0 bottom-0 z-[1000]">
                <PanneauZone
                  zone={zoneSelectionnee}
                  onFermer={() => setZoneSelectionneeId(undefined)}
                  onSignaler={() => setPanneauSignalementOuvert(true)}
                  onOuvrirAssistant={() => setAssistantOuvert(true)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Panneau de suivi : TOUJOURS visible en colonne fixe sur grand
            écran (lg:block), affiché en plein écran sur mobile uniquement
            quand ouvert via le bouton. */}
        <div
          className={`${
            suiviOuvertMobile ? "absolute inset-0 z-[2500] block" : "hidden"
          } w-full border-l border-white/5 lg:static lg:z-auto lg:block lg:w-[420px] lg:shrink-0`}
        >
          <PanneauSuivi
            zones={zones}
            signalements={signalements}
            chargement={chargementSuivi}
            zoneSelectionneeId={zoneSelectionneeId}
            onSelectionZone={setZoneSelectionneeId}
            onActualiser={charger}
            onExporter={telechargerRapport}
            onFermer={() => setSuiviOuvertMobile(false)}
          />
        </div>
      </div>

      {/* Formulaire de signalement */}
      {zoneSelectionnee && panneauSignalementOuvert && (
        <FormulaireSignalement
          zone={zoneSelectionnee}
          onFermer={() => setPanneauSignalementOuvert(false)}
          onEnvoye={() => {
            setPanneauSignalementOuvert(false);
            charger();
          }}
        />
      )}

      {/* Assistant IA */}
      {assistantOuvert && <AssistantChat zones={zones} onFermer={() => setAssistantOuvert(false)} />}
    </main>
  );
}
