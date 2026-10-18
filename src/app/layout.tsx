import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "@/components/journey/journey.css";

// Self-hosted (SIL OFL, see fonts/OFL.txt) so builds and dev never depend on
// reaching Google Fonts. One variable file covers weights 400–800 for Spanish text.
const font = localFont({
  src: "./fonts/plus-jakarta-sans-latin.woff2",
  weight: "200 800",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Jala — Tu ruta, nuestro viaje",
    template: "%s · Jala",
  },
  description:
    "Jala te conecta con otras personas que salen del mismo lugar —universidad, centro comercial, concierto— para compartir taxi y dividir el costo.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12343B",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${font.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
