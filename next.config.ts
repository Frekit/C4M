import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma no se empaqueta: si el servidor sigue vivo tras un generate,
  // el DMMF viejo deja prisma.client en undefined.
  serverExternalPackages: ["@prisma/client", "prisma"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
