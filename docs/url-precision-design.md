# URL高精度保存機能 設計書・実装ロードマップ

SpotSave最大の価値「URLを貼るだけで場所を高精度に保存する」機能の精度を上げるための調査・設計まとめ。
2026年7月時点の各プラットフォーム仕様・外部サービス仕様に基づく（変化が速い領域のため半年〜1年ごとに再調査推奨）。

---

## 0. 最重要の前提: バックエンドが必要になる

現在のSpotSaveは **Vite + React + Firebase(Firestore/Auth) のみのフロントエンド構成**。
しかし今回調査した手段（YouTube Data API、Instagram oEmbed、LLM API）はどれも以下の理由で**ブラウザから直接呼べない**。

- **APIキー漏洩**: YouTube APIキーやLLM(OpenAI/Claude)のAPIキーをクライアントに埋め込むと誰でも抜き取れる
- **CORS制限**: oEmbedエンドポイントの多くはブラウザからのクロスオリジンfetchを許可していない
- **Instagram oEmbed**: Meta App の access_token（app-id|app-secret）が必要。フロントに置けない

→ **Firebase Cloud Functions（Blazeプラン）を1つ追加し、そこにURL解析処理を集約するのが必須の前提**。
これは既存のFirestore/Auth/UIには一切手を加えない**追加のみの変更**なので、「MVPを壊さない」制約を満たす。
Blazeプランはクレジットカード登録が必要だが、Cloud Functionsは月200万回呼び出しまで無料枠がある（個人開発の規模では実質無料）。

---

## 1. プラットフォーム別 調査結果

| 項目 | TikTok | Instagram | YouTube | X (Twitter) |
|---|---|---|---|---|
| OGタグ | 不安定（bot対策強化） | 不安定（ログイン誘導強化） | 安定 | 不安定（ログイン誘導） |
| oEmbed | ◎ 無料・キー不要 | ○ 無料だがMeta App作成が必要 | ◎ 無料・キー不要（ただし説明文なし） | △ 無料だが2025〜信頼性低下 |
| 公式API | ✕ 投稿者本人の認可が必要（第三者URL不可） | ✕ 同左（Basic Display APIは2024/12廃止） | ◎ Data API v3が無料・任意の公開動画OK | ✕ 無料枠なし（$0.005/read〜、要課金） |
| 店名取得 | 中（oEmbed title＝キャプション） | 中（oEmbed title＝キャプション） | 高（説明文が長く店名明記されやすい） | 低（本文が短い） |
| 住所取得 | 低 | 低 | 中（旅行/グルメ系は説明文に住所を書く例が多い） | 低 |
| 緯度経度直接取得 | ほぼ不可 | ほぼ不可（位置タグはAPI非公開） | 低（recordingDetailsは稀にしか入力されない） | ほぼ不可（ジオタグ機能は廃止済み） |
| 投稿本文の利用可否 | oEmbed titleで可（無料） | oEmbed titleで可（要Meta App） | snippet.descriptionで可（無料・高品質） | oEmbed html内テキストで可（不安定） |

**結論**: YouTubeが圧倒的に扱いやすい（無料・高品質・所有者制限なし）。TikTok/InstagramはoEmbedの短いキャプションが精一杯。Xは無料では不安定、精度を求めるなら有料API。
**4プラットフォームともに緯度経度を直接は返さない** → ジオコーディングは常に別工程として必須。

Firecrawlは **TikTok/Instagram/YouTubeを明示的にブロック**しており今回の用途には使えない。Jina AI ReaderもSNSのログイン壁突破は実証なし。TikTok/Instagramの深いスクレイピング（位置タグ等）が必要になった場合はApify actors（従量課金、$1.5〜1.7/1000件）が現実的な選択肢。

---

## 2. 外部サービス比較（メタデータ→住所・座標の変換部分）

