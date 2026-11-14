import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PUFF SAUDI",
    short_name: "PUFF",
    description: "أكواب بف — لونك، مزاجك، مشروبك",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F1E8",
    theme_color: "#0B0B0C",
    lang: "ar",
    dir: "rtl",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
