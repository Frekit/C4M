import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppNav } from "@/components/app-nav";
import { EnvironmentBanner } from "@/components/environment-banner";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth/session";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <EnvironmentBanner />
        <AppNav user={user} />
        <div className="flex flex-1 flex-col">{children}</div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
