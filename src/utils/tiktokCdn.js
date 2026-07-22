// TikTokの署名付きサムネイルが実際に配信されているCDNドメイン。
// ここに無いドメインは(TikTok本体を含め)サムネイル取得対象として扱わない。
const TIKTOK_CDN_DOMAINS = ["tiktokcdn.com", "tiktokcdn-us.com", "byteoversea.com"];

// TikTok CDNの画像URLかどうかを判定する（https限定・サブドメイン許容・なりすまし拒否）。
// サーバー側のSSRF対策とクライアント側の恒久化判定の両方から参照する共通の真実源。
export function isTikTokCdnUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  return TIKTOK_CDN_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
