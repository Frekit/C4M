import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";

import { EnvironmentBanner } from "@/components/environment-banner";
import { AppSpeedInsights } from "@/components/speed-insights";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getRuntimeEnv } from "@/lib/runtime-env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// El saludo (display-30, peso 500) es el LCP de /. Se precarga solo el corte
// latin de ese peso; el saludo no usa latin-ext. `swap` pinta el fallback de
// inmediato: `optional` dejaba el titular invisible y el LCP subía.
// El ajuste automático de next/font usa local("Times New Roman") y las
// métricas del peso 400. En este laboratorio Times no está instalada, el
// fallback no llega a aplicarse y el swap cambia el tamaño del h1. El
// fallback calibrado al peso 500 está en globals.css.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: ["Newsreader Adjusted", "serif"],
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider delay={400}>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
            >
              Saltar al contenido
            </a>
            <EnvironmentBanner />
            {children}
            <Toaster position="top-right" />
            <AppSpeedInsights />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
