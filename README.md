# Apple Wallet Digital Business Card

このリポジトリは、Node.js と [passkit-generator](https://github.com/alexandercerutti/passkit-generator) を使って Apple Wallet 向けのデジタル名刺 (.pkpass) を生成する最小構成のプロジェクトです。`npm run build-pass` を 1 回実行するだけで、Wallet に追加できる名刺が `output/hiro_business_card.pkpass` として出力されます。

## 必要条件
- Apple Developer Program へ登録済みであること
- Pass Type ID `pass.pma-three.vercel.app` が Apple Developer ポータルで発行済みであること
- 同 Pass Type ID 用の証明書 (`pass_certificate.p12`) が取得済みであること（このプロジェクトでは `certs/pass_certificate.p12` に配置します）
- Apple Worldwide Developer Relations (WWDR) 中間証明書を PEM 形式でエクスポート済みであること
  - macOS の「キーチェーンアクセス」→「証明書」から *Apple Worldwide Developer Relations Certification Authority* を右クリックして書き出し (`.cer`)、`openssl x509 -inform der -in AppleWWDRCAGx.cer -out certs/AppleWWDRCA.pem` などで PEM 変換してください
- Node.js 18 以上、および npm

## 初期セットアップ
1. リポジトリ直下に `certs` ディレクトリを作成し、以下を配置します。
   - `certs/pass_certificate.p12` … Apple から発行した Pass Type ID 証明書
   - `certs/AppleWWDRCA.pem` … WWDR 中間証明書（PEM 形式）
2. `.env` ファイルを作成し、Pass 証明書のパスワードを設定します。

   ```bash
   PASS_CERT_PASSWORD=your_pass_certificate_password
   ```

3. 依存関係をインストールします。

   ```bash
   npm install
   ```

## Pass の生成
```bash
npm run build-pass
```

実行に成功すると `output/hiro_business_card.pkpass` が生成されます。iPhone もしくは Apple Watch の Wallet アプリに追加するには、以下のいずれかの方法でファイルをデバイスに送ります。
- AirDrop で送信し、そのまま Wallet で開く
- サーバーやクラウドストレージに配置して Safari でアクセスし、「追加」ボタンから Wallet に登録

## プロジェクト構成
```
.
├── assets/                # アイコン・ロゴ素材（デフォルトの 1x1 PNG を同梱）
├── certs/                 # Pass 用証明書格納ディレクトリ (.gitignore 済み)
├── output/                # 生成された .pkpass が保存される
├── pass/pass.json         # 名刺のテンプレート定義（Team ID やテキストを編集）
├── src/build-pass.mjs     # Pass をビルドするスクリプト
├── .env                   # PASS_CERT_PASSWORD を記述
└── package.json
```

テンプレート (`pass/pass.json`) には以下の情報が含まれています。
- Pass Type ID: `pass.pma-three.vercel.app`
- Team ID: `<YOUR_TEAM_ID>`（自身の Team ID に置き換えてください）
- 名称や肩書き、QR コード (`https://minimalist-hiro-app.com/`) など

## 動作の流れ
1. `src/build-pass.mjs` が `.env` を読み込み、`.p12` から証明書と秘密鍵を抽出します。
2. `pass/pass.json` をテンプレートとして `.pass` 形式のモデルを一時ディレクトリに作成します。
3. WWDR 証明書と署名情報を使って `passkit-generator` が Pass を署名。
4. `assets` 内の `icon.png` / `logo.png` を Pass に組み込み、`output/hiro_business_card.pkpass` へ書き出します。

エラーが発生した場合はスタックトレースを表示して終了します。証明書ファイルや `.env` が不足しているとエラーになるため、必ず事前に設置してください。

## Wallet への追加
生成した `.pkpass` を iPhone や Apple Watch に送付すると、Wallet アプリが起動し内容がプレビューされます。表示内容に問題がなければ「追加」をタップするだけでデジタル名刺として保存できます。

以上でセットアップ完了です。必要に応じて `pass/pass.json` や `assets` を編集し、組織名・QR コード・配色などを自由にカスタマイズしてください。
