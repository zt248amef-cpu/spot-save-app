# CLAUDE.md

このリポジトリは React + Vite + Firebase で構成される「SpotSave」アプリです。

## プロジェクト概要
- 保存したい場所を URL / 店名 / 住所 / カテゴリ / 画像付きで管理する。
- Firebase Firestore でデータを永続化する。
- 画面は React Router で遷移し、地図表示には Leaflet を使用する。

## 開発ルール
- 既存のコンポーネント構成に合わせて、機能追加は小さな単位で行う。
- Firebase の設定値は `.env.local` に置き、Git にコミットしない。
- Vite の環境変数は `VITE_` プレフィックスを使用する。
- 変更後は `npm run build` でビルド確認を行う。

## Preview運用
- 動作確認用のPreview Deployは、必ず固定ドメイン `spot-save-app-review.vercel.app` を経由して確認する。
- 新しいPreview Deployを作成したら、`vercel alias set <新しいdeployment URL> spot-save-app-review.vercel.app` でこの固定ドメインを最新のPreviewへ付け替える。
- Firebase Authentication の Authorized domains には `spot-save-app-review.vercel.app` を登録済み。
- 毎回ランダムに発行されるVercelのPreview URL（`spot-save-xxxxx-....vercel.app`）ではGoogleログインが `auth/unauthorized-domain` で失敗するため、動作確認には使用しない。

## 主要ディレクトリ
- `src/components/` : 再利用 UI コンポーネント
- `src/pages/` : 画面単位のコンポーネント
- `src/services/` : Firebase や外部 API 連携
- `src/firebase.js` : Firebase 初期化

## 重要な注意点
- シークレットや API キーをコードに直接書かない。
- 依存関係は必要最小限に保つ。
- GitHub へ push する前に、ローカルでビルドと動作確認を行う。
