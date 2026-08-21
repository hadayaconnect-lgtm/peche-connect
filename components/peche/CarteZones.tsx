"use client";

import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";
import { ZonePeche } from "@/lib/peche/types";
import { PORTS_REFERENCE } from "@/lib/peche/zones-reference";
import "leaflet/dist/leaflet.css";

function AttributionControlBasGauche() {
  const map = useMap();
  useEffect(() => {
    map.attributionControl.setPosition("bottomleft");
  }, [map]);
  return null;
}

/** Leaflet ne détecte pas automatiquement un changement de taille de son
 * conteneur (ex: ouverture/fermeture du panneau de suivi à côté de la
 * carte) — on force un recalcul via ResizeObserver pour éviter un rendu
 * figé/décalé après un tel changement. */
function RedimensionnementAutomatique() {
  const map = useMap();
  useEffect(() => {
    const conteneur = map.getContainer();
    const observateur = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, [map]);
  return null;
}

const COULEURS: Record<string, string> = {
  favorable: "#1B7A72",
  moyen: "#C99A3C",
  deconseille: "#8A5A3A",
  danger: "#E85D3D",
};

function CentrerCarte({ centre }: { centre: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(centre, map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre[0], centre[1]]);
  return null;
}

// Centre approximatif de la couverture Érythrée → Somalie, pour que la
// carte s'ouvre sur une vue d'ensemble de toute la zone plutôt que sur un
// seul point.
const CENTRE_CARTE: [number, number] = [7.7, 45.3];

export default function CarteZones({
  zones,
  zoneSelectionneeId,
  onSelectionZone,
}: {
  zones: ZonePeche[];
  zoneSelectionneeId?: string;
  onSelectionZone: (zoneId: string) => void;
}) {
  return (
    <MapContainer
      center={CENTRE_CARTE}
      zoom={5}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%", background: "#0B1F2E" }}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <AttributionControlBasGauche />
      <RedimensionnementAutomatique />
      <CentrerCarte centre={CENTRE_CARTE} />

      {PORTS_REFERENCE.map((port) => (
        <CircleMarker
          key={port.id}
          center={[port.lat, port.lon]}
          radius={6}
          pathOptions={{ color: "#F2EAD8", fillColor: "#F2EAD8", fillOpacity: 1 }}
        >
          <Tooltip direction="top" className="etiquette-carte">
            Port de {port.nom}
          </Tooltip>
        </CircleMarker>
      ))}

      {zones.map((zone) => {
        const estSelectionnee = zone.id === zoneSelectionneeId;
        const couleur = COULEURS[zone.niveau];
        return (
          <CircleMarker
            key={zone.id}
            center={[zone.coordonnees.lat, zone.coordonnees.lon]}
            radius={estSelectionnee ? 16 : 11}
            pathOptions={{
              color: couleur,
              fillColor: couleur,
              fillOpacity: estSelectionnee ? 0.75 : 0.5,
              weight: estSelectionnee ? 3 : 1.5,
            }}
            eventHandlers={{ click: () => onSelectionZone(zone.id) }}
          >
            <Tooltip direction="top">
              <span className="font-medium">{zone.nom}</span> — score {zone.score ?? "N/D"}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
