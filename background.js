/**
 * しらべる君 - Background Service Worker
 * OpenAI API呼び出し、タブ操作をバックグラウンドで実行
 */

// OpenAI API設定
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// eBay検索キーワード生成用プロンプト
const EBAY_KEYWORD_PROMPT = `日本語の商品情報を英語のeBay検索キーワードに変換してください。

【ルール】
- どんな商品でも対応（ブランド品、カード、ゲーム、家電、何でもOK）
- ブランド名・商品名・キャラクター名は英語表記に変換
- 3〜5語のキーワードを生成
- 状態（美品等）、送料、サイズ詳細は除外

【出力形式】
英語キーワードのみを1行で出力。説明や前置きは不要。

【入力】
`;

// メルカリ検索キーワード生成用プロンプト（英語→日本語）
const MERCARI_KEYWORD_PROMPT = `英語の商品タイトルを日本語のメルカリ検索キーワードに変換してください。

【ルール】
- ブランド名はカタカナまたは英語のまま（例: Hermes→エルメス、Louis Vuitton→ルイヴィトン）
- 商品の種類を日本語に（例: scarf→スカーフ、wallet→財布、bag→バッグ）
- 2〜4語程度の検索しやすいキーワードに
- 状態（New, Used等）、色、サイズ詳細は除外
- 「送料無料」「美品」などの販売条件は含めない

【出力形式】
日本語キーワードのみを1行で出力。説明や前置きは不要。

【入力】
`;

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[しらべる君 BG] メッセージ受信:', request.action);

  if (request.action === 'generateKeyword') {
    // OpenAI APIでキーワード生成（タイトル＋説明）
    generateEbayKeyword(request.title, request.description)
      .then(keyword => sendResponse({ success: true, keyword }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンス
  }

  if (request.action === 'generateMercariKeyword') {
    // OpenAI APIでメルカリ検索キーワード生成（英語→日本語）
    generateMercariKeyword(request.title)
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
      console.log('[しらべる君 BG] タブを開きました:', request.url);
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

  if (request.action === 'openOptionsPage') {
    // 設定画面を開く
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});

/**
 * OpenAI APIでeBay検索キーワードを生成
 */
async function generateEbayKeyword(title, description = '') {
  // APIキーを取得
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = result.openaiApiKey;

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。拡張機能の設定画面でAPIキーを入力してください。');
  }

  console.log('[しらべる君 BG] OpenAI API呼び出し開始');
  console.log('[しらべる君 BG] タイトル:', title);
  console.log('[しらべる君 BG] 説明:', description?.substring(0, 100));

  // タイトルと説明を組み合わせた入力を作成
  let inputText = `タイトル: ${title}`;
  if (description && description.trim()) {
    inputText += `\n\n説明文: ${description}`;
  }

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
          content: EBAY_KEYWORD_PROMPT + inputText
        }
      ],
      max_tokens: 100,
      temperature: 0.3  // 低めで一貫性のある出力
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[しらべる君 BG] OpenAI APIエラー:', error);

    if (response.status === 401) {
      throw new Error('APIキーが無効です。正しいOpenAI APIキーを設定してください。');
    }
    throw new Error(error.error?.message || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  const keyword = data.choices[0].message.content.trim();

  console.log('[しらべる君 BG] キーワード生成成功:', keyword);
  return keyword;
}

/**
 * OpenAI APIでメルカリ検索キーワードを生成（英語→日本語）
 */
async function generateMercariKeyword(title) {
  // APIキーを取得
  const result = await chrome.storage.sync.get(['openaiApiKey']);
  const apiKey = result.openaiApiKey;

  if (!apiKey) {
    throw new Error('OpenAI APIキーが設定されていません。拡張機能の設定画面でAPIキーを入力してください。');
  }

  console.log('[しらべる君 BG] メルカリキーワード生成開始');
  console.log('[しらべる君 BG] 英語タイトル:', title);

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
          content: MERCARI_KEYWORD_PROMPT + title
        }
      ],
      max_tokens: 100,
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('[しらべる君 BG] OpenAI APIエラー:', error);

    if (response.status === 401) {
      throw new Error('APIキーが無効です。正しいOpenAI APIキーを設定してください。');
    }
    throw new Error(error.error?.message || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  const keyword = data.choices[0].message.content.trim();

  console.log('[しらべる君 BG] メルカリキーワード生成成功:', keyword);
  return keyword;
}

console.log('[しらべる君 BG] Background Service Worker 起動');
