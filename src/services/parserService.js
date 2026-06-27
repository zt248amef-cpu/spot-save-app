// ── AI実装の差し替えはこの関数だけ変更する ──────────────────────────────
// 将来は OpenAI / Gemini 等の API 呼び出しに置き換える
// 戻り値の型: { title, place, category, image }
async function callAI(url) {
  // ダミー実装: 2秒後に固定データを返す
  await new Promise((resolve) => setTimeout(resolve, 2000));

  return {
    title: "渋谷のおしゃれカフェ",
    place: "東京都渋谷区",
    category: "☕ カフェ",
    image: "https://picsum.photos/200",
  };
}
// ────────────────────────────────────────────────────────────────────────────

// AddSpot が依存する公開インターフェース
// callAI を差し替えてもここは変えなくてよい
export async function parseSpotFromUrl(url) {
  return callAI(url);
}
