import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { EnvironmentBanner } from "@/components/environment-banner";
import { Toaster } from "@/components/ui/sonner";
import { getRuntimeEnv } from "@/lib/runtime-env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const runtime = getRuntimeEnv();
  return {
    title: {
      default: "Contratos con creators",
      template: "%s · Contratos con creators",
    },
    description:
      "Registro de influencers, contratos con firma y seguimiento de contenidos entregados.",
    robots: runtime.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
        >
          Saltar al contenido
        </a>
        <EnvironmentBanner />
        {children}
        <Toaster position="top-right" />
        <SpeedInsights />
      </body>
    </html>
  );
}
