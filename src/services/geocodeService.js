export async function geocodePlace(place) {
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