| サービス | 精度 | コスト(2026) | 実装難易度 | 個人開発向き | MVP向き |
|---|---|---|---|---|---|
| OGタグ自力スクレイピング | 低（住所は取れない） | 無料 | 低 | ◎ | ◎（補助用） |
| oEmbed | 低（住所は取れない） | 無料 | 低 | ◎ | ◎（メイン情報源） |
| Google Places API (New) | 最高 | 無料枠あり(月1万件)＋$0.017〜0.02/件、**要課金設定** | 中 | △ | △（将来） |
| Google Geocoding API | 高 | 無料枠あり(月1万件)＋$0.005/件、**要課金設定** | 低〜中 | △ | △（将来） |
| Nominatim（現行） | 中〜低 | 無料（1req/秒、商用大量利用は規約上グレー） | 低 | ◎ | ◎（現状維持） |
| LocationIQ / Geoapify | 中〜高 | 無料枠が大きい（5,000〜9万件/日相当）、**クレカ不要** | 低 | ◎ | ◎（Nominatimの直接上位互換） |
| LLM抽出 (Claude Haiku / GPT-4o-mini) | 店名・エリアは高精度／**住所・座標は幻覚注意** | $0.0003〜0.003/件 | 中 | ◎ | ◎ |
| Firecrawl | ―（前処理用） | 無料枠あり | 低 | ○ | ✕（対象SNSをブロック） |
| Jina AI Reader | ―（前処理用） | 無料〜 | 極低 | ○ | △（未検証） |

**重要な注意点**: LLMに直接「住所」や「緯度経度」を生成させると幻覚（もっともらしい誤情報）が発生する。LLMの役割は「投稿文から店名・エリア・カテゴリを抽出すること」に限定し、住所・座標は必ずジオコーディングAPI（Nominatim/Geoapify/Google）で検証済みの値に変換する。

---

## 3. 提案パイプライン

```
URL入力
  ↓
① プラットフォーム判定（既存 detectSns() を流用・拡張）
  ↓
② メタデータ取得（Cloud Functions内・プラットフォーム別ルーティング）
     - YouTube   : Data API v3 → title + description
     - TikTok    : oEmbed → title(キャプション)
     - Instagram : oEmbed(Meta App) → title(キャプション)
     - X         : oEmbed best-effort → 失敗時は本文なしで継続
  ↓ （取得失敗しても後続は継続。取れた情報だけで進める）
③ AI解析（Claude Haiku / GPT-4o-mini）
     入力: キャプション/説明文（＋任意でサムネイル画像）
     出力: { name, area, category, confidence }
     ※ 住所・座標は生成させない
  ↓
④ ジオコーディング／候補地検索
     入力: "{name} {area}"
     MVP: Nominatim（既存を流用）→ 次段階: Geoapify/LocationIQ → 将来: Google Places
     出力: 候補地（複数件）: 正式名称・住所・lat/lng
  ↓
⑤ 候補表示（AddSpot画面に追加するUI）
     - フォームへ自動入力（店名・場所・カテゴリ・緯度経度）
     - ユーザーが確認・修正してから保存ボタンを押す（AI誤りの安全弁）
     - 自動入力が失敗/低信頼度でも従来通り手入力で保存可能（フォールバック）
  ↓
⑥ Firestore保存（既存 addSpot をそのまま使用）
```

既存の「URL確認」ボタンの隣に「🪄 自動入力」ボタンを追加するイメージ。押さなければ従来のフローと完全に同じ＝**既存UIを一切壊さない**。

---

## 4. 今すぐ実装できる部分 / 将来的に実装すべき部分

### 今すぐ実装できる（低リスク・低コスト・既存を壊さない）

1. **ジオコーディングをNominatim→Geoapify/LocationIQ無料枠へ切り替え**
   `geocodeService.js` のインターフェースは変えずに中身だけ差し替え可能。クレカ不要・精度向上・レート制限緩和という純増の改善。**最優先の即効性のある一手**。
2. **Firebase Cloud Functions の導入（1関数のみ）**
   `resolveSpotFromUrl(url)` という関数を1つ追加するだけ。既存のFirestore/Auth/フロントには無影響。
3. **YouTube Data API v3 連携**（Cloud Functions内）
   無料・キー取得が簡単・所有者制限なし。最もROIが高い情報源。
4. **TikTok / Instagram oEmbed 連携**（Cloud Functions内）
   無料。Instagramのみ軽量なMeta App作成が必要（審査不要）。
5. **AI解析ステップ（GPT-4o-mini or Claude Haiku）**
   キャプション→{name, area, category} の抽出のみ。1件あたり1円未満。
