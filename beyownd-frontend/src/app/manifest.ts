import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beyownd",
    short_name: "Beyownd",
    description: "Project-based virtual internships with certificates anyone can verify.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3157e8",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
