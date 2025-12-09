import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verkeerslichtenviewer - Slimme Verkeerslichten Nederland",
  description: "Interactieve kaart van intelligente verkeerslichten (iVRI) in Nederland. Bekijk locaties, prioriteitsklassen en statistieken van het UDAP netwerk.",
  keywords: ["UDAP", "iVRI", "verkeerslichten", "Nederland", "smart traffic lights", "Talking Traffic"],
  authors: [{ name: "Verkeerslichtenviewer" }],
  openGraph: {
    title: "Verkeerslichtenviewer - Slimme Verkeerslichten Nederland",
    description: "Interactieve kaart van intelligente verkeerslichten (iVRI) in Nederland",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
