import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AppNav } from "@/components/app-nav";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth/session";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Contratos con creators",
    template: "%s · Contratos con creators",
  },
  description:
    "Registro de influencers, contratos con firma y seguimiento de contenidos entregados.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <AppNav user={user} />
        <div className="flex flex-1 flex-col">{children}</div>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
