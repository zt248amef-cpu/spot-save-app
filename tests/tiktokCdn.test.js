import test from "node:test";
import assert from "node:assert/strict";
import { isTikTokCdnUrl } from "../src/utils/tiktokCdn.js";

test("accepts known TikTok CDN domains (and subdomains) over https", () => {
  assert.equal(isTikTokCdnUrl("https://p16-sign-va.tiktokcdn.com/foo.jpeg"), true);
  assert.equal(isTikTokCdnUrl("https://p16-sign.tiktokcdn-us.com/foo.jpeg"), true);
  assert.equal(isTikTokCdnUrl("https://p16-va-tt.byteoversea.com/foo.jpeg"), true);
  assert.equal(isTikTokCdnUrl("https://tiktokcdn.com/foo.jpeg"), true);
});

test("rejects non-https and non-TikTok hosts", () => {
  assert.equal(isTikTokCdnUrl("http://p16-sign-va.tiktokcdn.com/foo.jpeg"), false);
  assert.equal(isTikTokCdnUrl("https://example.com/foo.jpeg"), false);
  assert.equal(isTikTokCdnUrl("https://www.tiktok.com/@user/video/1"), false);
});

test("rejects domain-spoofing lookalikes", () => {
  assert.equal(isTikTokCdnUrl("https://tiktokcdn.com.evil.com/foo.jpeg"), false);
  assert.equal(isTikTokCdnUrl("https://evil-tiktokcdn.com/foo.jpeg"), false);
  assert.equal(isTikTokCdnUrl("https://tiktokcdn.com.attacker.net/x"), false);
});

test("safely rejects empty, non-string, and non-URL input", () => {
  assert.equal(isTikTokCdnUrl(""), false);
  assert.equal(isTikTokCdnUrl(null), false);
  assert.equal(isTikTokCdnUrl(undefined), false);
  assert.equal(isTikTokCdnUrl(123), false);
  assert.equal(isTikTokCdnUrl("not a url"), false);
});
