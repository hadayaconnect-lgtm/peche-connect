"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Signalement, ZonePeche } from "@/lib/peche/types";

export default function GraphiqueSignalements({
  zones,
  signalements,
}: {
  zones: ZonePeche[];
  signalements: Signalement[];
}) {
  const donnees = zones.map((zone) => {
    const parZone = signalements.filter((s) => s.zoneId === zone.id);
    return {
      nom: zone.nom.length > 14 ? zone.nom.slice(0, 13) + "…" : zone.nom,
      Beaucoup: parZone.filter((s) => s.type === "beaucoup").length,
      Peu: parZone.filter((s) => s.type === "peu").length,
      Rien: parZone.filter((s) => s.type === "rien").length,
    };
  });

  const totalSignalements = signalements.length;

  if (totalSignalements === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-xl border border-white/10 text-sm text-sand-foam/40">
        Aucun signalement enregistré pour le moment.
      </div>
    );
  }

  return (
    <div className="h-64 rounded-xl border border-white/10 p-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donnees} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="nom" tick={{ fill: "#F2EAD8", fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={50} />
          <YAxis tick={{ fill: "#F2EAD8", fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#16324A", border: "1px solid rgba(79,195,217,0.3)", borderRadius: 8 }}
            labelStyle={{ color: "#F2EAD8" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#F2EAD8" }} />
          <Bar dataKey="Beaucoup" stackId="a" fill="#1B7A72" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Peu" stackId="a" fill="#C99A3C" />
          <Bar dataKey="Rien" stackId="a" fill="#8A5A3A" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
