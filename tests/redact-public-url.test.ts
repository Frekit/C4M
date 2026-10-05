import assert from "node:assert/strict";
import { test } from "node:test";

import { redactPublicTokens } from "@/lib/redact-public-url";

test("quita el token de firmar, hablar e invitación", () => {
  assert.equal(
    redactPublicTokens("https://app.example/firmar/secreto"),
    "https://app.example/firmar"
  );
  assert.equal(
    redactPublicTokens("https://app.example/firmar/secreto/documento"),
    "https://app.example/firmar/documento"
  );
  assert.equal(
    redactPublicTokens("https://app.example/hablar/otro?x=1"),
    "https://app.example/hablar?x=1"
  );
  assert.equal(
    redactPublicTokens("/invitacion/token-largo"),
    "/invitacion"
  );
});

test("deja intactas el resto de rutas", () => {
  assert.equal(
    redactPublicTokens("https://app.example/campanas/abc"),
    "https://app.example/campanas/abc"
  );
  assert.equal(redactPublicTokens("/firmar"), "/firmar");
});
