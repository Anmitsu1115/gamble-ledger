# ギャンブル収支帖（PWA）

パチンコ・スロット・公営競技（競馬・競艇・競輪など）の収支を記録するスマホ向けアプリです。
ホーム画面に追加すると、アイコンから直接開ける独立したアプリのように使えます。

データはこのアプリを開いた端末・ブラウザの中だけに保存されます（クラウド同期はしていません）。
端末を変えたりブラウザのデータを消去すると記録は失われるので、必要であれば定期的にスクリーンショットなどで控えておくと安心です。

## このアプリをスマホで使えるようにする手順

### 1. GitHubにアップロードする

このフォルダの内容を、自分のGitHubリポジトリにpushします。

```bash
cd gamble-ledger-pwa
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/【自分のユーザー名】/gamble-ledger.git
git push -u origin main
```

GitHub上で先に空のリポジトリ（例: `gamble-ledger`）を作成しておいてください
（README追加なしの空リポジトリにすると上記コマンドがそのまま使えます）。

### 2. Vercelでデプロイする

1. https://vercel.com を開き、GitHubアカウントでログインする
2. 「Add New...」→「Project」を選ぶ
3. さきほどpushしたリポジトリ（`gamble-ledger`）を選んで「Import」
4. Framework Presetは自動で「Vite」と認識されるはずなので、それ以外の設定は変えずに「Deploy」を押す
5. 1分ほどでビルドが完了し、`https://gamble-ledger-xxxx.vercel.app` のようなURLが発行される

これで、以後 `main` ブランチにpushするたびに自動で再デプロイされます。

### 3. スマホのホーム画面に追加する

**iPhone（Safari）の場合**
1. 発行されたURLをSafariで開く
2. 下部の共有ボタン（□と↑のアイコン）をタップ
3. 「ホーム画面に追加」を選んでタップ

**Android（Chrome）の場合**
1. 発行されたURLをChromeで開く
2. 右上の「⋮」メニューをタップ
3. 「アプリをインストール」または「ホーム画面に追加」を選ぶ

ホーム画面にアイコンが追加され、タップするとブラウザのアドレスバーなどが表示されない
全画面のアプリらしい見た目で起動します。

## 開発者向け：ローカルで動かす

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
- データ保存: ブラウザの localStorage（端末内のみ。サーバーには送信されません）
