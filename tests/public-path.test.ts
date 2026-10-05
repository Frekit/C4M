import assert from "node:assert/strict";
import { test } from "node:test";

import { isPublicPath } from "@/proxy";

test("isPublicPath('/invitacion/x') deja pasar el enlace de invitación", () => {
  assert.equal(isPublicPath("/invitacion/x"), true);
  assert.equal(isPublicPath("/invitacion"), true);
  assert.equal(isPublicPath("/campanas"), false);
  assert.equal(isPublicPath("/invitaciones"), false);
});
