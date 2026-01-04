/**
 * くらべる君 - eBay商品ページ用スクリプト
 * eBay商品詳細ページにリサーチボタンを追加
 */
(function() {
  'use strict';

  console.log('[くらべる君 eBay商品] スクリプト読み込み');

  let currentPanel = null;

  /**
   * eBay商品詳細ページかどうかを判定
   */
  function isProductPage() {
    const url = window.location.href;
    return url.includes('ebay.com/itm/');
  }

  /**
   * 商品タイトルを取得
   */
  function getProductTitle() {
    // eBay商品ページのタイトルセレクタ
    const selectors = [
      'h1.x-item-title__mainTitle span',
      'h1[data-testid="x-item-title"]',
      'h1.it-ttl',
      '#itemTitle',
      'h1'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        // "Details about" などのプレフィックスを除去
        const cleaned = text.replace(/^Details about\s*/i, '').trim();
        if (cleaned && cleaned.length > 5) {
          console.log('[くらべる君 eBay商品] タイトル取得:', cleaned.substring(0, 50));
          return cleaned;
        }
      }
    }

    console.log('[くらべる君 eBay商品] タイトル取得失敗');
    return '';
  }

  /**
   * リサーチボタンを追加
   */
  function addResearchButton() {
    if (document.querySelector('.kuraberu-ebay-btn')) {
      return;
    }

    const title = getProductTitle();
    if (!title) {
      console.log('[くらべる君 eBay商品] タイトルが見つかりません。2秒後に再試行...');
      setTimeout(addResearchButton, 2000);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'kuraberu-ebay-btn';
    btn.innerHTML = '🔍 市場調査';
    btn.title = 'この商品の市場調査を行います';

    btn.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showResearchPanel(title, btn);
    });

    document.body.appendChild(btn);
    console.log('[くらべる君 eBay商品] ボタン追加完了');
  }

  /**
   * 調査パネルを表示
   */
  function showResearchPanel(title, buttonElement) {
    closePanel();

    const panel = document.createElement('div');
    panel.className = 'kuraberu-ebay-panel';

    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 150px;
        right: 20px;
        width: 340px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 10000;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
          color: white;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-weight: 600;">🔍 eBay市場調査</span>
          <button class="kuraberu-panel-close" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
          ">✕</button>
        </div>
        <div style="padding: 16px;">
          <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; color: #666;">商品タイトル:</label>
            <div style="font-size: 13px; color: #333; margin-top: 4px; max-height: 60px; overflow: hidden;">${escapeHtml(title.substring(0, 100))}${title.length > 100 ? '...' : ''}</div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="font-size: 12px; color: #666;">検索キーワード（編集可）:</label>
            <input type="text" class="kuraberu-keyword-input" value="${escapeHtml(extractKeywords(title))}" style="
              width: 100%;
              padding: 10px;
              border: 1px solid #ddd;
              border-radius: 6px;
              font-size: 14px;
              margin-top: 4px;
              box-sizing: border-box;
            ">
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="kuraberu-search-btn" style="
              flex: 1;
              padding: 12px;
              background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
            ">🔍 Sold Listings</button>
            <button class="kuraberu-terapeak-btn" style="
              flex: 1;
              padding: 12px;
              background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              cursor: pointer;
            ">📊 テラピーク</button>
          </div>
          <div class="kuraberu-message" style="
            margin-top: 12px;
            font-size: 12px;
            color: #666;
          "></div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    currentPanel = panel;

    // イベントリスナー
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    panel.querySelector('.kuraberu-search-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openSoldListingsSearch(keyword);
      }
    });

    panel.querySelector('.kuraberu-terapeak-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openTerapeakSearch(keyword);
      }
    });

    // Enterキーで検索
    panel.querySelector('.kuraberu-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
        if (keyword) {
          openSoldListingsSearch(keyword);
        }
      }
    });
  }

  /**
   * タイトルからキーワードを抽出（簡易版）
   */
  function extractKeywords(title) {
    // 不要な文字を除去
    let keywords = title
      .replace(/\([^)]*\)/g, '') // 括弧内を除去
      .replace(/\[[^\]]*\]/g, '') // 角括弧内を除去
      .replace(/[^\w\s-]/g, ' ') // 特殊文字を除去
      .replace(/\s+/g, ' ')
      .trim();

    // 最初の5単語程度を取得
    const words = keywords.split(' ').slice(0, 5);
    return words.join(' ');
  }

  /**
   * Sold Listings検索を開く
   */
  function openSoldListingsSearch(keyword) {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1&_sop=13&LH_BIN=1`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
  }

  /**
   * テラピーク検索を開く
   */
  function openTerapeakSearch(keyword) {
    const url = `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(keyword)}&dayRange=90&tabName=SOLD`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
  }

  /**
   * パネルを閉じる
   */
  function closePanel() {
    if (currentPanel) {
      currentPanel.remove();
      currentPanel = null;
    }
  }

  /**
   * HTMLエスケープ
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 初期化
   */
  function init() {
    if (!isProductPage()) {
      console.log('[くらべる君 eBay商品] 商品ページではありません');
      return;
    }

    console.log('[くらべる君 eBay商品] 商品ページを検出');
    setTimeout(addResearchButton, 1500);
  }

  // 初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
