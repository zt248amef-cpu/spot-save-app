import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";
import { isTikTokCdnUrl } from "../utils/tiktokCdn";

const EXTENSION_BY_CONTENT_TYPE = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function extensionFor(contentType) {
  const normalized = contentType?.split(";")[0]?.trim().toLowerCase();
  return EXTENSION_BY_CONTENT_TYPE[normalized] || "jpg";
}

// TikTok CDNの署名付きサムネイルURL（数時間〜数日でTikTok側の期限切れにより403になる）を
// Firebase Storageへコピーし、恒久的に参照できるURLを返す。
// 取得・保存のどの段階で失敗してもSpot本体の保存を止めたくないため、例外は投げずnullを返す
// （呼び出し側はnullの場合フォールバック画像を使う）。
export async function persistTikTokThumbnail({ userId, spotId, thumbnailUrl }) {
  if (!userId || !spotId || !isTikTokCdnUrl(thumbnailUrl)) return null;
  try {
    const response = await fetch(`/api/tiktok-thumbnail?url=${encodeURIComponent(thumbnailUrl)}`);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type?.startsWith("image/")) return null;

    const storageRef = ref(storage, `users/${userId}/spots/${spotId}/thumbnail.${extensionFor(blob.type)}`);
    await uploadBytes(storageRef, blob, { contentType: blob.type });
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.warn("TikTokサムネイルの恒久化に失敗しました。フォールバック画像を使用します。", error);
    return null;
  }
}
