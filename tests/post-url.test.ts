import assert from "node:assert/strict";
import { test } from "node:test";

import { duplicatePostUrlError, postUrlKey } from "@/lib/domain/post-url";

test("vacío o espacios no generan clave", () => {
  assert.equal(postUrlKey(""), null);
  assert.equal(postUrlKey("   "), null);
  assert.equal(postUrlKey(null), null);
});

test("Instagram trata /p, /reel y utm como el mismo post", () => {
  const key = "instagram.com/p/AbC123";
  assert.equal(postUrlKey("https://www.instagram.com/p/AbC123/"), key);
  assert.equal(
    postUrlKey("http://instagram.com/reel/AbC123/?igsh=xyz&utm_source=ig"),
    key
  );
  assert.equal(postUrlKey("https://www.instagram.com/reels/AbC123"), key);
});

test("un YouTube y su youtu.be coinciden", () => {
  const key = "youtube.com/watch/dQw4w9wgGcQ";
  assert.equal(
    postUrlKey("https://www.youtube.com/watch?v=dQw4w9wgGcQ&feature=share"),
    key
  );
  assert.equal(postUrlKey("https://youtu.be/dQw4w9wgGcQ"), key);
  assert.equal(postUrlKey("https://youtube.com/shorts/dQw4w9wgGcQ"), key);
});

test("TikTok ignora el handle y se queda con el id del vídeo", () => {
  assert.equal(
    postUrlKey("https://www.tiktok.com/@ana/video/1234567890?utm_source=tt"),
    "tiktok.com/video/1234567890"
  );
});

test("una URL genérica pierde www, barra final y utm", () => {
  assert.equal(
    postUrlKey("https://www.ejemplo.com/post/uno/?utm_campaign=x"),
    "ejemplo.com/post/uno"
  );
});

test("el mensaje nombra creator, contrato y número", () => {
  assert.equal(
    duplicatePostUrlError({
      position: 2,
      contract: { code: "HF-104", creator: { handle: "ana" } },
    }),
    "Ese enlace ya está en @ana · HF-104 · contenido nº 2."
  );
});
