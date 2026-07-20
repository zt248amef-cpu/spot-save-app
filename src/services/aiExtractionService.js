const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const AI_EXTRACT_ENABLED = import.meta.env.VITE_ENABLE_AI_EXTRACT === "true";

const MAX_CANDIDATES = 10;
const MAX_GEO_QUERIES = 5;

export const KNOWN_CATEGORIES = ["☕ カフェ", "🍜 グルメ", "🧖 サウナ", "❤️ デート", "✈️ 旅行"];
export const SOURCE_TYPES = ["place_link", "description", "title", "weak", "unknown"];
export const LOCATION_CONFIDENCE_LEVELS = ["high", "medium", "low", "unknown"];

const CATEGORY_KEYWORDS = {
  "☕ カフェ": ["カフェ", "coffee", "cafe"],
  "🍜 グルメ": ["グルメ", "レストラン", "食事", "ランチ", "ディナー", "restaurant", "food", "gourmet"],
  "🧖 サウナ": ["サウナ", "sauna", "銭湯", "温泉"],
  "❤️ デート": ["デート", "date"],
  "✈️ 旅行": ["旅行", "観光", "travel", "trip"],
};

// AIが返したカテゴリ文言を、アプリが持つ既知の5カテゴリのいずれかに対応付ける。
// 一致しない場合は null（＝反映しない。誤ったカテゴリを選ばせない）
export function mapToKnownCategory(text) {
  if (!text) return null;
  if (KNOWN_CATEGORIES.includes(text)) return text;
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return category;
  }
  return null;
}

// AI抽出機能が使える状態か（UI側の表示切り替えに使う）
export function isAiExtractionAvailable() {
  return AI_EXTRACT_ENABLED && !!OPENAI_API_KEY;
}

const LOCATION_CONFIDENCE_LABELS = {
  high: { label: "高（住所あり）", icon: "🟢" },
  medium: { label: "中（店名+エリア）", icon: "🟡" },
  low: { label: "低（店名のみ）", icon: "🟠" },
  unknown: { label: "不明（地図検索不可）", icon: "⚪" },
};

// locationConfidence を画面表示用のラベル・アイコンに変換する
export function describeLocationConfidence(level) {
  return LOCATION_CONFIDENCE_LABELS[level] ?? LOCATION_CONFIDENCE_LABELS.unknown;
}

const SOURCE_TYPE_LABELS = {
  place_link: "TikTokの場所リンク",
  description: "説明文",
  title: "タイトル",
  weak: "推測（弱い根拠）",
  unknown: "根拠なし",
};

// sourceType を画面表示用のラベルに変換する
export function describeSourceType(type) {
  return SOURCE_TYPE_LABELS[type] ?? SOURCE_TYPE_LABELS.unknown;
}

// タイトルに「複数店舗紹介」を示唆するキーワードが含まれるかを判定する（AIへの補助ヒント用）
const MULTI_PLACE_KEYWORDS = ["選", "TOP", "top", "ランキング", "まとめ", "おすすめ", "人気", "巡り", "食べ歩き"];
function hasMultiPlaceHint(title) {
  return !!title && MULTI_PLACE_KEYWORDS.some((k) => title.includes(k));
}

