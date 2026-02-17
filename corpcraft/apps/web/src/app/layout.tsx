import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// ──────────────────────────────────────────────
// Root Layout — CorpCraft OS V4.2
// ──────────────────────────────────────────────

export const metadata: Metadata = {
  title: "CorpCraft OS",
  description:
    "Isometric swarm-intelligence operating system — monitor, command, and orchestrate AI agent squads in real time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Redeviation)
    // inject attributes like data-redeviation-bs-uid into <html>,
    // causing a harmless hydration mismatch. Suppress it.
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
