CLAUDE.md

Projektziel

Baue eine mobile Progressive Web App, mit der ich URLs von bestehenden Webseiten, z. B. Bars, Restaurants oder Clubs, einfügen kann. Aus dieser URL soll automatisch mit der Stitch API eine neue mobile Landingpage erstellt werden.

Diese Landingpage muss nicht vollständig funktional sein. Das Wichtigste ist, dass sie auf dem Handy sehr gut aussieht, modern wirkt und dem Design von style.png ähnelt.

Zusätzlich sollen alle erstellten Webseiten über einen einzigen, immer gleichen QR-Code erreichbar sein.

Grundidee

Ich lasse Karteikarten drucken. Auf allen Karteikarten ist derselbe QR-Code.

Wenn ein Nutzer diesen QR-Code scannt, kommt er auf eine zentrale mobile Webseite. Dort sieht er ein Dropdown-Menü mit allen Webseiten, die bisher über mein Programm erstellt wurden.

Der Nutzer kann im Dropdown eine Webseite auswählen und diese direkt auf dem Handy anschauen.

Hauptfunktionen

1. Mobile Web App / PWA

Die App soll als mobile-first Progressive Web App gebaut werden.

Wichtig:

* Optimiert für Smartphone
* Sehr schönes Design
* Schnelle Ladezeit
* App-ähnliches Gefühl
* Responsive Layout
* Fokus auf Optik, nicht auf perfekte Funktionalität

2. URL einfügen

In der Admin-Ansicht soll ich eine URL einfügen können.

Beispiel:

https://beispiel-bar.ch

Danach soll das System aus dieser URL eine neue mobile Landingpage generieren.

3. Stitch API Integration

Die Stitch API soll verwendet werden, um aus der eingegebenen URL bzw. aus den daraus gewonnenen Informationen eine schöne mobile Webseite zu erstellen.

Die generierte Seite soll:

* mobile-first sein
* wie eine hochwertige digitale Visitenkarte wirken
* optisch stark an style.png angelehnt sein
* modern, clean und edel aussehen
* nicht zwingend alle echten Funktionen der Originalseite übernehmen
* Hauptinformationen schön darstellen

Mögliche Inhalte:

* Name der Bar / Firma
* kurze Beschreibung
* Bilder, falls verfügbar
* Adresse
* Öffnungszeiten
* Social Links
* Call-to-Action Buttons
* Google Maps Link
* Kontaktbutton

4. GitHub Repository erstellen

Für jede generierte Webseite soll automatisch ein neues GitHub Repository erstellt werden.

Namensschema zum Beispiel:

generated-site-[slug]

Beispiel:

generated-site-bar-milano

5. Deployment auf Vercel

Nach der Erstellung soll die Webseite automatisch auf Vercel deployed werden.

Nach dem Deployment wird die finale Vercel-URL gespeichert.

Beispiel:

https://bar-milano.vercel.app

6. Zentrale QR-Code Webseite

Es soll eine zweite Webseite geben. Diese ist die Hauptseite, auf die der QR-Code zeigt.

Diese Seite enthält:

* Logo / Titel
* kurzes Intro
* Dropdown-Menü mit allen generierten Webseiten
* mobile Vorschau oder direkter Link
* Button: „Webseite öffnen“

Der QR-Code bleibt immer gleich, weil er immer auf diese zentrale Seite zeigt.

Beispiel:

https://digitalframe-main.vercel.app

User Flow

1. Ich entdecke eine Webseite von einer Bar oder Firma.
2. Ich kopiere die URL.
3. Ich öffne meine mobile Web App.
4. Ich füge die URL ein.
5. Die App erstellt über Stitch eine neue schöne mobile Version.
6. Das System erstellt ein GitHub Repository.
7. Das System deployed die Seite auf Vercel.
8. Die neue Webseite wird in der zentralen QR-Code-Webseite gespeichert.
9. Ein Nutzer scannt den QR-Code.
10. Er sieht ein Dropdown mit allen Webseiten.
11. Er wählt eine Webseite aus.
12. Er schaut sie auf dem Handy an.

