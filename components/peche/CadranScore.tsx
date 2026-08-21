"use client";

import { NiveauScore } from "@/lib/peche/types";

const COULEURS: Record<NiveauScore, string> = {
  favorable: "#1B7A72",
  moyen: "#C99A3C",
  deconseille: "#8A5A3A",
  danger: "#E85D3D",
};

const LIBELLES: Record<NiveauScore, string> = {
  favorable: "Favorable",
  moyen: "Moyen",
  deconseille: "Déconseillé",
  danger: "Danger",
};

export default function CadranScore({
  score,
  niveau,
  taille = 96,
}: {
  score: number | null;
  niveau: NiveauScore;
  taille?: number;
}) {
  const scoreAffiche = score ?? 0;
  const rayon = 40;
  const circonference = Math.PI * rayon; // demi-cercle
  const progression = (scoreAffiche / 100) * circonference;
  const angle = -90 + (scoreAffiche / 100) * 180;
  const couleur = score === null ? "#5a6a78" : COULEURS[niveau];

  return (
    <div className="flex flex-col items-center" style={{ width: taille }}>
      <svg width={taille} height={taille * 0.62} viewBox="0 0 100 62">
        {/* Arc de fond */}
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke="#16324A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Arc de score */}
        <path
          d="M 10 55 A 40 40 0 0 1 90 55"
          fill="none"
          stroke={couleur}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={score === null ? `0 ${circonference}` : `${progression} ${circonference}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
        {/* Aiguille */}
        <g transform={`rotate(${angle} 50 55)`} style={{ transition: "transform 0.6s ease" }}>
          <line x1="50" y1="55" x2="50" y2="20" stroke="#F2EAD8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="50" cy="55" r="3.5" fill="#F2EAD8" />
        </g>
      </svg>
      <div className="-mt-1 text-center">
        <div className="font-mono text-xl font-semibold" style={{ color: couleur }}>
          {score === null ? "N/D" : score}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-sand-foam/70">
          {score === null ? "Indisponible" : LIBELLES[niveau]}
        </div>
      </div>
    </div>
  );
}
