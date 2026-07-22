# RELEASE_CHECKLIST.md

mainへpushしてProductionへ反映する前に、このチェックリストを上から順に確認する。詳細な作業ルールは[AGENTS.md](AGENTS.md)、プロジェクトの現在地は[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)を参照。

## ローカル検証

- [ ] Build成功（`npm run build`）
- [ ] Lint成功（`npm run lint`）
- [ ] Test成功（`node --test tests/*.test.js`）
- [ ] `git diff --check`（空白・改行エラーがないか）
- [ ] `git status`で意図しないファイルが混ざっていないか確認

## Firebase確認

- [ ] Firestore Security Rulesが意図通りか
- [ ] Storage Rulesが意図通りか（本人のみ・`image/*`のみ・サイズ上限など）
- [ ] Authentication Authorized domainsに反映先ドメインが登録されているか
- [ ] `.env.local`・Firebaseコンソールの設定値をコードに直接書いていないか

## Preview確認

Preview確認は必ず固定エイリアス `spot-save-app-review.vercel.app` を使う（ランダムなPreview URLはGoogleログインが`auth/unauthorized-domain`で失敗する）。

- [ ] `vercel deploy` でPreview Deployを作成
- [ ] `vercel alias set <新しいdeployment URL> spot-save-app-review.vercel.app` でエイリアスを付け替え
- [ ] Googleログイン確認（`spot-save-app-review.vercel.app`で成功すること）
- [ ] TikTok保存確認（新規保存でサムネイルが表示され、Firestoreの`image`がFirebase Storage URLになっているか。過去データはフォールバック表示になるか）
- [ ] YouTube保存確認（他SNS連携に影響がないか）
- [ ] Instagram / X保存確認（影響がないか）
- [ ] PWA確認（インストール・アップデートプロンプトが正しく動作するか）
- [ ] 主要画面の一覧・地図・カテゴリ・詳細・編集が正しく表示されるか

## リリース

- [ ] コミットメッセージが変更内容を正しく表しているか
- [ ] main push
- [ ] Production確認（本番URLで上記Preview確認項目を再確認）
- [ ] 問題があれば速やかにロールバック（前のProduction Deploymentへ切り戻し）
