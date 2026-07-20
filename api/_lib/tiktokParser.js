const PLACE_PATH_PATTERN = /\/(?:place|location|poi)(?:\/|\?|$)/i;
const MAP_HOST_PATTERN = /(?:google\.[^/]+\/maps|maps\.apple\.com|maps\.app\.goo\.gl)/i;
const PLACE_KEY_PATTERN = /(?:poi|place|location|address|venue)/i;
const LAT_KEY_PATTERN = /^(?:lat|latitude)$/i;
const LNG_KEY_PATTERN = /^(?:lng|lon|longitude)$/i;

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanText(value) {
  return typeof value === "string" ? decodeHtml(value).replace(/\s+/g, " ").trim() : "";
}

function asCoordinate(value, min, max) {
  const number = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function confidenceFor(candidate) {
  if (candidate.placeUrl && candidate.placeName) return "high";
  if (candidate.address || candidate.latitude != null) return "high";
  if (candidate.placeUrl || candidate.placeName) return "medium";
  return "low";
}

function normalizeCandidate(candidate) {
  const normalized = {
    placeName: cleanText(candidate.placeName).slice(0, 200),
    placeUrl: cleanText(candidate.placeUrl).slice(0, 2000),
    address: cleanText(candidate.address).slice(0, 300),
    latitude: asCoordinate(candidate.latitude, -90, 90),
    longitude: asCoordinate(candidate.longitude, -180, 180),
    source: candidate.source || "tiktok_embedded_data",
  };
  normalized.confidence = confidenceFor(normalized);
  return normalized;
}

function normalizeAddress(...values) {
  const parts = values
    .flatMap((value) => {
      if (typeof value === "string") return [value];
      if (!value || typeof value !== "object") return [];
      return [value.streetAddress, value.addressLocality, value.addressRegion, value.addressCountry];
    })
    .map(cleanText)
    .filter(Boolean);
  return [...new Set(parts)].join(" ");
}

function buildTikTokPlaceUrl(name, id) {
  const cleanName = cleanText(name);
  const cleanId = cleanText(id);
  if (!cleanName || !cleanId) return "";
  const slug = encodeURIComponent(cleanName.replace(/\s+/g, "-"));
  return `https://www.tiktok.com/place/${slug}-${encodeURIComponent(cleanId)}`;
}

function extractHydrationCandidates(html) {
  const candidates = [];
  const hydrationPattern = /<script\b[^>]*\bid=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(hydrationPattern)) {
    try {
      const data = JSON.parse(match[1]);
      const itemStruct = data?.__DEFAULT_SCOPE__?.["webapp.reflow.video.detail"]?.itemInfo?.itemStruct;
      const poi = itemStruct?.poi;
      if (!poi || typeof poi !== "object") continue;
      const address = normalizeAddress(poi.address, poi.city, poi.province, itemStruct?.contentLocation?.address);
      const candidate = normalizeCandidate({
        placeName: poi.name,
        placeUrl: buildTikTokPlaceUrl(poi.name, poi.id),
        address,
        source: "tiktok_hydration_poi",
      });
      if (isUseful(candidate)) candidates.push(candidate);
    } catch {
      // Invalid hydration data falls through to the generic parsers.
    }
  }
  return candidates;
}

function isUseful(candidate) {
  return Boolean(candidate.placeName || candidate.placeUrl || candidate.address || candidate.latitude != null);
}

function walkJson(value, path, output, seen) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);

  if (!Array.isArray(value)) {
    const entries = Object.entries(value);
    const contextLooksLikePlace = PLACE_KEY_PATTERN.test(path) || entries.some(([key]) => PLACE_KEY_PATTERN.test(key));
    if (contextLooksLikePlace) {
      const get = (pattern) => entries.find(([key]) => pattern.test(key))?.[1];
      const candidate = normalizeCandidate({
        placeName: get(/^(?:poiName|placeName|locationName|venueName|name|title|label)$/i),
        placeUrl: get(/^(?:poiUrl|placeUrl|locationUrl|url|href|link)$/i),
        address: get(/^(?:address|formattedAddress|fullAddress)$/i),
        latitude: get(LAT_KEY_PATTERN),
        longitude: get(LNG_KEY_PATTERN),
        source: "tiktok_embedded_json",
      });
      if (isUseful(candidate)) output.push(candidate);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    walkJson(child, `${path}.${key}`, output, seen);
  }
}

