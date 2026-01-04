/**
 * くらべる君 - Background Service Worker
 * eBayスクレイピングをバックグラウンドで実行（CORS回避）
 */

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'searchEbay') {
    searchEbaySoldListings(request.keyword, request.options)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 非同期レスポンスを示す
  }
});

/**
 * eBay Sold Listingsを検索
 */
async function searchEbaySoldListings(keyword, options = {}) {
  const url = buildEbaySearchUrl(keyword, options);
  console.log('[くらべる君] eBay検索URL:', url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const html = await response.text();
  return parseEbayResults(html);
}

/**
 * eBay検索URLを構築
 */
function buildEbaySearchUrl(keyword, options) {
  const baseUrl = 'https://www.ebay.com/sch/i.html';
  const params = new URLSearchParams();

  // キーワード
  params.set('_nkw', keyword);

  // Sold Listings（売却済み）
  params.set('LH_Complete', '1');
  params.set('LH_Sold', '1');

  // 価格順（安い順）
  params.set('_sop', '15');

  // 表示件数
  params.set('_ipg', '60');

  // 日本発送フィルター（オプション）
  if (options.japanOnly) {
    params.set('_salic', '104'); // Japan
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * eBay HTMLから商品情報を抽出
 */
function parseEbayResults(html) {
  const items = [];

  // 商品アイテムのパターン
  const itemPattern = /<li[^>]*class="[^"]*s-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  const titlePattern = /<span[^>]*role="heading"[^>]*>(.*?)<\/span>/i;
  const pricePattern = /<span[^>]*class="s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
  const datePattern = /<span[^>]*class="[^"]*POSITIVE[^"]*"[^>]*>Sold\s+([^<]+)<\/span>/i;
  const shippingPattern = /<span[^>]*class="s-item__shipping[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
  const locationPattern = /<span[^>]*class="s-item__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i;

  let match;
  while ((match = itemPattern.exec(html)) !== null) {
    const itemHtml = match[1];

    // タイトル
    const titleMatch = titlePattern.exec(itemHtml);
    const title = titleMatch ? cleanText(titleMatch[1]) : '';

    // 広告やプレースホルダーをスキップ
    if (!title || title.includes('Shop on eBay') || title === 'New Listing') {
      continue;
    }

    // 価格
    const priceMatch = pricePattern.exec(itemHtml);
    const priceText = priceMatch ? cleanText(priceMatch[1]) : '';
    const price = parsePrice(priceText);

    // 販売日
    const dateMatch = datePattern.exec(itemHtml);
    const soldDate = dateMatch ? dateMatch[1].trim() : '';

    // 送料
    const shippingMatch = shippingPattern.exec(itemHtml);
    const shippingText = shippingMatch ? cleanText(shippingMatch[1]) : '';
    const shipping = parseShipping(shippingText);

    // 発送元
    const locationMatch = locationPattern.exec(itemHtml);
    const location = locationMatch ? cleanText(locationMatch[1]) : '';
    const isFromJapan = location.toLowerCase().includes('japan');

    if (price > 0) {
      items.push({
        title,
        price,
        shipping,
        totalPrice: price + shipping,
        soldDate,
        location,
        isFromJapan
      });
    }
  }

  // 統計情報を計算
  const stats = calculateStats(items);

  return {
    items: items.slice(0, 10), // 直近10件
    stats
  };
}

/**
 * 統計情報を計算
 */
function calculateStats(items) {
  if (items.length === 0) {
    return {
      count: 0,
      minPrice: 0,
      maxPrice: 0,
      avgPrice: 0,
      japanCount: 0,
      japanPercent: 0
    };
  }

  const prices = items.map(item => item.totalPrice);
  const japanItems = items.filter(item => item.isFromJapan);

  return {
    count: items.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    japanCount: japanItems.length,
    japanPercent: Math.round((japanItems.length / items.length) * 100)
  };
}

/**
 * テキストをクリーンアップ
 */
function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * 価格を数値に変換
 */
function parsePrice(priceText) {
  if (!priceText) return 0;

  // 範囲価格の場合は最初の価格を使用
  const match = priceText.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return 0;
}

/**
 * 送料を数値に変換
 */
function parseShipping(shippingText) {
  if (!shippingText) return 0;

  if (shippingText.toLowerCase().includes('free')) {
    return 0;
  }

  const match = shippingText.match(/[\d,]+\.?\d*/);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return 0;
}
