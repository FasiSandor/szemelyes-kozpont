import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Személyes Központ",
    short_name: "Központ",
    description: "Személyes, családi és vállalkozói digitális központ",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0F14",
    theme_color: "#0B0F14",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
