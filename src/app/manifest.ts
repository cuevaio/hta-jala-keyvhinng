import type { MetadataRoute } from "next";

/** Makes Jala installable, which iOS requires before it allows Web Push. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jala",
    short_name: "Jala",
    description:
      "Comparte taxi con personas que salen del mismo lugar y divide el costo.",
    lang: "es-PE",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#12343B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
