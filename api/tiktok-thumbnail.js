import { fetchTikTokThumbnail } from "./_lib/tiktokThumbnailFetch.js";

// TikTok CDNの画像だけを安全に中継するプロキシ。クライアントはここで取得した
// バイト列をFirebase Storageへアップロードし、Firestoreには恒久URLだけを保存する。
export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "GET") return response.status(405).json({ error: "method_not_allowed" });

  const url = Array.isArray(request.query?.url) ? request.query.url[0] : request.query?.url;
  const result = await fetchTikTokThumbnail(url);
  if (!result.ok) return response.status(result.status).json({ error: result.error });

  response.setHeader("Content-Type", result.contentType);
  return response.status(200).send(result.buffer);
}
