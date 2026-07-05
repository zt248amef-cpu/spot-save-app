import { detectSns, normalizeUrl } from "../utils/urlUtils";
import { fetchYouTubeDetails } from "./youtubeService";

// 認証不要・CORS対応済みの oEmbed エンドポイント（Instagramはアプリ登録が必要なため非対応）
const OEMBED_ENDPOINTS = {
  youtube: (url) => `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  x: (url) => `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`,
};

// X の oEmbed は html ブロックしか返さないため、本文テキストだけを取り出す
function extractTweetText(html) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const paragraph = container.querySelector("p");
  return (paragraph?.textContent ?? container.textContent ?? "").trim();
}

// URLの投稿からキャプション・投稿者・サムネイルを取得する（YouTube/TikTok/Xのみ対応）
// 対応外プラットフォームや取得失敗時は null を返す
export async function fetchOEmbedPreview(url) {
  const sns = detectSns(url);

  // YouTubeはより情報量の多い取得手段（youtubeService）があれば優先する。
  // このファイルは youtubeService が「何を使って」情報を取るかを一切知らない。
  if (sns.type === "youtube") {
    const richResult = await fetchYouTubeDetails(url);
    if (richResult) return richResult;
  }

  const buildEndpoint = OEMBED_ENDPOINTS[sns.type];
  if (!buildEndpoint) return null;

  const res = await fetch(buildEndpoint(normalizeUrl(url)));
  if (!res.ok) return null;
  const data = await res.json();

  const caption = sns.type === "x" ? extractTweetText(data.html ?? "") : (data.title ?? "");

  return {
    platform: sns.type,
    caption: caption.trim(),
    authorName: data.author_name ?? "",
    thumbnailUrl: data.thumbnail_url ?? "",
  };
}
