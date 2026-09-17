import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteHeader } from "@/components/site-header";
import { getAuthMode } from "@/lib/auth/config";
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
    default: "Foundations",
    template: "%s · Foundations",
  },
  description:
    "Base de la aplicación: Next.js, TypeScript y autenticación con Auth0.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, authMode] = await Promise.all([
    getCurrentUser(),
    Promise.resolve(getAuthMode()),
  ]);

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader user={user} authMode={authMode} />
        <div className="flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
