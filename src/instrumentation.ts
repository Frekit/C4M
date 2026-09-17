export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { inspectRuntimeEnv } = await import("@/lib/runtime-env");
  const report = inspectRuntimeEnv();

  for (const issue of report.issues) {
    const line = `[env:${report.env}] ${issue.message}`;
    if (issue.level === "error") console.error(line);
    else console.warn(line);
  }

  if (report.env !== "local" && !report.ok) {
    throw new Error(
      `Este proceso no arranca: el entorno ${report.env} no es seguro. Mira docs/environments.md.`
    );
  }
}
