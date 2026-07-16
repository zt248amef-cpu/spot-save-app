// URL に http/https スキームが無ければ補完する
export function normalizeUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// http/https 形式の有効な URL かどうかを判定する
export function isValidUrl(url) {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const SNS_RULES = [
  { type: "tiktok", label: "TikTok", match: (host) => host.includes("tiktok.com") },
  { type: "instagram", label: "Instagram", match: (host) => host.includes("instagram.com") },
  { type: "youtube", label: "YouTube", match: (host) => host.includes("youtube.com") || host.includes("youtu.be") },
  { type: "x", label: "X", match: (host) => host.includes("x.com") || host.includes("twitter.com") },
];

// カテゴリ等の先頭についた絵文字(装飾目的)を取り除き、テキストのみにする。
// 保存済みデータのカテゴリ値そのもの(比較・保存に使う文字列)は変更せず、
// 表示用にのみ使う。
export function stripLeadingEmoji(text) {
  if (!text) return "";
  // \u{FE0F}: 異体字セレクタ, \u{200D}: ZWJ(絵文字の連結に使われる)
  return text.replace(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}\s]+/gu, "").trim();
}

// placeName / area の入力有無から抽出ステータスを判定する
export function resolveExtractionStatus(placeName, area) {
  return placeName?.trim() || area?.trim() ? "manual" : "url_only";
}

// スポットの画像URLをフィールド名の揺れを吸収して解決する（image / imageUrl / thumbnailUrl / thumbnail の順）
export function resolveSpotImage(spot) {
  return spot?.image || spot?.imageUrl || spot?.thumbnailUrl || spot?.thumbnail || "";
}

// 保存日時を表示用の文字列に整形する
export function formatSavedAt(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// URL のホスト名から SNS 種別を判定する
export function detectSns(url) {
  if (!url?.trim()) return { type: "other", label: "リンク" };
  try {
    const host = new URL(normalizeUrl(url)).hostname.toLowerCase();
    const rule = SNS_RULES.find((r) => r.match(host));
    if (rule) return { type: rule.type, label: rule.label };
  } catch {
    // 判定できない場合は other 扱い
  }
  return { type: "other", label: "リンク" };
}
