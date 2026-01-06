# しらべる君 - eBay価格リサーチ

メルカリで見つけた商品のeBay市場価格を瞬時にリサーチできるChrome拡張機能

## 機能

### 🔍 メルカリ→eBay検索
- メルカリ商品ページに「eBay調査」ボタンを追加
- 商品タイトルからeBay検索キーワードを自動生成
- ワンクリックでeBay Sold Listings（販売履歴）を検索
- AI翻訳機能で日本語タイトルを英語キーワードに変換

### 📊 Sold Listings分析
- eBayの販売済み商品一覧ページで価格統計を自動計算
- 平均価格、中央値、最安値、最高値を一目で確認
- 日本発送セラーの割合を表示
- 複数ページの累積分析に対応

### 📈 テラピーク連携
- eBayセラーハブのテラピーク（リサーチ）ページで価格分析
- 販売データの統計情報を自動表示

### 🇯🇵 eBay→メルカリ検索（逆引き機能）
- eBay商品ページで「メルカリで探す」機能
- AI翻訳で英語タイトルを日本語キーワードに変換
- 輸入仕入れリサーチにも対応

## インストール方法

### Chrome Web Store（推奨）
（審査通過後にリンクを追加）

### 開発者向けインストール
1. このリポジトリをクローンまたはダウンロード
2. Chromeで `chrome://extensions` を開く
3. 「デベロッパーモード」をON
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. ダウンロードしたフォルダを選択

## 使い方

### 基本的な流れ
1. メルカリで商品ページを開く
2. 「🔍 eBay調査」ボタンをクリック
3. eBay Sold Listingsページで価格統計を確認
4. テラピークでより詳細な販売データを分析

### AI翻訳機能の設定
1. 拡張機能のオプションページを開く
2. OpenAI APIキーを入力して保存
3. メルカリ/eBayページでAI翻訳ボタンが使用可能に

## 技術仕様

- Chrome Extension Manifest V3
- コンテンツスクリプトによるページ解析
- chrome.storage APIでのデータ保存
- OpenAI API連携（オプション）

## 対応ページ

| サイト | ページ | 機能 |
|--------|--------|------|
| jp.mercari.com | 商品ページ | eBay調査ボタン |
| www.ebay.com | /sch/* (検索結果) | Sold Listings分析 |
| www.ebay.com | /sh/research* (テラピーク) | 価格分析 |
| www.ebay.com | /itm/* (商品ページ) | メルカリ検索 |

## ファイル構成

```
しらべる君/
├── manifest.json        # 拡張機能の設定
├── background.js        # サービスワーカー
├── content.js           # メルカリ用スクリプト
├── ebay-analyzer.js     # Sold Listings分析
├── ebay-product.js      # eBay商品ページ用
├── terapeak-analyzer.js # テラピーク分析
├── popup.html/js        # ポップアップUI
├── options.html/js      # 設定ページ
├── styles.css           # スタイルシート
├── _locales/            # 多言語対応
│   └── ja/messages.json
└── icons/               # アイコン
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## プライバシー

本拡張機能のプライバシーポリシーは [PRIVACY_POLICY.md](PRIVACY_POLICY.md) をご覧ください。

- ユーザーデータはブラウザ内にのみ保存
- AI翻訳使用時のみOpenAI APIに商品タイトルを送信
- 外部サーバーへのデータ収集なし

## ライセンス

MIT License

## 変更履歴

### v1.0.0 (2025-01-06)
- 初回リリース
- メルカリ→eBay検索機能
- Sold Listings価格分析
- テラピーク連携
- AI翻訳機能（OpenAI API）
- eBay→メルカリ逆引き機能

## 作者

しらべる君開発チーム

---

© 2025 しらべる君
