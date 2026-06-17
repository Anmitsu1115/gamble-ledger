# ギャンブル収支帖（PWA + Firebase）

パチンコ・スロット・公営競技（競馬・競艇・競輪など）の収支を記録するスマホ向けアプリです。
ホーム画面に追加すると、アイコンから直接開ける独立したアプリのように使えます。

メールアドレス・パスワードでログインする仕組みになっていて、データは Firebase の
クラウドデータベース（Firestore）に保存されます。ログインしたアカウントのデータは
そのアカウントでログインした別の端末（iPhone・タブレットなど）からも同じものが見えます。
ブラウザのデータを消したり機種変更しても、ログインし直せば記録は残っています。

## 初回セットアップ

### A. Firebaseの設定（すでに完了している場合はスキップ）

1. https://console.firebase.google.com でプロジェクトを作成
2. プロジェクト内で「アプリを追加」→ Web(`</>`)を選んでWebアプリを登録（Firebase Hostingのチェックは不要）
3. 表示された `firebaseConfig` の値（apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId）を控えておく
4. 左メニュー「Authentication」→「Sign-in method」で「メール/パスワード」を有効化
5. 左メニュー「Firestore Database」→「データベースの作成」（ロケーションは `asia-northeast1` 推奨）
6. Firestoreの「ルール」タブを開き、このリポジトリの `firestore.rules` の内容をコピーして貼り付け、公開する
   （これにより、自分のデータは自分のアカウントでログインしている時しか読み書きできなくなります）

### B. GitHubにアップロードする

```bash
cd gamble-ledger-pwa
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/【自分のユーザー名】/gamble-ledger.git
git push -u origin main
```

### C. Vercelでデプロイする

1. https://vercel.com を開き、GitHubアカウントでログインする
2. 「Add New...」→「Project」を選び、`gamble-ledger` リポジトリを「Import」
3. デプロイ前に「Environment Variables」を開き、以下の6つを登録する
   （値はAの手順3で控えた `firebaseConfig` の中身）

   | Name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | firebaseConfigの `apiKey` |
   | `VITE_FIREBASE_AUTH_DOMAIN` | firebaseConfigの `authDomain` |
   | `VITE_FIREBASE_PROJECT_ID` | firebaseConfigの `projectId` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | firebaseConfigの `storageBucket` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | firebaseConfigの `messagingSenderId` |
   | `VITE_FIREBASE_APP_ID` | firebaseConfigの `appId` |

4. 「Deploy」を押す（1分ほどでURLが発行される）

環境変数を後から追加・変更した場合は、Vercelの「Deployments」タブから
最新のデプロイの「Redeploy」を実行すると反映されます。

### D. スマホのホーム画面に追加する

**iPhone（Safari）の場合**
1. 発行されたURLをSafariで開く
2. 下部の共有ボタン（□と↑のアイコン）をタップ
3. 「ホーム画面に追加」を選んでタップ

**Android（Chrome）の場合**
1. 発行されたURLをChromeで開く
2. 右上の「⋮」メニューをタップ
3. 「アプリをインストール」または「ホーム画面に追加」を選ぶ

初回はメールアドレスとパスワードで「新規登録」してアカウントを作ってください。
別の端末で同じデータを見たい場合は、その端末でも同じURLを開いて同じメールアドレス・
パスワードで「ログイン」してください。

## 開発者向け：ローカルで動かす

`.env.example` を `.env.local` という名前でコピーし、Firebaseの値を埋めてから:

```bash
npm install
npm run dev
```

## 開発者向け：本番ビルド

```bash
npm run build
npm run preview
```

## 構成

- Vite + React
- アイコン: lucide-react
- PWA対応: vite-plugin-pwa（オフラインキャッシュ・ホーム画面追加に対応）
- 認証: Firebase Authentication（メール/パスワード）
- データ保存: Firebase Firestore（ユーザーごとに1ドキュメント、`firestore.rules` で本人のみ読み書き可能に制限）
