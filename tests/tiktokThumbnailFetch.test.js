import test from "node:test";
import assert from "node:assert/strict";
import { fetchTikTokThumbnail } from "../api/_lib/tiktokThumbnailFetch.js";

function makeResponse({ status = 200, headers = {}, body = new Uint8Array([1, 2, 3]).buffer } = {}) {
  const headerMap = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (key) => headerMap.get(key.toLowerCase()) ?? null },
    arrayBuffer: async () => body,
  };
}

test("rejects a URL outside the TikTok CDN allowlist without making any request", async () => {
  let called = false;
  const result = await fetchTikTokThumbnail("https://example.com/image.jpg", {
    fetchImpl: async () => {
      called = true;
      return makeResponse();
    },
  });
  assert.equal(called, false);
  assert.deepEqual(result, { ok: false, status: 400, error: "invalid_domain" });
});

test("returns image bytes for a successful fetch from an allowlisted domain", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async () => makeResponse({ headers: { "content-type": "image/jpeg" } }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.contentType, "image/jpeg");
  assert.ok(Buffer.isBuffer(result.buffer));
});

test("rejects a non-image content-type (e.g. an HTML error/captcha page)", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async () => makeResponse({ headers: { "content-type": "text/html" } }),
  });
  assert.deepEqual(result, { ok: false, status: 415, error: "unsupported_content_type" });
});

test("treats an upstream 403 (expired TikTok signature) as an upstream error", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async () => makeResponse({ status: 403, headers: { "content-type": "text/plain" } }),
  });
  assert.deepEqual(result, { ok: false, status: 502, error: "upstream_error" });
});

test("treats an upstream 404 as an upstream error", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async () => makeResponse({ status: 404, headers: { "content-type": "text/plain" } }),
  });
  assert.deepEqual(result, { ok: false, status: 502, error: "upstream_error" });
});

test("rejects a redirect that points outside the allowlist (SSRF guard)", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async (currentUrl) => {
      if (currentUrl === "https://p16-sign-va.tiktokcdn.com/foo.jpeg") {
        return makeResponse({ status: 302, headers: { location: "https://evil.example.com/steal.jpg" } });
      }
      throw new Error("must not follow a redirect outside the allowlist");
    },
  });
  assert.deepEqual(result, { ok: false, status: 400, error: "redirect_outside_allowlist" });
});

test("follows a redirect that stays within the allowlist", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async (currentUrl) => {
      if (currentUrl === "https://p16-sign-va.tiktokcdn.com/foo.jpeg") {
        return makeResponse({ status: 302, headers: { location: "https://p16-sign-va.tiktokcdn.com/bar.jpeg" } });
      }
      return makeResponse({ headers: { "content-type": "image/jpeg" } });
    },
  });
  assert.equal(result.ok, true);
});

test("rejects a response whose body exceeds the configured size limit", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    maxBytes: 10,
    fetchImpl: async () =>
      makeResponse({ headers: { "content-type": "image/jpeg" }, body: new Uint8Array(20).buffer }),
  });
  assert.deepEqual(result, { ok: false, status: 413, error: "payload_too_large" });
});

test("rejects a declared content-length above the size limit before reading the body", async () => {
  let bodyRead = false;
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    maxBytes: 10,
    fetchImpl: async () => {
      const res = makeResponse({ headers: { "content-type": "image/jpeg", "content-length": "999" } });
      const originalArrayBuffer = res.arrayBuffer;
      res.arrayBuffer = async () => {
        bodyRead = true;
        return originalArrayBuffer();
      };
      return res;
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.equal(bodyRead, false);
});

test("treats an aborted/timed-out fetch as a timeout error", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    timeoutMs: 5,
    fetchImpl: () =>
      new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, 20);
      }),
  });
  assert.deepEqual(result, { ok: false, status: 504, error: "timeout" });
});

test("treats a generic network failure as fetch_failed", async () => {
  const result = await fetchTikTokThumbnail("https://p16-sign-va.tiktokcdn.com/foo.jpeg", {
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });
  assert.deepEqual(result, { ok: false, status: 502, error: "fetch_failed" });
});
