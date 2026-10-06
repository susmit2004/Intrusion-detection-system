import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