const SYSTEM_PROMPT =
  "あなたはSNS投稿のタイトル・説明文から、紹介されている場所の情報を抽出し、" +
  "後工程の地図検索（ジオコーディング）に使える形に整理するアシスタントです。" +
  "以下のJSON形式のみで回答してください。他のテキストは一切含めないでください。\n" +
  "{\n" +
  '  "mode": "single" | "multiple" | "unknown",\n' +
  '  "placeName": string, "area": string, "addressCandidate": string, "category": string, "evidence": string,\n' +
  '  "sourceType": "place_link" | "description" | "title" | "weak" | "unknown",\n' +
  '  "locationConfidence": "high" | "medium" | "low" | "unknown",\n' +
  '  "geoSearchQueries": string[],\n' +
  '  "candidates": [{\n' +
  '    "placeName": string, "area": string, "addressCandidate": string, "category": string, "reason": string, "evidence": string,\n' +
  '    "sourceType": "place_link" | "description" | "title" | "weak" | "unknown",\n' +
  '    "locationConfidence": "high" | "medium" | "low" | "unknown",\n' +
  '    "geoSearchQueries": string[]\n' +
  "  }],\n" +
  '  "confidence": number,\n' +
  '  "reason": string\n' +
  "}\n" +
  "判定ルール:\n" +
  "- タイトルに「〇選」「TOP」「ランキング」「まとめ」「おすすめ」「人気」「巡り」「食べ歩き」などが含まれる場合、複数店舗紹介の可能性を検討してください。" +
  "ただし、これは検討のきっかけに過ぎません。**タイトルのキーワードだけでmodeを\"multiple\"にしてはいけません**\n" +
  "- mode を \"multiple\" にできるのは、説明文（本文）に実際の店名・住所・営業時間・Google Mapリンクなど、" +
  "個別の店舗を特定できる情報が具体的に列挙されている場合だけです\n" +
  "- タイトルに複数店舗を示唆するキーワードがあっても、説明文にチャンネル登録リンクやハッシュタグなど一般的な情報しかなく、" +
  "個別店舗の情報が1件も列挙されていない場合は、\"multiple\"ではなく\"unknown\"にしてください\n" +
  "- 単一の店舗のみが明確に紹介されている場合はmodeを\"single\"にし、結果をトップレベルのplaceName/area/addressCandidate/categoryに入れてください（candidatesは空配列にする）\n" +
  "- 複数の店舗が紹介されている場合はmodeを\"multiple\"にし、見つかった店舗を全てcandidates配列に入れてください（トップレベルのplaceName/area/addressCandidate/categoryは空文字にする）\n" +
  "- **candidatesを1件も作れないのであれば、絶対にmodeを\"multiple\"にしないでください。その場合は必ず\"unknown\"にしてください**\n" +
  "- 説明文に店舗を特定できる情報が乏しい場合は、無理に店名を推測せずmodeを\"unknown\"にしてください。unknownを選ぶことは失敗ではありません。自信がないのにsingleやmultipleを選ぶ方が問題です\n" +
  "- 複数の店舗が紹介されているのに、勝手に1件だけを選んでsingleにしないでください\n" +
  "- 緯度経度や座標は絶対に含めないでください（推測禁止）\n" +
  "- 本文に明記されていない情報は空文字にしてください（推測で埋めない）\n" +
  "- addressCandidateは本文に住所（番地・丁目など）が明記されている場合のみ埋めてください。エリア名や駅名だけでは埋めないでください\n" +
  "- evidenceには、その店名・住所と判断した根拠となる本文中の一節をそのまま引用してください（本文にない場合は空文字）\n" +
  "- sourceTypeは根拠の情報源を表します: 本文（説明文）に明記されている場合は\"description\"、タイトルのみから分かる場合は\"title\"、" +
  "文脈から推測できる程度の弱い根拠しかない場合は\"weak\"、根拠が全くない場合は\"unknown\"\n" +
  "- locationConfidenceは地図検索への使える度合いを表します: 住所（番地レベル）が説明文に明記されている場合は\"high\"、" +
  "店名とエリア（市区町村など）の両方が明確な場合は\"medium\"、店名しか分からない場合は\"low\"、地図検索に使えるだけの情報がない場合は\"unknown\"\n" +
  "- geoSearchQueriesには、地図検索（ジオコーディング）にそのまま使える検索クエリ文字列を1〜3個入れてください。" +
  "例:「店名 エリア」「店名 市区町村」「店名 都道府県 エリア」の組み合わせを、判明している情報の範囲で作成してください。" +
  "店名すら分からない場合は空配列にしてください\n" +
  "- reasonには、なぜその判断（店名・エリア・単一/複数の別）をしたかを一言で説明してください\n" +
  "- categoryは次の5つのいずれかの文言に最も近いものを1つだけ選んでください: " +
  "「☕ カフェ」「🍜 グルメ」「🧖 サウナ」「❤️ デート」「✈️ 旅行」。判断できない場合は空文字にしてください\n" +
  "- confidenceは0〜1の数値で抽出結果への自信度を表してください";

function normalizeSourceType(value) {
  return SOURCE_TYPES.includes(value) ? value : "unknown";
}

function normalizeLocationConfidence(value) {
  return LOCATION_CONFIDENCE_LEVELS.includes(value) ? value : "unknown";
}

function normalizeGeoSearchQueries(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_GEO_QUERIES);
}

