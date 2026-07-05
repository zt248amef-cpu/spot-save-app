const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;

// OSMのimportanceがこの値未満のマッチは「ほぼ無名の同名異物件」とみなして棄却する
// （例: 「エッフェル塔」で日光市の無名施設がヒットするケースを除外する）
const MIN_IMPORTANCE = 0.0005;

// Geoapify（高精度・高レート制限）で地名から緯度経度を取得する
// 日本国内に絞り込み、明らかに無関係な低信頼度マッチは採用しない
async function geocodeWithGeoapify(place) {
  try {
    const res = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(place)}&lang=ja&limit=1&filter=countrycode:jp&apiKey=${GEOAPIFY_API_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    if ((feature.properties.rank?.importance ?? 0) < MIN_IMPORTANCE) return null;
    const [lng, lat] = feature.geometry?.coordinates ?? [];
    if (lat != null && lng != null) return { lat, lng };
  } catch {
    // Geoapify失敗時はNominatimにフォールバックする
  }
  return null;
}

// Nominatim（無料・キー不要）で地名から緯度経度を取得する
async function geocodeWithNominatim(place) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`,
      {
        headers: {
          "Accept-Language": "ja",
          "User-Agent": "SpotSave/1.0",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // ジオコーディング失敗は無視して保存を続行
  }
  return null;
}

// 地名から緯度経度を取得する。Geoapifyのキーが設定されていれば優先し、
// 未設定または失敗時はNominatimにフォールバックする
export async function geocodePlace(place) {
  if (GEOAPIFY_API_KEY) {
    const result = await geocodeWithGeoapify(place);
    if (result) return result;
  }
  return geocodeWithNominatim(place);
}
