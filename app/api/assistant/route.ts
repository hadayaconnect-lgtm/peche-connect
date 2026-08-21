import { NextRequest, NextResponse } from "next/server";

// Route serveur — la clé API n'est jamais exposée au client.
// Variable d'environnement requise sur Vercel : ANTHROPIC_API_KEY
// (Project Settings > Environment Variables)

export async function POST(req: NextRequest) {
  try {
    const { message, contexteZones, historique } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          reponse:
            "L'assistant IA n'est pas encore configuré : ajoutez la variable d'environnement ANTHROPIC_API_KEY dans les paramètres du projet Vercel.",
        },
        { status: 200 }
      );
    }

    const systemPrompt = `Tu es l'assistant IA de Pêche Connect, une application destinée aux pêcheurs artisanaux du Golfe de Tadjoura (Djibouti).
Tu réponds TOUJOURS dans la même langue que le pêcheur t'écrit — français, somali (af-Soomaali), ou arabe. Détecte la langue automatiquement à partir de son message. Si le message est ambigu ou mixte, réponds en français par défaut.
En somali, utilise un langage simple et direct, adapté à un pêcheur, pas une traduction académique ou trop formelle.
Réponds de manière courte et directe (2-4 phrases maximum), comme si tu parlais à un pêcheur au téléphone.
Tu t'appuies UNIQUEMENT sur les données de zones fournies ci-dessous pour recommander où pêcher, jamais sur des inventions.
Si la mer est dangereuse (vague >= 2.2m ou vent >= 35 km/h) dans une zone, préviens-en clairement avant toute autre recommandation — même si le potentiel de pêche y est bon.
Ne dis jamais qu'un score représente une probabilité réelle de présence de poisson : utilise toujours "potentiel de pêche" ou "conditions favorables" (ou l'équivalent dans la langue de réponse).
Si le score d'une zone est "indisponible", dis-le clairement plutôt que d'inventer une recommandation pour cette zone.
Précise que le vent et l'état de la mer sont des estimations (pas des mesures réelles) si le pêcheur pose une question sur la sécurité.
Sois concret : distance depuis le port, direction, niveau de confiance.

Données actuelles des zones (température et chlorophylle réelles Copernicus quand disponibles ; vent/vagues toujours estimés) :
${JSON.stringify(contexteZones, null, 2)}`;

    const messages = [
      ...(historique || []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const erreur = await response.text();
      console.error("Erreur API Anthropic:", erreur);
      return NextResponse.json(
        { reponse: "Désolé, l'assistant est momentanément indisponible. Réessayez dans un instant." },
        { status: 200 }
      );
    }

    const data = await response.json();
    const texte = data.content?.find((b: { type: string }) => b.type === "text")?.text || "";

    return NextResponse.json({ reponse: texte });
  } catch (err) {
    console.error("Erreur route assistant:", err);
    return NextResponse.json(
      { reponse: "Une erreur est survenue. Réessayez." },
      { status: 200 }
    );
  }
}
