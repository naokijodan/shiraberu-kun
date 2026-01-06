# プライバシーポリシー / Privacy Policy

**しらべる君 - eBay価格リサーチ**

最終更新日: 2025年1月6日

---

## 日本語

### 1. はじめに

「しらべる君」（以下、「本拡張機能」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めています。本プライバシーポリシーは、本拡張機能がどのような情報を収集し、どのように使用するかを説明します。

### 2. 収集する情報

本拡張機能は以下の情報を収集・保存します：

#### 2.1 ローカルに保存されるデータ
- **API設定**: OpenAI APIキー（ユーザーが入力した場合）
- **価格分析データ**: eBay Sold Listings、テラピークから抽出した価格データ（一時的なセッションデータ）
- **累積分析データ**: ページ間で引き継がれる価格データ（30分間保持）

これらのデータはすべて**ユーザーのブラウザ内（chrome.storage.local、chrome.storage.sync）**に保存され、外部サーバーには送信されません。

#### 2.2 外部に送信されるデータ
- **AI翻訳リクエスト**: AI翻訳機能を使用する場合、商品タイトル情報がOpenAI APIに送信されます。これはユーザーが「AI翻訳」ボタンをクリックした場合のみ発生します。

### 3. 情報の使用目的

収集した情報は以下の目的でのみ使用されます：
- メルカリ商品タイトルの英語キーワード変換
- eBay商品タイトルの日本語キーワード変換
- eBay価格データの統計分析（平均、中央値、最安値、最高値）
- ユーザー設定（APIキー）の保存と復元

### 4. 情報の共有

本拡張機能は、以下の場合を除き、ユーザーの情報を第三者と共有しません：
- ユーザーがAI翻訳機能を使用した場合（OpenAI APIへの送信）
- 法的要求がある場合

### 5. データの保護

- すべてのAPI通信はHTTPS暗号化を使用しています
- APIキーはユーザーのブラウザ内にのみ保存されます
- 外部サーバーへのデータ保存は行いません

### 6. ユーザーの権利

ユーザーは以下の権利を有します：
- **データの削除**: 拡張機能の設定からAPIキーをいつでも削除できます
- **拡張機能の削除**: Chromeから拡張機能を削除すると、すべてのローカルデータが削除されます

### 7. アクセスするウェブサイト

本拡張機能は以下のウェブサイトにアクセスします：
- **jp.mercari.com**: メルカリ商品ページでの調査ボタン表示
- **www.ebay.com**: eBay検索結果・商品ページ・テラピークでの価格分析

### 8. 変更について

本プライバシーポリシーは、必要に応じて更新されることがあります。重要な変更がある場合は、拡張機能内で通知します。

### 9. お問い合わせ

プライバシーに関するご質問やご懸念がある場合は、GitHubリポジトリのIssuesページからお問い合わせください。

---

## English

### 1. Introduction

"Shiraberu-kun" (hereinafter referred to as "this extension") respects user privacy and is committed to protecting personal information. This Privacy Policy explains what information this extension collects and how it is used.

### 2. Information We Collect

This extension collects and stores the following information:

#### 2.1 Data Stored Locally
- **API settings**: OpenAI API key (if entered by the user)
- **Price analysis data**: Price data extracted from eBay Sold Listings and Terapeak (temporary session data)
- **Accumulated analysis data**: Price data inherited between pages (retained for 30 minutes)

All of this data is stored **within the user's browser (chrome.storage.local, chrome.storage.sync)** and is not transmitted to external servers.

#### 2.2 Data Transmitted Externally
- **AI translation requests**: When using the AI translation feature, product title information is sent to the OpenAI API. This only occurs when the user clicks the "AI Translation" button.

### 3. Purpose of Use

The collected information is used only for the following purposes:
- Converting Mercari product titles to English keywords
- Converting eBay product titles to Japanese keywords
- Statistical analysis of eBay price data (average, median, minimum, maximum)
- Saving and restoring user settings (API key)

### 4. Information Sharing

This extension does not share user information with third parties except in the following cases:
- When the user uses the AI translation feature (transmission to OpenAI API)
- When required by law

### 5. Data Protection

- All API communications use HTTPS encryption
- API keys are stored only within the user's browser
- No data is stored on external servers

### 6. User Rights

Users have the following rights:
- **Data deletion**: Users can delete the API key at any time from the extension settings
- **Extension removal**: Removing the extension from Chrome will delete all local data

### 7. Websites Accessed

This extension accesses the following websites:
- **jp.mercari.com**: Displaying research buttons on Mercari product pages
- **www.ebay.com**: Price analysis on eBay search results, product pages, and Terapeak

### 8. Changes

This Privacy Policy may be updated as necessary. Users will be notified within the extension of any significant changes.

### 9. Contact

If you have any questions or concerns about privacy, please contact us through the Issues page of the GitHub repository.

---

© 2025 しらべる君
