"use client";

import { ZonePeche } from "@/lib/peche/types";
import { libelleStatutDonnee } from "@/lib/peche/format";

const COULEURS_NIVEAU: Record<string, string> = {
  favorable: "text-reef-teal",
  moyen: "text-[#C99A3C]",
  deconseille: "text-[#8A5A3A]",
  danger: "text-coral-alert",
};

function PuceStatut({ statut }: { statut: "reel" | "simule" | "indisponible" }) {
  const { texte, classeCouleur } = libelleStatutDonnee(statut);
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${classeCouleur}`}>
      {texte}
    </span>
  );
}

export default function TableauZones({
  zones,
  zoneSelectionneeId,
  onSelectionZone,
}: {
  zones: ZonePeche[];
  zoneSelectionneeId?: string;
  onSelectionZone?: (zoneId: string) => void;
}) {
  return (
    <div className="max-h-[480px] overflow-y-auto overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[1440px] text-left text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-white/10 bg-dusk-indigo text-sand-foam/60">
            <th className="px-4 py-3 font-medium">Zone</th>
            <th className="px-4 py-3 font-medium">Coordonnées</th>
            <th className="px-4 py-3 font-medium">Potentiel</th>
            <th className="px-4 py-3 font-medium">Confiance</th>
            <th className="px-4 py-3 font-medium">Sécurité</th>
            <th className="px-4 py-3 font-medium">Temp. (SST)</th>
            <th className="px-4 py-3 font-medium">Chloro.</th>
            <th className="px-4 py-3 font-medium">Vent</th>
            <th className="px-4 py-3 font-medium">Vague</th>
            <th className="px-4 py-3 font-medium">Courant</th>
            <th className="px-4 py-3 font-medium">Front chl.</th>
            <th className="px-4 py-3 font-medium">Converg.</th>
            <th className="px-4 py-3 font-medium">Profondeur</th>
            <th className="px-4 py-3 font-medium">Distance</th>
            <th className="px-4 py-3 font-medium">Port réf.</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sand-foam/85">
          {zones.map((z) => (
            <tr
              key={z.id}
              onClick={() => onSelectionZone?.(z.id)}
              className={`border-b border-white/5 last:border-0 align-top ${
                onSelectionZone ? "cursor-pointer" : ""
              } ${z.id === zoneSelectionneeId ? "bg-lagoon-cyan/10" : "hover:bg-white/5"}`}
            >
              <td className="px-4 py-2.5 font-sans font-medium text-sand-foam">{z.nom}</td>
              <td className="px-4 py-2.5 text-sand-foam/60">
                {z.coordonnees.lat.toFixed(3)}°N, {z.coordonnees.lon.toFixed(3)}°E
              </td>
              <td className="px-4 py-2.5">{z.score !== null ? z.score : "—"}</td>
              <td className="px-4 py-2.5 font-sans capitalize">
                {z.niveauConfiance === "eleve"
                  ? "Élevé"
                  : z.niveauConfiance === "moyen"
                  ? "Moyen"
                  : z.niveauConfiance === "faible"
                  ? "Faible"
                  : "—"}
              </td>
              <td className={`px-4 py-2.5 font-sans capitalize ${COULEURS_NIVEAU[z.niveau]}`}>
                {z.niveau}
                {z.estimeParSimulation && <span className="ml-1 text-[9px] text-sand-foam/40">(estimé)</span>}
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.temperatureSurface.valeur !== null ? `${z.satellite.temperatureSurface.valeur}°C` : "—"}
                  <PuceStatut statut={z.satellite.temperatureSurface.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.chlorophylle.valeur !== null ? z.satellite.chlorophylle.valeur : "—"}
                  <PuceStatut statut={z.satellite.chlorophylle.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.vitesseVent.valeur} {z.satellite.directionVent.valeur}
                  <PuceStatut statut={z.satellite.vitesseVent.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.hauteurVague.valeur} m
                  <PuceStatut statut={z.satellite.hauteurVague.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.vitesseCourant.valeur !== null
                    ? `${z.satellite.vitesseCourant.valeur} km/h ${z.satellite.directionCourant.valeur}`
                    : "—"}
                  <PuceStatut statut={z.satellite.vitesseCourant.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.gradientChlorophylle.valeur !== null
                    ? `${Math.round(z.satellite.gradientChlorophylle.valeur * 100)}%`
                    : "—"}
                  <PuceStatut statut={z.satellite.gradientChlorophylle.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.indiceConvergence.valeur !== null ? `${z.satellite.indiceConvergence.valeur}%` : "—"}
                  <PuceStatut statut={z.satellite.indiceConvergence.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  {z.satellite.bathymetrie.valeur !== null ? `${z.satellite.bathymetrie.valeur} m` : "—"}
                  <PuceStatut statut={z.satellite.bathymetrie.statut} />
                </div>
              </td>
              <td className="px-4 py-2.5">{z.distancePortKm} km</td>
              <td className="px-4 py-2.5 font-sans text-sand-foam/60">{z.portReferenceNom}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
