import type { MetadataRoute } from "next";

import { getRuntimeEnv } from "@/lib/runtime-env";

export default function robots(): MetadataRoute.Robots {
  const runtime = getRuntimeEnv();

  if (runtime.noIndex) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/firmar/", "/iniciar-sesion", "/estado", "/auditoria"],
    },
  };
}
