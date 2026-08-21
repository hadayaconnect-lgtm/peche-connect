import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import RegistreServiceWorker from "@/components/peche/RegistreServiceWorker";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Pêche Connect Djibouti",
  description:
    "Zones de pêche favorables et assistant IA pour les pêcheurs artisanaux du Golfe de Tadjoura",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pêche Connect",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F2E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans antialiased`}>
        <RegistreServiceWorker />
        {children}
      </body>
    </html>
  );
}
