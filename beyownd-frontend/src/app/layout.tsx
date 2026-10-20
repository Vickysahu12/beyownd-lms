import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
import { JsonLd, organization } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// One family for everything (monday-style system): light 300 for display,
// 400 body, 500/600 for UI labels and buttons.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Credential IDs, prices in tables, small technical labels
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Beyownd | Virtual internships your college can trust",
    template: "%s | Beyownd",
  },
  description:
    "Project-based virtual internship programs for final-year students in India. Learn step by step, build a mentor-reviewed project, and get a certificate anyone can verify.",
  applicationName: "Beyownd",
  openGraph: { siteName: "Beyownd", locale: "en_IN", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-IN"
      className={`${poppins.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <JsonLd
          data={[
            { "@context": "https://schema.org", ...organization },
            { "@context": "https://schema.org", "@type": "WebSite", name: "Beyownd", url: SITE_URL },
          ]}
        />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
