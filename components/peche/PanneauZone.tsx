"use client";

import { ZonePeche } from "@/lib/peche/types";
import CadranScore from "./CadranScore";
import { Waves, Wind, Thermometer, Droplets, X, MessageSquarePlus, MapPin, Clock, Compass, ShieldAlert, CircleHelp, Navigation2, MessageCircle, Gauge, Waypoints, Mountain } from "lucide-react";
import { libelleEtatMer, libellePotentiel, formaterFraicheur, libelleStatutDonnee } from "@/lib/peche/format";

function formaterCoordonnee(valeur: number, suffixePositif: string): string {
  return `${Math.abs(valeur).toFixed(4)}°${suffixePositif}`;
}

function PuceStatut({ statut }: { statut: "reel" | "simule" | "indisponible" }) {
  const { texte, classeCouleur } = libelleStatutDonnee(statut);
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${classeCouleur}`}>
      {texte}
    </span>
  );
}

export default function PanneauZone({
  zone,
  onFermer,
  onSignaler,
  onOuvrirAssistant,
}: {
  zone: ZonePeche;
  onFermer: () => void;
  onSignaler: () => void;
  onOuvrirAssistant?: () => void;
}) {
  const temp = zone.satellite.temperatureSurface;
  const chloro = zone.satellite.chlorophylle;
  const vague = zone.satellite.hauteurVague;
  const vent = zone.satellite.vitesseVent;
  const direction = zone.satellite.directionVent;
  const courant = zone.satellite.vitesseCourant;
  const directionCourant = zone.satellite.directionCourant;
  const gradientChlorophylle = zone.satellite.gradientChlorophylle;
  const indiceConvergence = zone.satellite.indiceConvergence;
  const bathymetrie = zone.satellite.bathymetrie;

  return (
    <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-dusk-indigo border-t border-lagoon-cyan/20 px-5 pt-4 pb-6 shadow-2xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-sand-foam">{zone.nom}</h2>
          <p className="flex items-center gap-1.5 text-sm text-sand-foam/60">
            <MapPin size={13} />
            {formaterCoordonnee(zone.coordonnees.lat, "N")}, {formaterCoordonnee(zone.coordonnees.lon, "E")}
            <span className="text-sand-foam/30">·</span>
            {zone.distancePortKm} km de {zone.portReferenceNom}
          </p>
        </div>
        <button
          onClick={onFermer}
          aria-label="Fermer"
          className="rounded-full p-1.5 text-sand-foam/60 hover:bg-white/5 hover:text-sand-foam"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <CadranScore score={zone.score} niveau={zone.niveau} taille={104} />
        <div className="grid flex-1 grid-cols-1 gap-y-2 text-sm">
          <div className="flex items-center justify-between text-sand-foam/85">
            <span className="flex items-center gap-1.5">
              <Thermometer size={15} className="text-lagoon-cyan" />
              Température eau
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">{temp.valeur !== null ? `${temp.valeur}°C` : "—"}</span>
              <PuceStatut statut={temp.statut} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sand-foam/85">
            <span className="flex items-center gap-1.5">
              <Droplets size={15} className="text-lagoon-cyan" />
              Chlorophylle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">{chloro.valeur !== null ? `${chloro.valeur} mg/m³` : "—"}</span>
              <PuceStatut statut={chloro.statut} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sand-foam/85">
            <span className="flex items-center gap-1.5">
              <Waves size={15} className="text-lagoon-cyan" />
              État de la mer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-medium">{vague.valeur !== null ? libelleEtatMer(vague.valeur) : "—"}</span>
              <PuceStatut statut={vague.statut} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sand-foam/85">
            <span className="flex items-center gap-1.5">
              <Wind size={15} className="text-lagoon-cyan" />
              Vent
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">
                {vent.valeur} km/h {direction.valeur}
              </span>
              <PuceStatut statut={vent.statut} />
            </span>
          </div>
          <div className="flex items-center justify-between text-sand-foam/85">
            <span className="flex items-center gap-1.5">
              <Navigation2 size={15} className="text-lagoon-cyan" />
              Courant
            </span>
            <span className="flex items-center gap-1.5">
              <span className="font-mono">
                {courant.valeur !== null ? `${courant.valeur} km/h ${directionCourant.valeur}` : "—"}
              </span>
              <PuceStatut statut={courant.statut} />
            </span>
          </div>
        </div>
      </div>

      {courant.statut === "reel" && (
        <p className="mt-2 text-[10px] text-sand-foam/40">
          Courant estimé à ~8 km de résolution — précision limitée près des côtes, ne remplace pas un
          almanach nautique.
        </p>
      )}

      {/* Critères complémentaires du moteur multi-paramètres */}
      <div className="mt-3 grid grid-cols-1 gap-y-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm">
        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-sand-foam/50">Critères complémentaires</p>
        <div className="flex items-center justify-between text-sand-foam/85">
          <span className="flex items-center gap-1.5">
            <Waypoints size={15} className="text-lagoon-cyan" />
            Front chlorophyllien
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">
              {gradientChlorophylle.valeur !== null ? `${Math.round(gradientChlorophylle.valeur * 100)}%` : "—"}
            </span>
            <PuceStatut statut={gradientChlorophylle.statut} />
          </span>
        </div>
        <div className="flex items-center justify-between text-sand-foam/85">
          <span className="flex items-center gap-1.5">
            <Gauge size={15} className="text-lagoon-cyan" />
            Convergence courants
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">
              {indiceConvergence.valeur !== null ? `${indiceConvergence.valeur}%` : "—"}
            </span>
            <PuceStatut statut={indiceConvergence.statut} />
          </span>
        </div>
        <div className="flex items-center justify-between text-sand-foam/85">
          <span className="flex items-center gap-1.5">
            <Mountain size={15} className="text-lagoon-cyan" />
            Profondeur
          </span>
          <span className="flex items-center gap-1.5">
            <span className="font-mono">{bathymetrie.valeur !== null ? `${bathymetrie.valeur} m` : "—"}</span>
            <PuceStatut statut={bathymetrie.statut} />
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-lg bg-abyss-navy/50 px-3 py-2 text-sm">
        <span className="text-sand-foam/70">Potentiel de pêche</span>
        <span className="font-semibold text-sand-foam">
          {zone.score !== null ? libellePotentiel(zone.niveau) : "Indisponible"}
        </span>
      </div>

      {zone.niveauConfiance && (
        <div className="mt-2 flex items-center gap-2 text-xs text-sand-foam/60">
          <CircleHelp size={13} />
          Niveau de confiance :{" "}
          <span className="font-medium text-sand-foam">
            {zone.niveauConfiance === "eleve" ? "Élevé" : zone.niveauConfiance === "moyen" ? "Moyen" : "Faible"}
          </span>
        </div>
      )}

      {zone.raisons.length > 0 && (
        <div className="mt-3 rounded-lg border border-white/10 px-3 py-2">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-sand-foam/50">Pourquoi ce résultat</p>
          <ul className="flex flex-col gap-1 text-xs text-sand-foam/75">
            {zone.raisons.map((raison, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-lagoon-cyan">•</span>
                {raison}
              </li>
            ))}
          </ul>
        </div>
      )}

      {zone.niveau === "danger" && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-coral-alert/15 border border-coral-alert/40 px-3 py-2 text-sm text-coral-alert">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <span>
            Mer dangereuse estimée dans cette zone. Sortie déconseillée.
            {zone.estimeParSimulation && (
              <span className="mt-0.5 block text-[11px] text-coral-alert/70">
                (Estimation basée sur une simulation — vent et vagues réels non encore intégrés. Restez prudent
                et vérifiez un bulletin météo marine officiel avant de partir.)
              </span>
            )}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-sand-foam/60">
        <p className="mb-0.5 text-[10px] uppercase tracking-wide text-sand-foam/40">Provenance des données clés</p>
        <div className="flex items-start gap-1.5">
          <Clock size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-sand-foam/80">Température</span> — Source :{" "}
            {temp.statut === "reel" ? (temp.source.includes("relais") ? "Open-Meteo (relais)" : "Copernicus") : "—"}
            {temp.statut === "reel" && (
              <>
                {" · "}
                {formaterFraicheur(temp.dateRecuperation)}
              </>
            )}
            {temp.statut !== "reel" && " · indisponible"}
          </span>
        </div>
        <div className="flex items-start gap-1.5">
          <Clock size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium text-sand-foam/80">Chlorophylle</span> — Source :{" "}
            {chloro.statut === "reel"
              ? chloro.source.includes("NOAA")
                ? "NOAA CoastWatch VIIRS (relais)"
                : "Copernicus"
              : "—"}
            {chloro.statut === "reel" && (
              <>
                {" · "}
                {formaterFraicheur(chloro.dateRecuperation)}
              </>
            )}
            {chloro.statut !== "reel" && " · indisponible"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${zone.coordonnees.lat},${zone.coordonnees.lon}&travelmode=driving`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-lagoon-cyan/40 py-3 font-medium text-lagoon-cyan transition hover:bg-lagoon-cyan/10"
        >
          <Compass size={18} />
          Naviguer
        </a>
        <button
          onClick={onSignaler}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-reef-teal py-3 font-medium text-sand-foam transition hover:bg-reef-teal/90"
        >
          <MessageSquarePlus size={18} />
          Signaler ma pêche
        </button>
        {onOuvrirAssistant && (
          <button
            onClick={onOuvrirAssistant}
            aria-label="Parler à l'assistant"
            className="flex shrink-0 items-center justify-center rounded-xl border border-white/10 px-4 py-3 text-sand-foam/80 transition hover:bg-white/5"
          >
            <MessageCircle size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
