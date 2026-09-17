import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const runtime = getRuntimeEnv();
  let database: "up" | "down" = "down";

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch {
    database = "down";
  }

  const ok = database === "up" && (runtime.env === "local" || runtime.ok);

  return NextResponse.json(
    {
      ok,
      env: runtime.env,
      surface: "public",
      database,
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "cache-control": "no-store",
        "x-app-env": runtime.env,
      },
    }
  );
}