6. **AddSpot画面に「自動入力」ボタン追加**（フォーム自動入力→ユーザー確認→保存、の1ステップ追加のみ）

### 将来的に実装すべき（規模拡大 or 予算確保後）

1. **Google Places / Geocoding API への切り替え**
   実ユーザーが増え、課金設定に抵抗がなくなった段階で精度を最終強化。
2. **X (Twitter) の有料API連携**（$0.005/read）
   X経由の保存が一定数を占めるようになった場合のみ検討。
3. **Apify actors連携**によるTikTok/Instagramの位置タグ抽出（深いスクレイピング）
   oEmbedのキャプションだけでは精度が足りない場合の強化策。
4. **動画/画像のVision解析**（店構えの看板・メニューをAIに読ませる）
   キャプションが曖昧な投稿への対応力を上げる。
5. **候補地の地図ピッカーUI**（複数候補から地図上で選択）
   同名店舗が複数ある場合の誤爆防止。
6. **解析結果のキャッシュ（Firestoreに URL→解析結果 を保存）**
   同じURLが複数ユーザーに保存された場合の重複API呼び出し・コストを削減。

---

## 5. 構成案まとめ

| | 採用サービス | 月間コスト目安（個人開発規模） |
|---|---|---|
| **MVP構成** | YouTube Data API（無料）＋ TikTok/Instagram oEmbed（無料）＋ GPT-4o-mini/Claude Haiku（従量・数百円/月）＋ Geoapify無料枠 | ほぼ0円（Cloud Functions Blazeプランのクレカ登録のみ必要） |
| **将来版構成** | 上記 ＋ Google Places/Geocoding（本格運用時）＋ X API（必要なら）＋ Apify（必要なら）＋ Vision解析 | 利用量に応じて数千円〜 |
| **個人開発コスパ最強構成** | MVP構成をそのまま維持し、ジオコーディングだけGeoapify無料枠を使い続ける。Google PlacesはPMF（本当に人が使うと確認できてから）まで見送る | ほぼ0円を維持 |

**個人開発として最もコスパが良いのはMVP構成そのもの**。Google Places/Geocodingは精度は最高だが「無料枠を使うためだけに課金アカウントを有効化する」という一点が個人開発の最大の障壁になるため、実ユーザーの反応を見てから移行するのが合理的。

---

## 6. SpotSaveを競合より強くするためのアイデア（10個）

1. **地図ピッカーで複数候補から選択** — 同名店舗の誤保存を防ぎ、精度の低さをUXでカバーする
2. **保存URLの重複検知＆「みんなの保存数」表示** — 同じ場所が複数ユーザーに保存されたら人気スポットとして可視化（集合知）
3. **「行きたい／行った」の2ステータス管理** — お気に入りだけでなく訪問記録も残せるようにする
4. **現在地から近い保存済みスポットのレコメンド** — 「今この近くにある保存スポット」を通知的に表示
5. **営業時間・定休日の自動補完**（Google Places連携時）— 「行ったら閉まってた」を防止し体験価値を上げる
6. **友達との共有リスト機能**（URL共有 or LINE共有）— グルメ・旅行の計画をSpotSave上で完結させる
7. **投稿のミニプレイヤー埋め込み**（oEmbedのhtmlを活用）— カード上で元動画をすぐ見返せるようにする
8. **PWA対応（オフライン閲覧）** — 旅行先の電波が悪い場所でも保存済みリストが見られる
9. **気分・天気・時間帯に応じたAIレコメンド** — 保存済みスポットからその場に合う提案をする
10. **カテゴリ・価格帯の自動推定精度向上** — キャプションやサムネイルからジャンル/価格帯まで推定し検索性を上げる

---

## 参考（調査ソース抜粋）

- Google Places/Geocoding 課金・無料枠: developers.google.com/maps/documentation
- Nominatim Usage Policy: operations.osmfoundation.org/policies/nominatim
- LocationIQ / Geoapify 料金ページ
- Firecrawl / Jina AI Reader 料金・対応範囲
- YouTube Data API v3 ドキュメント
- Instagram oEmbed (Graph API) / TikTok oEmbed / X oEmbed 各ドキュメント
- OpenAI / Anthropic API 料金ページ（2026年時点）
