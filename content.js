/**
 * くらべる君 - Content Script
 * メルカリ商品ページにeBay調査ボタンを追加
 */
(function() {
  'use strict';

  console.log('[くらべる君] Content Script 読み込み開始');
  console.log('[くらべる君] 現在のURL:', window.location.href);

  // 表示中のパネル
  let currentPanel = null;

  /**
   * 商品ページかどうかを判定
   */
  function isProductPage() {
    const url = window.location.href;
    const isProduct = /jp\.mercari\.com\/item\//.test(url) ||
                      /jp\.mercari\.com\/shops\/product\//.test(url);
    return isProduct;
  }

  /**
   * 商品タイトルを取得（とりこみ君のセレクタを参照）
   */
  function getProductTitle() {
    // メルカリ専用のセレクタ（とりこみ君から参照）
    const titleSelectors = [
      'h1[data-testid="name"]',
      'mer-heading[data-testid="name"]',
      'h1.merBlock__title',
      'h1[class*="heading"]',
      'mer-heading[variant="headingM"]',
      'h2.item-name'
    ];

    // 除外キーワード（他の拡張機能が挿入する要素）
    const excludeKeywords = ['ぷろん君', 'みちゃった君', 'くらべる君', 'とりこみ君'];

    for (const selector of titleSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = el.textContent?.trim() || '';

        // 除外チェック
        const shouldExclude = excludeKeywords.some(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );

        if (text && text.length > 5 && !shouldExclude) {
          console.log('[くらべる君] タイトル取得成功:', selector, '->', text.substring(0, 50));
          return text;
        }
      }
    }

    // フォールバック: main内のh1
    const mainEl = document.querySelector('main') || document.querySelector('#main');
    if (mainEl) {
      const h1 = mainEl.querySelector('h1');
      if (h1) {
        const text = h1.textContent?.trim() || '';
        const shouldExclude = excludeKeywords.some(kw =>
          text.toLowerCase().includes(kw.toLowerCase())
        );
        if (text && text.length > 5 && !shouldExclude) {
          console.log('[くらべる君] タイトル取得(main h1):', text.substring(0, 50));
          return text;
        }
      }
    }

    console.log('[くらべる君] タイトル取得失敗');
    return '';
  }

  /**
   * 商品説明を取得（とりこみ君のセレクタを参照）
   */
  function getProductDescription() {
    // メルカリ専用のセレクタ
    const descriptionSelectors = [
      'div[data-testid="description"]',
      'pre[data-testid="description"]',
      'div.item-description',
      'pre.item-description__inner',
      'mer-text[class*="description"]',
      'pre[class*="description"]'
    ];

    for (const selector of descriptionSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text && text.length > 10) {
          console.log('[くらべる君] 説明取得成功:', selector, '->', text.substring(0, 50));
          // 最大500文字に制限（トークン節約）
          return text.substring(0, 500);
        }
      }
    }

    // フォールバック: preタグを探す
    const allPre = document.querySelectorAll('pre');
    for (const pre of allPre) {
      const text = pre.textContent?.trim() || '';
      if (text && text.length > 30) {
        console.log('[くらべる君] 説明取得(fallback pre):', text.substring(0, 50));
        return text.substring(0, 500);
      }
    }

    console.log('[くらべる君] 説明取得失敗');
    return '';
  }

  /**
   * eBay調査ボタンを追加
   */
  function addResearchButton() {
    console.log('[くらべる君] ボタン追加処理開始');

    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-btn')) {
      return;
    }

    // 商品タイトルを取得
    const title = getProductTitle();
    if (!title) {
      console.log('[くらべる君] タイトルが見つかりません。2秒後に再試行...');
      setTimeout(addResearchButton, 2000);
      return;
    }

    // ボタンを作成
    const btn = document.createElement('button');
    btn.className = 'kuraberu-btn';
    btn.innerHTML = '🔍 eBay調査';
    btn.title = 'eBayでの販売状況を調査します';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const description = getProductDescription();
      showResearchPanel(title, description, btn);
    });

    // ボタンを右上にフローティング表示
    btn.style.position = 'fixed';
    btn.style.top = '100px';
    btn.style.right = '20px';
    btn.style.zIndex = '9999';
    document.body.appendChild(btn);

    console.log('[くらべる君] ボタン追加完了');
  }

  /**
   * 調査結果パネルを表示
   */
  function showResearchPanel(originalTitle, originalDescription, buttonElement) {
    console.log('[くらべる君] パネル表示 - 元タイトル:', originalTitle);
    console.log('[くらべる君] パネル表示 - 元説明:', originalDescription?.substring(0, 100));

    // 既存のパネルを閉じる
    closePanel();

    // パネルを作成
    const panel = document.createElement('div');
    panel.className = 'kuraberu-panel';

    panel.innerHTML = `
      <div class="kuraberu-panel-header">
        <span class="kuraberu-panel-title">🔍 eBay市場調査</span>
        <button class="kuraberu-panel-close">✕</button>
      </div>
      <div class="kuraberu-panel-body">
        <div class="kuraberu-section">
          <label>元のタイトル:</label>
          <div class="kuraberu-original-title">${escapeHtml(originalTitle)}</div>
        </div>
        <div class="kuraberu-section">
          <label>検索キーワード（英語で入力）:</label>
          <input type="text" class="kuraberu-keyword-input" placeholder="例: Hermes scarf silk">
          <div class="kuraberu-hint">💡 ブランド名＋商品種類を英語で入力してください</div>
        </div>
        <div class="kuraberu-buttons">
          <button class="kuraberu-ai-btn">🤖 AI翻訳</button>
          <button class="kuraberu-search-btn">🔍 eBay</button>
          <button class="kuraberu-terapeak-btn">📊 テラピーク</button>
        </div>
        <div class="kuraberu-message"></div>
      </div>
    `;

    // 位置を設定
    panel.style.position = 'fixed';
    panel.style.top = '100px';
    panel.style.right = '20px';
    panel.style.zIndex = '10000';

    document.body.appendChild(panel);
    currentPanel = panel;

    // 閉じるボタン
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    // AI翻訳ボタン
    panel.querySelector('.kuraberu-ai-btn').addEventListener('click', () => {
      generateKeywordWithAI(originalTitle, originalDescription, panel);
    });

    // eBay検索ボタン
    panel.querySelector('.kuraberu-search-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openEbaySearch(keyword);
      } else {
        showMessage(panel, '⚠️ 検索キーワードを入力してください', 'warning');
      }
    });

    // テラピーク検索ボタン
    panel.querySelector('.kuraberu-terapeak-btn').addEventListener('click', () => {
      const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
      if (keyword) {
        openTerapeakSearch(keyword);
      } else {
        showMessage(panel, '⚠️ 検索キーワードを入力してください', 'warning');
      }
    });

    // Enterキーでも検索
    panel.querySelector('.kuraberu-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const keyword = panel.querySelector('.kuraberu-keyword-input').value.trim();
        if (keyword) {
          openEbaySearch(keyword);
        }
      }
    });

    // ドラッグ可能に
    makeDraggable(panel, panel.querySelector('.kuraberu-panel-header'));
  }

  /**
   * AIでeBay検索キーワードを生成
   */
  async function generateKeywordWithAI(title, description, panel) {
    const messageEl = panel.querySelector('.kuraberu-message');
    const inputEl = panel.querySelector('.kuraberu-keyword-input');
    const aiBtn = panel.querySelector('.kuraberu-ai-btn');

    // ボタンを無効化
    aiBtn.disabled = true;
    aiBtn.textContent = '🔄 生成中...';
    messageEl.innerHTML = '<span class="kuraberu-loading-text">🤖 AIがキーワードを生成しています...</span>';
    messageEl.className = 'kuraberu-message';

    try {
      // まずAPIキーがあるか確認
      const checkResult = await chrome.runtime.sendMessage({ action: 'checkApiKey' });

      if (!checkResult.hasKey) {
        showMessage(panel, '⚠️ OpenAI APIキーが設定されていません。拡張機能の設定画面でAPIキーを入力してください。', 'warning');
        // 設定画面を開くリンクを追加
        messageEl.innerHTML += '<br><a href="#" class="kuraberu-settings-link" style="color: #0064d2; text-decoration: underline; cursor: pointer;">設定を開く</a>';
        messageEl.querySelector('.kuraberu-settings-link').addEventListener('click', (e) => {
          e.preventDefault();
          // content scriptからはopenOptionsPageが使えないのでbackgroundに依頼
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
        });
        return;
      }

      // バックグラウンドでキーワード生成（タイトル＋説明を送信）
      const result = await chrome.runtime.sendMessage({
        action: 'generateKeyword',
        title: title,
        description: description || ''
      });

      if (result.success) {
        inputEl.value = result.keyword;
        showMessage(panel, '✅ キーワードを生成しました！「eBayで検索」をクリックしてください', 'success');
      } else {
        showMessage(panel, `❌ エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('[くらべる君] AI生成エラー:', error);
      showMessage(panel, `❌ エラーが発生しました: ${error.message}`, 'error');
    } finally {
      // ボタンを復元
      aiBtn.disabled = false;
      aiBtn.textContent = '🤖 AI翻訳';
    }
  }

  /**
   * eBay Sold Listings検索ページを開く（日本からの出品のみ）
   */
  function openEbaySearch(keyword) {
    // eBay Sold Listings検索URL（日本からの出品に絞る）
    // _salic=104 = Japan, LH_LocatedIn=1 = フィルター有効化
    const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&LH_Complete=1&LH_Sold=1&_sop=13&_salic=104&LH_LocatedIn=1`;

    // バックグラウンドで開く
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: ebayUrl,
      active: true
    });

    console.log('[くらべる君] eBay検索を開きました（日本）:', keyword);
  }

  /**
   * テラピーク検索ページを開く（日本からの出品のみ）
   */
  function openTerapeakSearch(keyword) {
    // テラピークProduct Research検索URL（日本に絞る）
    // sellerCountry=SellerLocation:::JP で日本の出品者に限定
    const terapeakUrl = `https://www.ebay.com/sh/research?marketplace=EBAY-US&keywords=${encodeURIComponent(keyword)}&dayRange=90&endDate=&startDate=&categoryId=0&offset=0&limit=50&tabName=SOLD&sellerCountry=SellerLocation%3A%3A%3AJP&tz=Asia%2FTokyo`;

    // バックグラウンドで開く
    chrome.runtime.sendMessage({
      action: 'openTab',
      url: terapeakUrl,
      active: true
    });

    console.log('[くらべる君] テラピーク検索を開きました（日本）:', keyword);
  }

  /**
   * メッセージを表示
   */
  function showMessage(panel, message, type) {
    const messageEl = panel.querySelector('.kuraberu-message');
    messageEl.className = `kuraberu-message kuraberu-message-${type}`;
    messageEl.textContent = message;
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
   * パネルをドラッグ可能にする
   */
  function makeDraggable(panel, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.style.cursor = 'move';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('kuraberu-panel-close')) return;

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = panel.offsetLeft;
      initialTop = panel.offsetTop;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = `${initialLeft + dx}px`;
      panel.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
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
    console.log('[くらべる君] 初期化開始');

    if (!isProductPage()) {
      console.log('[くらべる君] 商品ページではないためスキップ');
      return;
    }

    // 少し遅延して実行
    setTimeout(addResearchButton, 1500);

    // DOM変更を監視
    const observer = new MutationObserver(() => {
      if (isProductPage() && !document.querySelector('.kuraberu-btn')) {
        addResearchButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // URL変更監視（SPA対応）
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      console.log('[くらべる君] URL変更検知:', lastUrl);
      if (isProductPage() && !document.querySelector('.kuraberu-btn')) {
        setTimeout(addResearchButton, 1500);
      }
    }
  }, 1000);
})();
