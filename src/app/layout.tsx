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

// El saludo del Centro de acciones es el texto más grande de /.
// Solo se precarga este corte (latin, 400). El resto llega sin preload.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
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
