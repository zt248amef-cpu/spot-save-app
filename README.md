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

## Claude Code 設定

このリポジトリには Claude Code 向けの補助設定を追加しています。

- [CLAUDE.md](CLAUDE.md) : プロジェクト固有の開発コンテキスト
- [.claude/settings.json](.claude/settings.json) : 代表的なコマンド許可設定
- [.github/workflows/ci.yml](.github/workflows/ci.yml) : React/Vite のビルド確認を行う GitHub Actions

Claude Code で作業する際は、まずこのプロジェクトの構成と開発ルールを参照してください。

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

## Preview確認

Vercel Preview Deployの動作確認は、必ず固定ドメイン `spot-save-app-review.vercel.app` から行ってください。

- 新しいPreview Deployを作成したら、`vercel alias set <新しいdeployment URL> spot-save-app-review.vercel.app` で付け替える
- このドメインはFirebase AuthenticationのAuthorized domainsに登録済みのため、Googleログインが正しく動作する
- 毎回変わるランダムなPreview URL（`spot-save-xxxxx-...vercel.app`）は`auth/unauthorized-domain`でログインに失敗するため使用しない
