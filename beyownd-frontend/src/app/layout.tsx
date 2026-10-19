import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import { MotionProvider } from "@/components/motion/motion-provider";
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
  metadataBase: new URL("https://beyownd.in"),
  title: {
    default: "Beyownd: Virtual internships your college can trust",
    template: "%s · Beyownd",
  },
  description:
    "Project-based virtual internship programs for final-year students. Learn step by step, build a mentor-reviewed project, and get a certificate anyone can verify.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-dvh">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
