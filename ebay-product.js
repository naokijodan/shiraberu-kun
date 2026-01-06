/**
 * しらべる君 - eBay商品ページ用スクリプト
 * eBay商品詳細ページにリサーチボタンを追加
 */
(function() {
  'use strict';

  console.log('[しらべる君 eBay商品] スクリプト読み込み');

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
          console.log('[しらべる君 eBay商品] タイトル取得:', cleaned.substring(0, 50));
          return cleaned;
        }
      }
    }

    console.log('[しらべる君 eBay商品] タイトル取得失敗');
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
      console.log('[しらべる君 eBay商品] タイトルが見つかりません。2秒後に再試行...');
      setTimeout(addResearchButton, 2000);
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'kuraberu-ebay-btn';
    btn.innerHTML = '🔍 市場調査';
    btn.title = 'この商品の市場調査を行います（ドラッグで移動可能）';

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
      cursor: move;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    document.body.appendChild(btn);

    // ボタンをドラッグ可能に
    const dragState = makeDraggable(btn, btn);

    // クリック時の処理（ドラッグと区別）
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragState.hasMoved()) return;
      showResearchPanel(title, btn);
    });

    console.log('[しらべる君 eBay商品] ボタン追加完了（ドラッグ対応）');
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
        width: 360px;
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
          <span style="font-weight: 600;">🔍 商品リサーチ</span>
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

          <!-- eBay検索セクション -->
          <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
            <div style="font-size: 12px; color: #0064d2; font-weight: 600; margin-bottom: 8px;">📦 eBay市場調査</div>
            <div style="margin-bottom: 8px;">
              <input type="text" class="kuraberu-keyword-input" value="${escapeHtml(extractKeywords(title))}" placeholder="英語キーワード" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
              ">
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="kuraberu-search-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #0064d2 0%, #004a9e 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🔍 Sold</button>
              <button class="kuraberu-terapeak-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">📊 テラピーク</button>
            </div>
          </div>

          <!-- メルカリ検索セクション -->
          <div style="background: #fff5f5; padding: 12px; border-radius: 8px;">
            <div style="font-size: 12px; color: #ea352d; font-weight: 600; margin-bottom: 8px;">🇯🇵 メルカリで探す</div>
            <div style="margin-bottom: 8px;">
              <input type="text" class="kuraberu-mercari-keyword" placeholder="日本語キーワード（AI翻訳で生成）" style="
                width: 100%;
                padding: 8px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 13px;
                box-sizing: border-box;
              ">
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="kuraberu-ai-translate-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🤖 AI翻訳</button>
              <button class="kuraberu-mercari-btn" style="
                flex: 1;
                padding: 8px;
                background: linear-gradient(135deg, #ea352d 0%, #c52d26 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
              ">🔍 メルカリ</button>
            </div>
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

    // パネル内部の要素を取得
    const panelInner = panel.querySelector('div');
    const panelHeader = panelInner.querySelector('div');

    // パネルをドラッグ可能に
    makeDraggable(panelInner, panelHeader);

    // イベントリスナー
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    // eBay検索ボタン
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

    // メルカリ検索ボタン
    panel.querySelector('.kuraberu-ai-translate-btn').addEventListener('click', () => {
      generateMercariKeyword(title, panel);
    });

    panel.querySelector('.kuraberu-mercari-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-mercari-keyword').value.trim();
      if (keyword) {
        openMercariSearch(keyword);
      } else {
        showMessage(panel, '⚠️ 先にAI翻訳でキーワードを生成してください', 'warning');
      }
    });

    // メルカリキーワードでEnterキー
    panel.querySelector('.kuraberu-mercari-keyword').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-mercari-keyword').value.trim();
        if (keyword) {
          openMercariSearch(keyword);
        }
      }
    });
  }

  /**
   * AIでメルカリ検索キーワードを生成
   */
  async function generateMercariKeyword(title, panel) {
    const messageEl = panel.querySelector('.kuraberu-message');
    const inputEl = panel.querySelector('.kuraberu-mercari-keyword');
    const aiBtn = panel.querySelector('.kuraberu-ai-translate-btn');

    // ボタンを無効化
    aiBtn.disabled = true;
    aiBtn.textContent = '🔄 翻訳中...';
    messageEl.textContent = '🤖 AIが日本語キーワードを生成しています...';
    messageEl.style.color = '#666';

    try {
      // APIキー確認
      const checkResult = await chrome.runtime.sendMessage({ action: 'checkApiKey' });

      if (!checkResult.hasKey) {
        showMessage(panel, '⚠️ OpenAI APIキーが設定されていません', 'warning');
        return;
      }

      // バックグラウンドでキーワード生成
      const result = await chrome.runtime.sendMessage({
        action: 'generateMercariKeyword',
        title: title
      });

      if (result.success) {
        inputEl.value = result.keyword;
        showMessage(panel, '✅ 日本語キーワード生成完了！', 'success');
      } else {
        showMessage(panel, `❌ エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[しらべる君 eBay商品] AI翻訳エラー:', error);
      showMessage(panel, `❌ エラー: ${error.message}`, 'error');
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 AI翻訳';
    }
  }

  /**
   * メルカリ検索を開く
   */
  function openMercariSearch(keyword) {
    const url = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: url,
      active: true
    });
  }

  /**
   * メッセージを表示
   */
  function showMessage(panel, text, type) {
    const msgEl = panel.querySelector('.kuraberu-message');
    if (msgEl) {
      msgEl.textContent = text;
      if (type === 'success') {
        msgEl.style.color = '#2e7d32';
      } else if (type === 'error') {
        msgEl.style.color = '#c62828';
      } else if (type === 'warning') {
        msgEl.style.color = '#e65100';
      } else {
        msgEl.style.color = '#666';
      }
      setTimeout(() => {
        msgEl.textContent = '';
      }, 5000);
    }
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
   * 要素をドラッグ可能にする
   */
  function makeDraggable(element, handle) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialLeft, initialTop, initialRight;

    handle.style.cursor = 'move';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('kuraberu-panel-close')) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.right !== 'auto' && !element.style.left) {
        initialRight = parseInt(computedStyle.right);
        initialTop = parseInt(computedStyle.top);
      } else {
        initialLeft = element.offsetLeft;
        initialTop = element.offsetTop;
        initialRight = null;
      }
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      if (initialRight !== null) {
        const newRight = Math.max(0, Math.min(initialRight - dx, window.innerWidth - element.offsetWidth));
        const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
        element.style.right = `${newRight}px`;
        element.style.top = `${newTop}px`;
        element.style.left = 'auto';
      } else {
        const newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - element.offsetWidth));
        const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
        element.style.left = `${newLeft}px`;
        element.style.top = `${newTop}px`;
        element.style.right = 'auto';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    return { hasMoved: () => hasMoved };
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
      console.log('[しらべる君 eBay商品] 商品ページではありません');
      return;
    }

    console.log('[しらべる君 eBay商品] 商品ページを検出');
    setTimeout(addResearchButton, 1500);
  }

  // 初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
