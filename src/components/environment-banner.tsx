import { getRuntimeEnv, envLabel } from "@/lib/runtime-env";

export function EnvironmentBanner() {
  const runtime = getRuntimeEnv();
  if (runtime.env !== "pre") return null;

  return (
    <div className="border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-950 dark:text-amber-100">
      {envLabel(runtime.env)} — datos y correos de prueba. No es la campaña
      real.
    </div>
  );
}