function extractJsonCandidates(html) {
  const candidates = [];
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const body = match[1].trim();
    if (!body || (!body.startsWith("{") && !body.startsWith("["))) continue;
    try {
      walkJson(JSON.parse(body), "root", candidates, new WeakSet());
    } catch {
      // TikTok also emits non-JSON scripts; those are intentionally ignored.
    }
  }
  return candidates;
}

function extractLinkCandidates(html) {
  const candidates = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const attributes = match[1];
    const href = decodeHtml(attributes.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || "");
    const ariaLabel = cleanText(attributes.match(/\baria-label\s*=\s*["']([^"']+)["']/i)?.[1]);
    const dataText = cleanText(
      [...attributes.matchAll(/\bdata-[\w-]*(?:place|poi|location)[\w-]*\s*=\s*["']([^"']+)["']/gi)]
        .map((item) => item[1])
        .join(" ")
    );
    const text = cleanText(match[2].replace(/<[^>]+>/g, " "));
    if (!PLACE_PATH_PATTERN.test(href) && !MAP_HOST_PATTERN.test(href) && !dataText) continue;
    candidates.push(
      normalizeCandidate({
        placeName: text || ariaLabel || dataText,
        placeUrl: href,
        source: "tiktok_place_link",
      })
    );
  }
  return candidates;
}

function dedupe(candidates) {
  const result = [];
  const keys = new Set();
  for (const candidate of candidates) {
    if (!isUseful(candidate)) continue;
    const key = [candidate.placeUrl, candidate.placeName, candidate.address].join("|").toLowerCase();
    if (keys.has(key)) continue;
    keys.add(key);
    result.push(candidate);
  }
  return result.slice(0, 10);
}

export function extractTikTokLocation(html = "") {
  const hydrationCandidates = dedupe(extractHydrationCandidates(html));
  const candidates = hydrationCandidates.length
    ? hydrationCandidates
    : dedupe([...extractLinkCandidates(html), ...extractJsonCandidates(html)]);
  return {
    status: candidates.length === 0 ? "unknown" : candidates.length === 1 ? "single" : "multiple",
    candidates,
  };
}

export function extractTikTokPageMedia(html = "") {
  const meta = (property) => {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const first = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i");
    const reversed = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i");
    return cleanText(html.match(first)?.[1] || html.match(reversed)?.[1]);
  };
  let embeddedThumbnail = "";
  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  const findThumbnail = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== "object" || seen.has(value) || embeddedThumbnail) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (/^(?:thumbnailUrl|thumbnail_url|cover|coverUrl|cover_image_url|originCover|dynamicCover)$/i.test(key)) {
        if (typeof child === "string" && /^https?:\/\//i.test(child)) {
          embeddedThumbnail = cleanText(child);
          return;
        }
        if (child && typeof child === "object") {
          const url = child.urlList?.[0] || child.url_list?.[0] || child.url;
          if (typeof url === "string" && /^https?:\/\//i.test(url)) {
            embeddedThumbnail = cleanText(url);
            return;
          }
        }
      }
      findThumbnail(child, seen);
    }
  };
  for (const match of html.matchAll(scriptPattern)) {
    const body = match[1].trim();
    if (!body || (!body.startsWith("{") && !body.startsWith("["))) continue;
    try {
      findThumbnail(JSON.parse(body));
    } catch {
      // Non-JSON scripts are ignored.
    }
    if (embeddedThumbnail) break;
  }
  const poster = cleanText(html.match(/<video\b[^>]*\bposter=["']([^"']+)["']/i)?.[1]);
  const ogImage = meta("og:image") || meta("twitter:image");
  return {
    thumbnailUrl: ogImage || embeddedThumbnail || poster,
    title: meta("og:title") || meta("twitter:title"),
    description: meta("og:description") || meta("description"),
    source: ogImage ? "tiktok_ogp" : embeddedThumbnail ? "tiktok_embedded_json" : poster ? "tiktok_video_poster" : "tiktok_unavailable",
  };
}
