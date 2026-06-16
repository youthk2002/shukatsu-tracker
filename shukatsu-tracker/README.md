# 就活トラッカー

夏インターン・冬インターン・本選考のES締切・説明会日程を一元管理するアプリです。

## Vercelへのデプロイ手順

### 1. GitHubにアップロード

1. [github.com](https://github.com) にアクセスしてログイン（アカウントがなければ無料登録）
2. 右上の「+」→「New repository」をクリック
3. Repository name に `shukatsu-tracker` と入力し「Create repository」
4. 表示された手順に従い、このフォルダをアップロード

   **ターミナルを使う場合：**
   ```bash
   cd shukatsu-tracker
   git init
   git add .
   git commit -m "first commit"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/shukatsu-tracker.git
   git push -u origin main
   ```

   **GUIを使う場合（GitHub Desktop）：**
   - [desktop.github.com](https://desktop.github.com) からGitHub Desktopをインストール
   - 「Add an Existing Repository」→ このフォルダを選択 → Publish repository

### 2. Vercelにデプロイ

1. [vercel.com](https://vercel.com) にアクセスし「Sign Up」→「Continue with GitHub」でログイン
2. 「Add New Project」→ `shukatsu-tracker` リポジトリを選択
3. 設定はデフォルトのままで「Deploy」をクリック
4. 1〜2分で `https://shukatsu-tracker-xxx.vercel.app` のURLが発行されます

### 3. 以降の更新方法

コードを変更してGitHubにpushするだけで、Vercelが自動的に再デプロイします。

## ローカルで動かす場合

```bash
npm install
npm run dev
```
