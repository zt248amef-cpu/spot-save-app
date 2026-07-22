# PROJECT_CONTEXT.md

SpotSaveというプロジェクトの「今の姿」をまとめたドキュメント。開発ルール・作業手順は[AGENTS.md](AGENTS.md)、未着手の作業は[BACKLOG.md](BACKLOG.md)を参照。

## プロジェクト概要

TikTok・Instagram・YouTube・Xで見つけた「行きたい場所」を、URL・店名・住所・カテゴリ・画像付きで保存・管理するPWAアプリ。開発者本人が実際に日常使いしている個人開発プロダクト。

## 技術スタック

- React 19 + Vite 8
- Firebase（Firestore / Authentication / Storage / Analytics）
- React Router v7（画面遷移）
- Leaflet / react-leaflet（地図表示）
- Vercel（ホスティング + サーバーレスFunctions）
- vite-plugin-pwa（PWA化・Service Worker）
- oxlint（Lint）、Node.js組み込み `node:test`（テスト。専用のテストランナーは未導入）

## 現在の構成

```
src/
  pages/       Home / AddSpot / EditSpot / SpotDetail
  components/  SpotCard / MapView / Onboarding / BottomNav 等
  services/    Firebase連携・外部API連携（spotService, authService, tiktokService,
               youtubeService, oembedService, aiExtractionService, geocodeService,
               tiktokThumbnailService 等）
  utils/       urlUtils / tiktokCdn / browserDetection / mapUtils 等
  firebase.js  Firebase初期化（app, db, auth, storage）
api/
  tiktok.js            TikTokのoEmbed/ページ解析（場所候補・サムネイル取得）
  tiktok-thumbnail.js  TikTok CDN画像のSSRF対策済み中継プロキシ（Storage恒久化用）
  _lib/                上記が使う純粋関数（テスト容易性のため分離）
docs/
  url-precision-design.md   URL高精度保存機能の設計書（未実装・Cloud Functions前提）
  video-analysis-design.md  動画/音声解析の設計書（未実装・上記の延長）
```

現状は**フロントエンドのみ + Vercelサーバーレス関数2本**という構成で、専用バックエンド（Cloud Functions等）は未導入。AI抽出（`aiExtractionService.js`）はブラウザからLLM APIを直接呼んでいる。

## MVP進捗

### 完了済み

- Google認証（`signInWithPopup`）、LINEアプリ内ブラウザ検出・案内
- スポットのCRUD（URL / 店名 / エリア / カテゴリ / 画像 / メモ / 緯度経度）、Firestoreリアルタイム同期
- TikTok / YouTube / Instagram / X のoEmbed経由の投稿情報自動取得
- TikTokの場所リンク・POI・キャプションマーカーからの場所候補抽出
- フロントエンドLLMによるAI抽出（店名・エリア・カテゴリ）
- ジオコーディング（Nominatim）
- 一覧画面（検索・カテゴリ絞り込み・お気に入り・左スワイプで削除/元動画・カードメニュー）
- 地図表示（Leaflet、保存済みスポットのマーカー・ポップアップ）
- 詳細画面・カテゴリ画面
- PWA対応（インストール、アップデートプロンプト）
- 初回起動オンボーディング
- Firebase Analyticsによる各種イベント計測
- **TikTokサムネイルのFirebase Storage恒久化**（署名付きURLの期限切れ対策。新規保存分は実装完了・Preview実機検証中、未commit）

### 未実装

- 専用バックエンド（Firebase Cloud Functions）の導入（現状LLM/外部APIキーがフロントに露出している）
- URL高精度解析パイプライン（`docs/url-precision-design.md`参照）
- 動画/音声のVision解析（`docs/video-analysis-design.md`参照）
- Google Places/Geocoding APIへの本格移行
- テストのCI組み込み（現状ローカルで`node --test`を手動実行するのみ）
- 既存（過去保存済み）TikTokサムネイルのStorage一括移行（新規保存分のみ恒久化済み。過去分は表示側のフォールバックのみで保護）

