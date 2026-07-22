import { isTikTokCdnUrl } from "../../src/utils/tiktokCdn.js";

export const TIKTOK_THUMBNAIL_FETCH_TIMEOUT_MS = 8000;
export const TIKTOK_THUMBNAIL_MAX_BYTES = 8 * 1024 * 1024;

const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// TikTok CDNの署名付きサムネイルをSSRF対策付きで取得する。
// 呼び出し元から渡されるURLは信頼せず、許可ドメイン・リダイレクト先・タイムアウト・
// サイズ上限・content-typeを毎回検証してから初めてバイト列を返す。
// 任意のURLを取得できる汎用プロキシにはしない。
export async function fetchTikTokThumbnail(
  url,
  {
    fetchImpl = fetch,
    timeoutMs = TIKTOK_THUMBNAIL_FETCH_TIMEOUT_MS,
    maxBytes = TIKTOK_THUMBNAIL_MAX_BYTES,
  } = {}
) {
  if (!isTikTokCdnUrl(url)) return { ok: false, status: 400, error: "invalid_domain" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let currentUrl = url;
    let response = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isTikTokCdnUrl(currentUrl)) return { ok: false, status: 400, error: "redirect_outside_allowlist" };
      const res = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": MOBILE_USER_AGENT, accept: "image/*" },
      });
      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, status: 502, error: "redirect_without_location" };
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      response = res;
      break;
    }
    if (!response) return { ok: false, status: 508, error: "too_many_redirects" };
    if (!response.ok) return { ok: false, status: 502, error: "upstream_error" };

    const contentType = response.headers.get("content-type") || "";
    if (!/^image\//i.test(contentType)) return { ok: false, status: 415, error: "unsupported_content_type" };

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > maxBytes) return { ok: false, status: 413, error: "payload_too_large" };

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return { ok: false, status: 413, error: "payload_too_large" };

    return { ok: true, buffer: Buffer.from(arrayBuffer), contentType };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, status: 504, error: "timeout" };
    return { ok: false, status: 502, error: "fetch_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
