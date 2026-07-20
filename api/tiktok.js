import { extractTikTokLocation, extractTikTokPageMedia } from "./_lib/tiktokParser.js";

const TIMEOUT_MS = 8000;
const TIKTOK_HOST_PATTERN = /(^|\.)tiktok\.com$/i;
const TIKTOK_SHORT_HOST_PATTERN = /^(?:vt|vm)\.tiktok\.com$/i;
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function isTikTokUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && TIKTOK_HOST_PATTERN.test(url.hostname);
  } catch {
    return false;
  }
}
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveTikTokUrl(url) {
  const parsed = new URL(url);
  if (!TIKTOK_SHORT_HOST_PATTERN.test(parsed.hostname)) return url;
  const response = await fetchWithTimeout(url, {
    method: "HEAD",
    headers: { "user-agent": MOBILE_USER_AGENT },
  });
  const resolvedUrl = response.url;
  if (!isTikTokUrl(resolvedUrl)) throw new Error("TikTok redirect resolved outside TikTok");
  return resolvedUrl;
}

async function fetchOEmbed(url) {
  const response = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error(`oEmbed returned ${response.status}`);
  const data = await response.json();
  return {
    thumbnailUrl: data.thumbnail_url || "",
    title: data.title || "",
    description: "",
    author: data.author_name || "",
    source: "tiktok_oembed",
  };
}

async function fetchPage(url) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "user-agent": MOBILE_USER_AGENT,
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`TikTok page returned ${response.status}`);
  const html = await response.text();
  return { media: extractTikTokPageMedia(html), location: extractTikTokLocation(html) };
}

function mergeMedia(oembed, page) {
  return {
    thumbnailUrl: oembed?.thumbnailUrl || page?.thumbnailUrl || "",
    title: oembed?.title || page?.title || "",
    description: page?.description || oembed?.description || "",
    author: oembed?.author || "",
    source: oembed?.thumbnailUrl ? oembed.source : page?.source || "tiktok_unavailable",
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });
  const url = Array.isArray(request.query?.url) ? request.query.url[0] : request.query?.url;
  if (!isTikTokUrl(url)) return response.status(400).json({ error: "invalid_tiktok_url" });

  let resolvedUrl = url;
  try {
    resolvedUrl = await resolveTikTokUrl(url);
  } catch {
    // Keep partial-success behavior: oEmbed/page fetches may still work with the original URL.
  }

  const [oembedResult, pageResult] = await Promise.allSettled([fetchOEmbed(resolvedUrl), fetchPage(resolvedUrl)]);
  const oembed = oembedResult.status === "fulfilled" ? oembedResult.value : null;
  const page = pageResult.status === "fulfilled" ? pageResult.value : null;
  return response.status(200).json({
    media: mergeMedia(oembed, page?.media),
    location: page?.location || { status: "unknown", candidates: [] },
  });
}
