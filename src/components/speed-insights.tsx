"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

import { redactPublicTokens } from "@/lib/redact-public-url";

export function AppSpeedInsights() {
  return (
    <SpeedInsights
      beforeSend={(event) => ({
        ...event,
        url: redactPublicTokens(event.url),
        route: event.route ? redactPublicTokens(event.route) : event.route,
      })}
    />
  );
}