Design-Anforderungen

Sehr wichtig: Das Design muss sich an style.png orientieren.

Claude soll style.png im Projektordner analysieren und daraus folgende Elemente ableiten:

* Farben
* Abstände
* Rundungen
* Schatten
* Typografie
* Karten-Design
* Button-Stil
* Hintergrundstil
* allgemeine Stimmung

Priorität:

1. Mobile Design
2. Optik
3. Ähnlichkeit zu style.png
4. einfache Bedienung
5. saubere Struktur

Die Webseiten müssen nicht perfekt funktionieren, aber sie müssen auf dem Handy professionell aussehen.

Technischer Vorschlag

Verwende bevorzugt:

* Next.js
* TypeScript
* Tailwind CSS
* Vercel
* GitHub API
* Stitch API / Stitch SDK
* einfache Datenbank, z. B. Supabase, SQLite oder Vercel KV

Datenmodell

Jede generierte Webseite soll ungefähr so gespeichert werden:

type GeneratedSite = {
  id: string
  name: string
  originalUrl: string
  slug: string
  githubRepoUrl: string
  vercelUrl: string
  createdAt: string
  status: "generating" | "deployed" | "failed"
}

Seitenstruktur

/admin

Admin-Seite zum Einfügen neuer URLs.

Funktionen:

* URL Input
* Button „Webseite generieren“
* Statusanzeige
* Liste aller generierten Webseiten

/

Zentrale QR-Code-Seite.

Funktionen:

* Dropdown mit allen generierten Webseiten
* Button zum Öffnen
* schöne mobile Darstellung

/preview/[slug]

Optional: lokale Vorschau der generierten Webseite.

Wichtige Regeln für Claude

* Arbeite mobile-first.
* Frage nicht unnötig nach, sondern triff sinnvolle Entscheidungen.
* Verwende style.png als wichtigste Designreferenz.
* Schreibe sauberen, wartbaren Code.
* Baue zuerst einen funktionierenden MVP.
* Die Webseiten müssen optisch stark sein, auch wenn sie technisch simpel sind.
* Keine überkomplizierte Architektur.
* Sicherheit beachten: API Keys niemals im Frontend sichtbar machen.
* GitHub Token, Vercel Token und Stitch API Key nur serverseitig verwenden.
* Fehler sauber anzeigen.
* Generierte Webseiten sollen als statische Webseiten deploybar sein.

Environment Variables

Folgende Variablen sollen verwendet werden:

STITCH_API_KEY=
GITHUB_TOKEN=
VERCEL_TOKEN=
VERCEL_TEAM_ID=
DATABASE_URL=
NEXT_PUBLIC_MAIN_SITE_URL=

MVP-Ziel

Baue zuerst diese Version:

1. Admin-Seite mit URL Input
2. Stitch-Prompt aus URL erzeugen
3. Mobile HTML-Seite generieren
4. GitHub Repo erstellen
5. Auf Vercel deployen
6. Deployment-URL speichern
7. Zentrale QR-Seite mit Dropdown anzeigen

Beispiel-Prompt für Stitch

Erzeuge eine mobile Landingpage für folgende Webseite:

URL: [URL]

Die Seite soll wie eine moderne digitale Visitenkarte aussehen. Sie soll optisch an die Datei style.png angelehnt sein. Verwende ähnliche Farben, Rundungen, Schatten, Abstände und Karten-Layouts. Die Seite muss auf dem Smartphone sehr hochwertig aussehen.

Inhalte:

* Name der Bar oder Firma
* kurze Beschreibung
* Adresse
* Öffnungszeiten
* Kontakt
* Social Links
* schöner Call-to-Action Button

Die Seite muss nicht vollständig funktional sein. Priorität ist ein schönes mobiles Design.

Ergebnis

Am Ende soll ich ein System haben, mit dem ich schnell aus beliebigen Webseiten schöne mobile Versionen erstellen kann. Alle Versionen sind über denselben QR-Code erreichbar und können über ein Dropdown ausgewählt werden.