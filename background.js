/**
 * くらべる君 - Background Service Worker
 * OpenAI API呼び出し、タブ操作をバックグラウンドで実行
 */

// OpenAI API設定
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// eBay検索キーワード生成用プロンプト
const EBAY_KEYWORD_PROMPT = `あなたはeBayでの商品検索に精通した専門家です。
日本のフリマサイト（メルカリ）の商品タイトルから、eBayで効果的に検索するための英語キーワードを生成してください。

【ルール】
1. ブランド名は英語表記に変換（例: エルメス → Hermes）
2. 商品カテゴリを英語で明確に（例: スカーフ → scarf, バッグ → bag）
3. 重要な特徴（素材、色、サイズなど）があれば含める
4. 日本語のノイズワード（美品、送料込み、即購入OK等）は無視
5. 検索に不要な情報は省略
6. キーワードは3〜6語程度に収める

【出力形式】
英語キーワードのみを1行で出力してください。説明は不要です。

【入力】
`;

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[くらべる君 BG] メッセージ受信:', request.action);

  if (request.action === 'generateKeyword') {
    // OpenAI APIでキーワード生成
    generateEbayKeyword(request.title)
      .then(keyword => sendResponse({ success: true, keyword }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンス
  }

  if (request.action === 'openTab') {
    // 新しいタブを開く
    chrome.tabs.create({
      url: request.url,
      active: request.active !== false
    }, (tab) => {
      console.log('[くらべる君 BG] タブを開きました:', request.url);
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  if (request.action === 'openInBackground') {
    // バックグラウンドでタブを開く
    chrome.tabs.create({
      url: request.url,
      active: false
    }, (tab) => {
      sendResponse({ success: true, tabId: tab.id });
    });
    return true;
  }

  if (request.action === 'checkApiKey') {
    // APIキーの存在確認
    chrome.storage.sync.get(['openaiApiKey'], (result) => {
      sendResponse({ hasKey: !!result.openaiApiKey });
    });
    return true;
  }
});

/**
 * OpenAI APIでeBay検索キーワードを生成
 */
async function generateEbayKeyword(title) {
  // APIキーを取得
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = result.openaiApiKey;

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。拡張機能の設定画面でAPIキーを入力してください。');
  }

  console.log('[くらべる君 BG] OpenAI API呼び出し開始');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'user',
          content: EBAY_KEYWORD_PROMPT + title
        }
      ],
      max_tokens: 100,
      temperature: 0.3  // 低めで一貫性のある出力
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[くらべる君 BG] OpenAI APIエラー:', error);

    if (response.status === 401) {
      throw new Error('APIキーが無効です。正しいOpenAI APIキーを設定してください。');
    }
    throw new Error(error.error?.message || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  const keyword = data.choices[0].message.content.trim();

  console.log('[くらべる君 BG] キーワード生成成功:', keyword);
  return keyword;
}

console.log('[くらべる君 BG] Background Service Worker 起動');
