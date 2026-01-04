/**
 * くらべる君 - Background Service Worker
 * OpenAI API呼び出し、タブ操作をバックグラウンドで実行
 */

// OpenAI API設定
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';

// eBay検索キーワード生成用プロンプト
const EBAY_KEYWORD_PROMPT = `あなたはeBay検索の専門家です。メルカリの商品情報から、eBayで効果的な英語検索キーワードを生成してください。

【キーワード数：3〜5語】

【必須】
1. ブランド名: エルメス→Hermes, シャネル→Chanel, ルイヴィトン→Louis Vuitton
2. 商品カテゴリ: バッグ→bag, 財布→wallet, スカーフ→scarf, 時計→watch

【記載があれば追加】
3. 型番/モデル名（例: Birkin, Kelly, Neverfull, Speedy）
4. 素材: シルク→silk, レザー→leather, キャンバス→canvas, カシミア→cashmere
5. 色: 黒→black, 赤→red, ネイビー→navy, ベージュ→beige, ゴールド金具→gold hardware

【除外】
状態（美品、未使用等）、取引条件（送料込み等）、サイズ（cm表記）、出品者コメント

【出力】
英語キーワードのみ。3〜5語。説明不要。

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
