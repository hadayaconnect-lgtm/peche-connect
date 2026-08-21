"use client";

import dynamic from "next/dynamic";
import { ZonePeche } from "@/lib/peche/types";

const CarteZones = dynamic(() => import("./CarteZones"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-abyss-navy text-sand-foam/40 text-sm">
      Chargement de la carte…
    </div>
  ),
});

export default function CarteZonesClient(props: {
  zones: ZonePeche[];
  zoneSelectionneeId?: string;
  onSelectionZone: (zoneId: string) => void;
}) {
  return <CarteZones {...props} />;
}
