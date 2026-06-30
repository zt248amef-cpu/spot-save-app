# 📍 SpotSave

TikTok・Instagram・YouTubeで見つけた「行きたい場所」を保存・管理するアプリ。

## 機能

- URL・店名・住所・カテゴリ・画像を保存
- カテゴリ絞り込み・キーワード検索
- お気に入り登録（⭐ 一番上に表示）
- Google マップで場所を確認
- 保存した URL を新しいタブで開く
- 編集・削除
- Firebase Firestore によるリアルタイム同期（リロードしても消えない）

## 技術スタック

- React 19 + Vite 8
- Firebase Firestore
- React Router v7

## ローカル開発

```bash
# 依存パッケージをインストール
npm install

# .env.local を作成して Firebase の設定を記入
cp .env.example .env.local
# → .env.local を開いて各値を入力

# 開発サーバー起動
npm run dev
```

## 環境変数

`.env.example` をコピーして `.env.local` を作成し、Firebase コンソールの値を入力してください。

| 変数名 | 説明 |
|--------|------|
| `VITE_FIREBASE_API_KEY` | Firebase API キー |
| `VITE_FIREBASE_AUTH_DOMAIN` | 認証ドメイン |
| `VITE_FIREBASE_PROJECT_ID` | プロジェクト ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage バケット |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | メッセージング Sender ID |
| `VITE_FIREBASE_APP_ID` | アプリ ID |

## デプロイ（Vercel）

Vercel にリポジトリを接続し、上記の環境変数をプロジェクト設定の Environment Variables に入力してください。
