import { Libertinus_Mono, Libertinus_Sans, Libertinus_Serif } from "next/font/google";
import "./globals.css";

// Libertinus is the lightpaper's typeface. Serif for display and prose, sans for labels and
// numbers, mono only for code identifiers. next/font has no fallback metrics for Libertinus,
// so the fallbacks are named by hand and the automatic size adjustment is turned off.
const serif = Libertinus_Serif({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
  adjustFontFallback: false,
});
const sans = Libertinus_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-sans",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
});
const mono = Libertinus_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
  adjustFontFallback: false,
});

const description = "Halal leverage for traders. Real yield for depositors. No interest anywhere.";

export const metadata = {
  metadataBase: new URL("https://sacred-protocol.vercel.app"),
  title: { default: "Sacred", template: "%s | Sacred" },
  description,
  openGraph: { title: "Sacred", description, type: "website", siteName: "Sacred" },
  twitter: { card: "summary_large_image", title: "Sacred", description },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
