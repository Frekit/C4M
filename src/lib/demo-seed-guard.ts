// El seed de demostración es opt-in y solo para la base local.
// No debe ejecutarse en producción ni contra Postgres.

export function assertDemoSeedAllowed(env: {
  NODE_ENV?: string;
  DATABASE_URL?: string;
}) {
  if (env.NODE_ENV === "production") {
    throw new Error(
      "db:seed:demo no se ejecuta con NODE_ENV=production."
    );
  }

  const url = (env.DATABASE_URL ?? "").trim();
  const localSqlite = url.startsWith("file:") && !url.includes("postgres");
  if (!localSqlite) {
    throw new Error(
      "db:seed:demo solo acepta un SQLite local (DATABASE_URL file:…). Esta base no lo es."
    );
  }
}
