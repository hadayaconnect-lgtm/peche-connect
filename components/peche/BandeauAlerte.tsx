"use client";

import { ZonePeche } from "@/lib/peche/types";
import { AlertTriangle } from "lucide-react";

export default function BandeauAlerte({ zones }: { zones: ZonePeche[] }) {
  const zonesDanger = zones.filter((z) => z.niveau === "danger");
  if (zonesDanger.length === 0) return null;

  return (
    <div className="flex items-center gap-2 bg-coral-alert px-4 py-2.5 text-sm font-medium text-abyss-navy">
      <AlertTriangle size={16} className="shrink-0" />
      <span>
        Mer dangereuse (estimation) : {zonesDanger.map((z) => z.nom).join(", ")}. Évitez ces zones aujourd&apos;hui —
        vérifiez un bulletin météo marine officiel avant de partir.
      </span>
    </div>
  );
}
