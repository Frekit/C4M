import assert from "node:assert/strict";
import { test } from "node:test";

import { assertDemoSeedAllowed } from "@/lib/demo-seed-guard";

test("acepta un SQLite local fuera de producción", () => {
  assert.doesNotThrow(() =>
    assertDemoSeedAllowed({
      NODE_ENV: "development",
      DATABASE_URL: "file:./dev.db",
    })
  );
});

test("aborta en producción", () => {
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "production",
        DATABASE_URL: "file:./dev.db",
      }),
    /NODE_ENV=production/
  );
});

test("aborta si la base no es SQLite local", () => {
  assert.throws(
    () =>
      assertDemoSeedAllowed({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@ep-example.neon.tech/c4m",
      }),
    /SQLite local/
  );
  assert.throws(
    () => assertDemoSeedAllowed({ NODE_ENV: "test", DATABASE_URL: "" }),
    /SQLite local/
  );
});
