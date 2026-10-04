import assert from "node:assert/strict";
import { test } from "node:test";

import {
  auth0CallbackDetail,
  auth0LoginAlert,
  rewriteLoopbackUrl,
} from "@/lib/auth/loopback";

test("127.0.0.1 y ::1 pasan a localhost y conservan puerto y query", () => {
  const ipv4 = rewriteLoopbackUrl(
    new URL("http://127.0.0.1:43127/auth/callback?code=abc")
  );
  assert.equal(ipv4?.origin, "http://localhost:43127");
  assert.equal(ipv4?.pathname, "/auth/callback");
  assert.equal(ipv4?.searchParams.get("code"), "abc");

  const ipv6 = rewriteLoopbackUrl(new URL("http://[::1]:43127/auth/login"));
  assert.equal(ipv6?.hostname, "localhost");
  assert.equal(ipv6?.port, "43127");
  assert.equal(
    rewriteLoopbackUrl(new URL("http://127.0.0.1:43127/iniciar-sesion")),
    null
  );

  assert.equal(rewriteLoopbackUrl(new URL("http://localhost:43127/")), null);
});

test("si nextUrl ya es localhost pero el Host es 127.0.0.1, también reescribe", () => {
  const rewritten = rewriteLoopbackUrl(
    new URL("http://localhost:43127/auth/login"),
    "127.0.0.1:43127"
  );
  assert.equal(rewritten?.origin, "http://localhost:43127");
  assert.equal(rewritten?.pathname, "/auth/login");
  assert.equal(
    rewriteLoopbackUrl(new URL("http://localhost:43127/"), "localhost:43127"),
    null
  );
});

test("el error de Organization explica el cambio en el dashboard", () => {
  const alert = auth0LoginAlert(
    "client requires organization membership, but user does not belong to any organization"
  );
  assert.equal(alert.title, "Auth0 exige una Organization");
  assert.match(alert.description, /Individuals/);
});

test("el detalle del callback prioriza la causa de Auth0", () => {
  assert.equal(
    auth0CallbackDetail({
      message: "An error occurred during the authorization flow.",
      cause: { message: "Callback URL mismatch." },
    }),
    "Callback URL mismatch."
  );
  assert.equal(
    auth0CallbackDetail({
      message: "The state parameter is invalid.",
    }),
    "The state parameter is invalid."
  );
});
