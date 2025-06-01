# Gmail下書き自動作成ツール

動画チェック依頼メールの下書きを自動で作成するWebアプリケーションです。

## 🚀 機能

- **GoogleアカウントでのOAuth認証**
- **YouTube動画URLとGoogleドキュメント指示書URLからのメール作成**
- **Googleドキュメントタイトルの自動取得**（Google Drive API有効時）
- **Gmail APIを使用した下書き自動作成**
- **日本語対応（文字化け修正済み）**

## 🛠️ 技術スタック

- **React 19** + **TypeScript**
- **Vite**（ビルドツール）
- **Tailwind CSS**（スタイリング）
- **Google APIs**（Gmail API, Google Drive API）
- **Vercel**（デプロイ）

## 📋 必要な設定

### 1. Google Cloud Console設定

1. [Google Cloud Console](https://console.developers.google.com/)でプロジェクトを作成
2. 以下のAPIを有効化：
   - Gmail API
   - Google Drive API（タイトル自動取得用）
3. OAuth同意画面を設定（テストモード可）
4. 認証情報でOAuth 2.0クライアントIDを作成
5. 許可されたJavaScriptオリジンに本番URLを追加

### 2. 環境変数

Vercelの環境変数設定で以下を設定：

```
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_API_KEY=your-api-key (Gemini API用、将来の拡張用)
```

## 🚀 Vercelデプロイ手順

### 1. GitHubにプッシュ

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Vercel設定

1. [Vercel](https://vercel.com/)にアクセス
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. Framework Preset: **Vite**
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. 環境変数を設定：
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_API_KEY`

### 3. デプロイ後の設定

1. デプロイ完了後、VercelのURLをコピー
2. Google Cloud Consoleで許可されたJavaScriptオリジンに追加
3. OAuth同意画面のテストユーザーにメールアドレスを追加

## 💻 ローカル開発

### 前提条件

- Node.js 16+
- npm

### セットアップ

1. リポジトリをクローン
```bash
git clone git@github.com:yaokisan/AIM_checkmail_gen.git
cd AIM_checkmail_gen
```

2. 依存関係をインストール
```bash
npm install
```

3. `env-config.js`を作成（`.gitignore`に含まれています）
```javascript
window.process = window.process || {};
window.process.env = window.process.env || {};

window.process.env.REACT_APP_GOOGLE_CLIENT_ID = 'your-client-id';
window.process.env.API_KEY = 'your-api-key';
```

4. 開発サーバーを起動
```bash
npm run dev
```

## 🔧 使用方法

1. **Googleアカウントでサインイン**
2. **YouTube動画URL**を入力
3. **Googleドキュメントの指示書URL**を入力
4. **ドキュメント名**が自動取得される（API有効時）
5. **「下書きを作成」**ボタンをクリック
6. **Gmailの下書き**に移動して確認・送信

## 📝 注意事項

- Google Drive APIが無効の場合は手動でタイトル入力
- 初回使用時はGoogle OAuth同意画面での承認が必要
- テストモードの場合は承認されたユーザーのみアクセス可能

## 🐛 トラブルシューティング

### "Not a valid origin" エラー
- Google Cloud ConsoleでJavaScriptオリジンを確認

### "Google Drive API has not been used" エラー
- Google Cloud ConsoleでGoogle Drive APIを有効化

### 文字化け
- ブラウザキャッシュをクリアしてリロード

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。