詳細な優先度・個別タスクは[BACKLOG.md](BACKLOG.md)を参照。

## 技術的な注意点

- `aiExtractionService.js`はOpenAI APIキーを`VITE_`プレフィックスでフロントに直接埋め込んでいる（クライアントから参照可能な状態）。将来のバックエンド化で解消予定（`docs/url-precision-design.md`）。
- TikTok連携はoEmbed/ページスクレイピングに依存しており、TikTok側の仕様変更・Bot対策強化の影響を受けやすい。
- TikTok CDNのサムネイルURLは署名付きで**数時間〜数日で失効**する。新規保存分はFirebase Storageへコピーして恒久URL化しているが、過去保存済みデータは対象外（表示側のフォールバックのみで保護）。
- Firestoreの`image`フィールドは歴史的経緯で複数の形式（TikTok CDN URL／Firebase Storage URL／手動アップロードのdata URL／YouTube静的サムネイルURL）が混在し得る。`resolveSpotImage()`（`src/utils/urlUtils.js`）が優先順位を吸収する。
- Vercel Preview URLはデプロイのたびにランダムに変わる。Firebase AuthenticationのAuthorized domainsに含まれないドメインではGoogleログインが`auth/unauthorized-domain`で失敗するため、固定エイリアス運用にしている（後述）。

## Firebase構成

- **Firestore**: `spots`コレクション。`userId`でクエリ絞り込み、`createdAt`は`serverTimestamp()`。
- **Authentication**: Googleプロバイダ、`signInWithPopup`を使用（リダイレクト方式は未使用）。Authorized domainsに本番ドメインと`spot-save-app-review.vercel.app`（Preview確認用）を登録済み。
- **Storage**: `users/{userId}/spots/{spotId}/thumbnail.{ext}`。Rulesは本人のみ・`image/*`のみ・8MB未満での読み書きに制限（最小権限）。
- **Analytics**: 開発時はConsole出力のみ、本番ビルドでのみ実送信。

## デプロイ構成

- **Vercel**: フロントは`vite build`、`api/`配下がサーバーレスFunctions（`api/tiktok.js`, `api/tiktok-thumbnail.js`）。
- `vercel.json`: SPA向けrewrite（`/(.*)` → `/index.html`、静的ファイルはfilesystemチェックが優先されるためrewriteに巻き込まれない）、`/assets`と`/index.html`のキャッシュヘッダー。
- **GitHub Actions**（`.github/workflows/ci.yml`）: push/PR時に`npm run build`のみ実行。テスト実行・デプロイはCIに含まれない。
- ローカルから`vercel deploy`でPreview Deployを作成できる（本セッションで確立した運用）。

## Preview運用

- Preview確認は必ず固定エイリアス **`spot-save-app-review.vercel.app`** を使う（ランダムなPreview URLはFirebase Authenticationで未許可のためログイン不可）。
- 新しいPreview Deployを作成したら `vercel alias set <新しいdeployment URL> spot-save-app-review.vercel.app` で付け替える。
- 詳細は[CLAUDE.md](CLAUDE.md)・[AGENTS.md](AGENTS.md)・[README.md](README.md)にも同内容を記載。

## 今後の方針

1. **直近**: 進行中のTikTokサムネイル恒久化について、Preview（固定エイリアス）でのGoogleログイン・TikTokフォールバック表示の実機確認を完了させ、commit・main push・Production反映まで進める。
2. **中期**: `docs/url-precision-design.md`に基づき、Firebase Cloud Functionsを導入してLLM/外部APIキーをバックエンドへ移す。あわせてジオコーディングをNominatimからGeoapify/LocationIQへ切り替える。
3. **長期**: `docs/video-analysis-design.md`に基づく動画/音声解析、および[BACKLOG.md](BACKLOG.md)の「将来構想」にある競合優位のための機能群を検討する。
