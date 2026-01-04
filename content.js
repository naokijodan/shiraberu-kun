/**
 * くらべる君 - Content Script
 * メルカリ商品ページにeBay調査ボタンを追加
 */
(function() {
  'use strict';

  console.log('[くらべる君] Content Script 読み込み開始');
  console.log('[くらべる君] 現在のURL:', window.location.href);

  // ノイズ除去用のキーワード（日本語フリマ特有の表現）
  const NOISE_WORDS = [
    '美品', '極美品', '超美品', '新品', '未使用', '中古',
    '送料無料', '送料込み', '送料込', '匿名配送',
    '即購入OK', '即購入可', 'コメントなし購入OK',
    '専用', '様専用', '取り置き',
    '正規品', '本物', '確実正規品',
    'USED', 'used', '箱なし', '箱付き', '保存袋付き',
    '値下げ', '値下げ不可', '最終値下げ',
    '早い者勝ち', '限定', 'レア', 'SALE'
  ];

  // 表示中のパネル
  let currentPanel = null;

  /**
   * 商品ページかどうかを判定
   */
  function isProductPage() {
    const url = window.location.href;
    const isProduct = /jp\.mercari\.com\/item\//.test(url) ||
                      /jp\.mercari\.com\/shops\/product\//.test(url);
    console.log('[くらべる君] 商品ページ判定:', isProduct);
    return isProduct;
  }

  /**
   * 商品タイトルを取得（複数のセレクタを試行）
   */
  function getProductTitle() {
    // 試行するセレクタのリスト
    const selectors = [
      '[data-testid="name"]',
      'h1[class*="heading"]',
      'h1',
      '[class*="ItemName"]',
      '[class*="itemName"]',
      '[class*="item-name"]',
      'mer-heading',
      '[class*="ProductTitle"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        const title = el.textContent.trim();
        console.log('[くらべる君] タイトル取得成功:', selector, '->', title);
        return title;
      }
    }

    // フォールバック: ページ内のh1を全部チェック
    const h1s = document.querySelectorAll('h1');
    for (const h1 of h1s) {
      const text = h1.textContent.trim();
      if (text && text.length > 5 && !text.includes('メルカリ')) {
        console.log('[くらべる君] タイトル取得(h1):', text);
        return text;
      }
    }

    console.log('[くらべる君] タイトル取得失敗');
    return '';
  }

  /**
   * タイトルからノイズを除去し、検索キーワードを生成
   */
  function generateSearchKeyword(title) {
    let keyword = title;

    // ノイズワードを除去
    NOISE_WORDS.forEach(noise => {
      const regex = new RegExp(noise, 'gi');
      keyword = keyword.replace(regex, '');
    });

    // 記号を除去
    keyword = keyword.replace(/[【】「」『』（）()［］\[\]｛｝{}]/g, ' ');
    keyword = keyword.replace(/[★☆◆◇●○■□▲△▼▽♪♫✨💕❤️🎀]/g, '');
    keyword = keyword.replace(/[！!？?。、,・:：]/g, ' ');

    // 余分なスペースを整理
    keyword = keyword.replace(/\s+/g, ' ').trim();

    console.log('[くらべる君] キーワード生成:', title, '->', keyword);
    return keyword;
  }

  /**
   * eBay調査ボタンを追加
   */
  function addResearchButton() {
    console.log('[くらべる君] ボタン追加処理開始');

    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-btn')) {
      console.log('[くらべる君] ボタン既に存在');
      return;
    }

    // 商品タイトルを取得
    const title = getProductTitle();
    if (!title) {
      console.log('[くらべる君] 商品タイトルが見つかりません。2秒後に再試行...');
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
      const keyword = generateSearchKeyword(title);
      showResearchPanel(keyword, title, btn);
    });

    // ボタンを挿入する場所を探す（複数のセレクタを試行）
    const insertSelectors = [
      '[data-testid="price"]',
      '[data-testid="checkout-button-container"]',
      '[class*="Price"]',
      '[class*="price"]',
      'mer-price',
      '[class*="ItemInfo"]'
    ];

    let inserted = false;
    for (const selector of insertSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        try {
          el.parentElement.insertBefore(btn, el.nextSibling);
          console.log('[くらべる君] ボタン挿入成功:', selector);
          inserted = true;
          break;
        } catch (err) {
          console.log('[くらべる君] ボタン挿入失敗:', selector, err);
        }
      }
    }

    // フォールバック: ページ右上にフローティング表示
    if (!inserted) {
      console.log('[くらべる君] フローティングボタンとして追加');
      btn.style.position = 'fixed';
      btn.style.top = '100px';
      btn.style.right = '20px';
      btn.style.zIndex = '9999';
      document.body.appendChild(btn);
    }

    console.log('[くらべる君] ボタン追加完了');
  }

  /**
   * 調査結果パネルを表示
   */
  function showResearchPanel(keyword, originalTitle, buttonElement) {
    console.log('[くらべる君] パネル表示:', keyword);

    // 既存のパネルを閉じる
    closePanel();

    // パネルを作成
    const panel = document.createElement('div');
    panel.className = 'kuraberu-panel';

    // ローディング表示
    panel.innerHTML = `
      <div class="kuraberu-panel-header">
        <span class="kuraberu-panel-title">🔍 eBay市場調査</span>
        <button class="kuraberu-panel-close">✕</button>
      </div>
      <div class="kuraberu-panel-body">
        <div class="kuraberu-keyword-section">
          <label>検索キーワード（編集可能）:</label>
          <input type="text" class="kuraberu-keyword-input" value="${escapeHtml(keyword)}">
          <button class="kuraberu-research-btn">検索</button>
        </div>
        <div class="kuraberu-loading">
          <div class="kuraberu-spinner"></div>
          <span>eBayを検索中...</span>
        </div>
        <div class="kuraberu-results"></div>
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

    // 検索ボタン
    panel.querySelector('.kuraberu-research-btn').addEventListener('click', () => {
      const newKeyword = panel.querySelector('.kuraberu-keyword-input').value;
      performSearch(newKeyword, panel);
    });

    // Enterキーでも検索
    panel.querySelector('.kuraberu-keyword-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const newKeyword = panel.querySelector('.kuraberu-keyword-input').value;
        performSearch(newKeyword, panel);
      }
    });

    // ドラッグ可能に
    makeDraggable(panel, panel.querySelector('.kuraberu-panel-header'));

    // 検索実行
    performSearch(keyword, panel);
  }

  /**
   * eBay検索を実行
   */
  function performSearch(keyword, panel) {
    console.log('[くらべる君] 検索実行:', keyword);

    const loadingEl = panel.querySelector('.kuraberu-loading');
    const resultsEl = panel.querySelector('.kuraberu-results');

    loadingEl.style.display = 'flex';
    resultsEl.innerHTML = '';

    chrome.runtime.sendMessage(
      { action: 'searchEbay', keyword, options: {} },
      (response) => {
        console.log('[くらべる君] 検索結果:', response);
        loadingEl.style.display = 'none';

        if (chrome.runtime.lastError) {
          console.error('[くらべる君] エラー:', chrome.runtime.lastError);
          displayError('拡張機能の通信エラー', panel);
          return;
        }

        if (response && response.success) {
          displayResults(response.results, panel);
        } else {
          displayError(response?.error || '検索に失敗しました', panel);
        }
      }
    );
  }

  /**
   * 検索結果を表示
   */
  function displayResults(results, panel) {
    const resultsEl = panel.querySelector('.kuraberu-results');
    const { stats, items } = results;

    let html = '';

    if (stats.count === 0) {
      html = `
        <div class="kuraberu-no-results">
          <p>😢 販売履歴が見つかりませんでした</p>
          <p>英語のキーワードで再検索してください</p>
        </div>
      `;
    } else {
      html = `
        <div class="kuraberu-stats">
          <div class="kuraberu-stat-item kuraberu-stat-main">
            <span class="kuraberu-stat-label">販売件数</span>
            <span class="kuraberu-stat-value">${stats.count}件</span>
          </div>
          <div class="kuraberu-stat-row">
            <div class="kuraberu-stat-item">
              <span class="kuraberu-stat-label">最安</span>
              <span class="kuraberu-stat-value">$${stats.minPrice}</span>
            </div>
            <div class="kuraberu-stat-item">
              <span class="kuraberu-stat-label">平均</span>
              <span class="kuraberu-stat-value">$${stats.avgPrice}</span>
            </div>
            <div class="kuraberu-stat-item">
              <span class="kuraberu-stat-label">最高</span>
              <span class="kuraberu-stat-value">$${stats.maxPrice}</span>
            </div>
          </div>
          <div class="kuraberu-stat-item">
            <span class="kuraberu-stat-label">日本発送</span>
            <span class="kuraberu-stat-value">${stats.japanCount}件 (${stats.japanPercent}%)</span>
          </div>
        </div>

        <div class="kuraberu-items-header">直近の販売履歴</div>
        <div class="kuraberu-items">
          ${items.slice(0, 5).map(item => `
            <div class="kuraberu-item ${item.isFromJapan ? 'kuraberu-item-japan' : ''}">
              <div class="kuraberu-item-price">$${item.totalPrice}</div>
              <div class="kuraberu-item-date">${item.soldDate || '-'}</div>
              ${item.isFromJapan ? '<span class="kuraberu-item-jp">🇯🇵</span>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    resultsEl.innerHTML = html;
  }

  /**
   * エラーを表示
   */
  function displayError(message, panel) {
    const resultsEl = panel.querySelector('.kuraberu-results');
    resultsEl.innerHTML = `
      <div class="kuraberu-error">
        <p>⚠️ ${escapeHtml(message)}</p>
      </div>
    `;
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

    // 少し遅延して実行（ページの読み込み完了を待つ）
    console.log('[くらべる君] 1.5秒後にボタン追加');
    setTimeout(addResearchButton, 1500);

    // DOM変更を監視（SPAナビゲーション対応）
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

  // ページ遷移対応（SPAの場合）
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
