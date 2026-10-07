import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

const themeInitializationScript = `(()=>{let theme;try{theme=localStorage.getItem("soc-dashboard-theme")}catch{}if(theme!=="light"&&theme!=="dark"){theme=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}const root=document.documentElement;root.dataset.theme=theme;root.style.colorScheme=theme})()`;

export const metadata: Metadata = {
  title: "IDS Dashboard — Network Intrusion Detection",
  description:
    "Confidence-Based Hybrid ML Framework for SOC Alert Triage · CIC-IDS-2017 · Suricata Testbed · MCA Project",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="soc-theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
