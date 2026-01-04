/**
 * くらべる君 - Background Service Worker
 * OpenAI API呼び出し、タブ操作をバックグラウンドで実行
 */

// OpenAI API設定
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// eBay検索キーワード生成用プロンプト
const EBAY_KEYWORD_PROMPT = `あなたはeBayでの商品検索に精通した専門家です。
日本のフリマサイト（メルカリ）の商品情報から、eBayで効果的に検索するための英語キーワードを生成してください。

【ルール】
1. ブランド名は英語表記に変換（例: エルメス → Hermes、シャネル → Chanel）
2. 商品カテゴリを英語で明確に（例: スカーフ → scarf、バッグ → bag、財布 → wallet）
3. 重要な特徴があれば含める：
   - 素材（シルク → silk、レザー → leather）
   - 色（黒 → black、赤 → red）
   - サイズやモデル名
   - 型番があれば優先的に使用
4. 日本語のノイズワードは無視：
   - 状態系：美品、新品、中古、未使用
   - 取引系：送料込み、即購入OK、値下げ可能
   - その他：正規品、本物、保証
5. 検索に不要な情報（出品者コメント、発送方法等）は省略
6. キーワードは3〜6語程度に収める
7. 説明文にブランド名や型番、素材などの重要情報があれば優先的に抽出

【出力形式】
英語キーワードのみを1行で出力してください。説明は不要です。

【入力】
`;

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[くらべる君 BG] メッセージ受信:', request.action);

  if (request.action === 'generateKeyword') {
    // OpenAI APIでキーワード生成（タイトル＋説明）
    generateEbayKeyword(request.title, request.description)
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

  console.log('[くらべる君 BG] OpenAI API呼び出し開始');
  console.log('[くらべる君 BG] タイトル:', title);
  console.log('[くらべる君 BG] 説明:', description?.substring(0, 100));

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
