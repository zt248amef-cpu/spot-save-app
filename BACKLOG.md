# BACKLOG.md

SpotSaveの未着手・進行中タスクの優先度別一覧。プロジェクト全体の状況は[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)、作業ルールは[AGENTS.md](AGENTS.md)を参照。

優先度は P0（最優先）→ 将来構想（最も後回し）の順。

---

## P0: 致命的不具合

現在、該当する項目はありません。

> 2026-07-22: 「TikTokサムネイルの『壊れた画像』表示」はFirebase Storageへの恒久化対応が完了し、Production実機確認（Googleログイン・新規TikTok保存・保存直後の表示・再読み込み後の表示・過去データのフォールバック表示・他SNSへの影響なし）も完了したため、このバックログから削除。

---

## P1: 公開前必須

- ジオコーディングをNominatim→Geoapify/LocationIQへ切り替え（`docs/url-precision-design.md`参照）。クレカ不要で無料枠が大きく、レート制限緩和・精度向上が見込める即効性の高い改善

---

## P2: UX改善

- AddSpot画面への「自動入力」ボタン追加（投稿情報取得→AI抽出→フォーム自動反映を1ステップにまとめる。`docs/url-precision-design.md`参照）
- 地図ピッカーで複数候補から選択できるUI（同名店舗の誤保存防止）
- 「行きたい／行った」の2ステータス管理（お気に入りに加えて訪問記録を残せるようにする）
- 投稿のミニプレイヤー埋め込み（oEmbedのhtmlを活用し、カード上で元動画をすぐ見返せるようにする）

---

## P3: 品質改善

- `SpotDetail.jsx`へのTikTok画像`onError`フォールバック展開（現状`SpotCard.jsx`のみ対応）
- `MapView.jsx`へのTikTok画像`onError`フォールバック展開（現状`SpotCard.jsx`のみ対応）
- テストのCI組み込み（現状ローカルで`node --test`を手動実行するのみ。GitHub Actionsは`npm run build`のみ）
- バンドルサイズの最適化（build時に500KB超のchunk警告あり。動的import等によるコード分割を検討）
- Firestoreの`image`フィールドに混在する複数形式（TikTok CDN URL／Storage URL／data URL／YouTube URL）の将来的な整理

---

## P4: 将来機能

- 過去保存済み（公開前の開発データのみが対象）TikTokサムネイルの自動バックフィル
  現時点では本物サムネイルの自動復元は実装しない方針。期限切れ時は引き続き`SpotCard`の`onError`フォールバック画像を表示する。着手する場合はStorageへの一括コピー＋Firestoreの`image`一括更新スクリプトが必要。
- Firebase Cloud Functionsの導入（LLM/外部APIキーのバックエンド移行。`docs/url-precision-design.md`の前提）
- URL高精度解析パイプライン一式（YouTube Data API・TikTok/Instagram oEmbedのバックエンド化、AI解析ステップ）
- 動画/音声のVision解析（Whisper文字起こし・画面テロップOCR。`docs/video-analysis-design.md`参照）
- Google Places/Geocoding APIへの本格移行（実ユーザー増加後、課金設定に抵抗がなくなった段階で検討）
- X (Twitter) 有料API連携（X経由の保存が一定数を占めるようになった場合のみ）
- Apify等によるTikTok/Instagramの深いスクレイピング（位置タグ抽出。oEmbedキャプションだけで精度が足りない場合の強化策）

---

## 保留

- **TikTok日本語タイトル改善**
  TikTokはPOI名をローマ字で返すケースがある。取得データ内だけを使った日本語名正規化を試したが、実URLでは改善率0%。今後、日本国内の住所・POIを利用してGoogle Maps/Apple Maps/Place API等から正式名称を補完できるか検討する。MVPでは対応しない。優先度：Low
- **TikTokコメント解析**
  投稿者がコメント返信で店名・場所名を回答しているケースがあるが、MVPでは対応しない。コメント取得にはPlaywrightによるブラウザ実行・TikTok APIの利用可否調査・TikTok側のBot対策への対応が必要になる可能性があり、後日検討する。優先度：Low

---

## 将来構想

（`docs/url-precision-design.md`「SpotSaveを競合より強くするためのアイデア」より）

- 保存URLの重複検知＆「みんなの保存数」表示（同じ場所が複数ユーザーに保存されたら人気スポットとして可視化）
- 現在地から近い保存済みスポットのレコメンド
- 営業時間・定休日の自動補完（Google Places連携時）
- 友達との共有リスト機能（URL共有 or LINE共有）
- PWAオフライン閲覧の本格対応
- 気分・天気・時間帯に応じたAIレコメンド
- カテゴリ・価格帯の自動推定精度向上
