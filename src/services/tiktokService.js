import { normalizeUrl } from "../utils/urlUtils.js";

export const TIKTOK_FALLBACK_IMAGE = "/tiktok-fallback.svg";

export function locationToExtractionResult(location) {
  const candidates = (location?.candidates || []).map((candidate) => ({
    placeName: candidate.placeName || "",
    area: candidate.address || "",
    addressCandidate: candidate.address || "",
    category: "",
    evidence: candidate.placeName || candidate.address || "",
    sourceType: "place_link",
    locationConfidence: candidate.confidence || "unknown",
    geoSearchQueries: [candidate.placeName, candidate.address].filter(Boolean),
    placeUrl: candidate.placeUrl || "",
    latitude: candidate.latitude ?? null,
    longitude: candidate.longitude ?? null,
    reason: "TikTokの場所リンクまたはPOI情報から取得",
  }));
  const status = location?.status || "unknown";
  const top = status === "single" ? candidates[0] : null;
  return {
    mode: status,
    placeName: top?.placeName || "",
    area: "",
    addressCandidate: top?.addressCandidate || "",
    category: "",
    evidence: top?.evidence || "",
    sourceType: top?.sourceType || "unknown",
    locationConfidence: top?.locationConfidence || "unknown",
    geoSearchQueries: top?.geoSearchQueries || [],
    candidates: status === "multiple" ? candidates : [],
    confidence: top?.locationConfidence === "high" ? 0.95 : top ? 0.75 : 0,
    reason: top?.reason || "TikTokの場所情報を取得できませんでした",
  };
}

function comparableName(value = "") {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
}

function namesConflict(first, second) {
  const a = comparableName(first);
  const b = comparableName(second);
  return Boolean(a && b && !a.includes(b) && !b.includes(a));
}

export function mergeTikTokLocationResult(location, aiResult) {
  const placeResult = locationToExtractionResult(location);
  if (placeResult.mode === "unknown") return aiResult;
  if (placeResult.mode === "multiple") return placeResult;
  if (!aiResult || aiResult.mode === "unknown") return placeResult;
  if (aiResult.mode === "multiple" || namesConflict(placeResult.placeName, aiResult.placeName)) {
    const aiCandidates = aiResult.mode === "multiple" ? aiResult.candidates : [aiResult];
    return {
      ...placeResult,
      mode: "multiple",
      placeName: "",
      addressCandidate: "",
      candidates: [placeResult, ...aiCandidates].map((entry) => ({
        ...entry,
        reason: entry.reason || "動画内の別候補",
      })),
      reason: "TikTokの場所リンクと動画内容に複数または矛盾する候補があります",
    };
  }
  return {
    ...aiResult,
    ...placeResult,
    area: aiResult.area || placeResult.area,
    category: aiResult.category || placeResult.category,
    geoSearchQueries: [...new Set([...placeResult.geoSearchQueries, ...(aiResult.geoSearchQueries || [])])].slice(0, 5),
    reason: "TikTokの場所リンクを優先し、動画情報で補完",
  };
}

export async function fetchTikTokDetails(url) {
  let result = null;
  try {
    const response = await fetch(`/api/tiktok?url=${encodeURIComponent(normalizeUrl(url))}`);
    if (!response.ok) throw new Error(`TikTok metadata returned ${response.status}`);
    result = await response.json();
  } catch (error) {
    console.warn("TikTok metadata is unavailable; using the fallback image.", error);
    result = { media: {}, location: { status: "unknown", candidates: [] } };
  }
  const media = result?.media || {};
  const hasRealThumbnail = Boolean(media.thumbnailUrl);
  return {
    platform: "tiktok",
    caption: media.title || "",
    description: media.description || "",
    authorName: media.author || "",
    thumbnailUrl: hasRealThumbnail ? media.thumbnailUrl : TIKTOK_FALLBACK_IMAGE,
    media: {
      thumbnailUrl: hasRealThumbnail ? media.thumbnailUrl : TIKTOK_FALLBACK_IMAGE,
      title: media.title || "",
      author: media.author || "",
      source: hasRealThumbnail ? media.source : "tiktok_fallback",
      isFallback: !hasRealThumbnail,
    },
    location: result?.location || { status: "unknown", candidates: [] },
  };
}