function normalizeEntry(entry) {
  return {
    placeName: (entry?.placeName ?? "").trim(),
    area: (entry?.area ?? "").trim(),
    addressCandidate: (entry?.addressCandidate ?? "").trim(),
    category: mapToKnownCategory((entry?.category ?? "").trim()) ?? "",
    evidence: (entry?.evidence ?? "").trim(),
    sourceType: normalizeSourceType(entry?.sourceType),
    locationConfidence: normalizeLocationConfidence(entry?.locationConfidence),
    geoSearchQueries: normalizeGeoSearchQueries(entry?.geoSearchQueries),
  };
}

function normalizeCandidate(entry) {
  return { ...normalizeEntry(entry), reason: (entry?.reason ?? "").trim() };
}

// 投稿のタイトル・説明文から場所の情報を抽出する。
// 単一店舗が明確な場合は mode:"single" としてトップレベルに結果を、
// 複数店舗が紹介されている場合は mode:"multiple" として candidates 配列に候補を、
// 判断できない場合は mode:"unknown" を返す。
// 各結果には evidence（根拠の引用）・sourceType（情報源）・locationConfidence（地図検索への信頼度）・
// geoSearchQueries（地図検索クエリ候補）を含み、Geoapify連携時にそのまま使える形に整えている。
// 緯度経度は生成させない（実際の座標は別工程のジオコーディングAPIで取得する）。
// キー未設定・機能フラグ無効・APIエラー時は null を返し、呼び出し側は手動入力にフォールバックする。
//
// この関数はOpenAI呼び出しの詳細（エンドポイント・モデル・プロンプト）を知る唯一の場所。
// 将来Cloud Functions経由に切り替える場合はこの関数の内部実装だけを差し替えればよく、
// 戻り値の形を維持する限りUI側の変更は不要。
export async function extractPlaceInfo({ caption, description, locationCandidates = [] }) {
  if (!isAiExtractionAvailable()) return null;

  const locationEvidence = locationCandidates
    .slice(0, MAX_CANDIDATES)
    .map((candidate) =>
      [
        "[TikTok place/POI evidence]",
        candidate.placeName && `placeName: ${candidate.placeName}`,
        candidate.address && `address: ${candidate.address}`,
        candidate.placeUrl && `placeUrl: ${candidate.placeUrl}`,
        candidate.latitude != null && `latitude: ${candidate.latitude}`,
        candidate.longitude != null && `longitude: ${candidate.longitude}`,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
  const locationPriorityInstruction = locationEvidence
    ? "TikTokのplace/POI evidenceを最優先の根拠として扱ってください。タイトル等と矛盾する場合はsingleに自動確定せず、複数候補はmultipleにしてください。sourceTypeはplace_linkを使用してください。"
    : "";
  const text = [locationPriorityInstruction, locationEvidence, caption, description]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 6000)
    .trim();
  if (!text) return null;

  const userContent = hasMultiPlaceHint(caption)
    ? `${text}\n\n（タイトルに複数店舗紹介を示唆するキーワードが含まれています）`
    : text;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 3000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    let mode = ["single", "multiple", "unknown"].includes(parsed.mode) ? parsed.mode : "unknown";

    const candidates = Array.isArray(parsed.candidates)
      ? parsed.candidates
          .map(normalizeCandidate)
          .filter((c) => c.placeName || c.area || c.addressCandidate)
          .slice(0, MAX_CANDIDATES)
      : [];

    const top = normalizeEntry(parsed);

    let reason = (parsed.reason ?? "").trim();

    // 防御策: AIがタイトルのキーワードだけでmode:"multiple"と判定し、
    // 説明文からは実際に候補を1件も抽出できなかった場合、matchしない空の候補一覧をUIに出さないよう
    // mode を "unknown" に強制的に補正する
    if (mode === "multiple" && candidates.length === 0) {
      mode = "unknown";
      reason = "複数店舗紹介の可能性はありますが、説明文から具体的な店舗候補を抽出できませんでした";
    }

    return {
      mode,
      placeName: top.placeName,
      area: top.area,
      addressCandidate: top.addressCandidate,
      category: top.category,
      evidence: top.evidence,
      sourceType: top.sourceType,
      locationConfidence: top.locationConfidence,
      geoSearchQueries: top.geoSearchQueries,
      candidates,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reason,
    };
  } catch {
    return null;
  }
}
