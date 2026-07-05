import { normalizeUrl } from "../utils/urlUtils";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;

// URLから YouTube の動画IDを取り出す（watch/短縮URL/Shorts に対応）
function extractYouTubeVideoId(url) {
  try {
    const parsed = new URL(normalizeUrl(url));
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/")[2] || null;
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

// YouTube動画の詳細（タイトル・説明文・チャンネル名・サムネイル）を取得する。
// APIキー未設定・動画ID取得失敗・APIエラー時は null を返す
// （呼び出し側はこれを「取得できなかった」として oEmbed 等にフォールバックする）。
//
// この関数は「YouTubeの情報をどう取得するか」を知る唯一の場所。
// 将来 Cloud Functions 経由に切り替える場合は、この関数の内部実装
// （fetch先をCloud Functionsのエンドポイントに変更するだけ）を差し替えれば良く、
// 戻り値の形（platform/caption/description/authorName/thumbnailUrl）を維持する限り
// 呼び出し側（oembedService・UI）の変更は不要。
export async function fetchYouTubeDetails(url) {
  if (!YOUTUBE_API_KEY) return null;

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const snippet = data.items?.[0]?.snippet;
    if (!snippet) return null;

    return {
      platform: "youtube",
      caption: snippet.title ?? "",
      description: snippet.description ?? "",
      authorName: snippet.channelTitle ?? "",
      thumbnailUrl: snippet.thumbnails?.high?.url ?? snippet.thumbnails?.default?.url ?? "",
    };
  } catch {
    return null;
  }
}
