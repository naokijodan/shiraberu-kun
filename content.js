/**
 * くらべる君 - Content Script
 * メルカリ商品ページにeBay調査ボタンを追加
 */
(function() {
  'use strict';

  // ノイズ除去用のキーワード（日本語フリマ特有の表現）
  const NOISE_WORDS = [
    '美品', '極美品', '超美品', '新品', '未使用', '中古',
    '送料無料', '送料込み', '送料込', '匿名配送',
    '即購入OK', '即購入可', 'コメントなし購入OK',
    '専用', '様専用', '取り置き',
    '正規品', '本物', '確実正規品',
    'USED', 'used', '箱なし', '箱付き', '保存袋付き',
    '値下げ', '値下げ不可', '最終値下げ',
    '早い者勝ち', '限定', 'レア', 'SALE',
    '\\d+回使用', '\\d+回着用'
  ];

  // 表示中のパネル
  let currentPanel = null;

  /**
   * 商品ページかどうかを判定
   */
  function isProductPage() {
    return /jp\.mercari\.com\/item\//.test(window.location.href) ||
           /jp\.mercari\.com\/shops\/product\//.test(window.location.href);
  }

  /**
   * 商品タイトルを取得
   */
  function getProductTitle() {
    // メルカリの商品タイトル要素
    const titleEl = document.querySelector('[data-testid="name"]') ||
                    document.querySelector('h1') ||
                    document.querySelector('[class*="itemName"]');

    return titleEl ? titleEl.textContent.trim() : '';
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
    keyword = keyword.replace(/[★☆◆◇●○■□▲△▼▽♪♫]/g, '');
    keyword = keyword.replace(/[！!？?。、,・]/g, ' ');

    // 余分なスペースを整理
    keyword = keyword.replace(/\s+/g, ' ').trim();

    return keyword;
  }

  /**
   * eBay調査ボタンを追加
   */
  function addResearchButton() {
    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-btn')) {
      return;
    }

    // 商品タイトルを取得
    const title = getProductTitle();
    if (!title) {
      console.log('[くらべる君] 商品タイトルが見つかりません');
      return;
    }

    // ボタンを作成
    const btn = document.createElement('button');
    btn.className = 'kuraberu-btn';
    btn.innerHTML = '🔍 eBay調査';
    btn.title = 'eBayでの販売状況を調査します';

    btn.addEventListener('click', () => {
      const keyword = generateSearchKeyword(title);
      showResearchPanel(keyword, title, btn);
    });

    // ボタンを挿入する場所を探す
    const priceEl = document.querySelector('[data-testid="price"]') ||
                    document.querySelector('[class*="price"]');

    if (priceEl) {
      priceEl.parentElement.insertBefore(btn, priceEl.nextSibling);
    } else {
      // フォールバック: ページ右上にフローティング表示
      btn.style.position = 'fixed';
      btn.style.top = '80px';
      btn.style.right = '20px';
      btn.style.zIndex = '9999';
      document.body.appendChild(btn);
    }

    console.log('[くらべる君] ボタンを追加しました');
  }

  /**
   * 調査結果パネルを表示
   */
  function showResearchPanel(keyword, originalTitle, buttonElement) {
    // 既存のパネルを閉じる
    closePanel();

    // パネルを作成
    const panel = document.createElement('div');
    panel.className = 'kuraberu-panel';

    // ローディング表示
    panel.innerHTML = `
      <div class="kuraberu-panel-header">
        <span class="kuraberu-panel-title">eBay市場調査</span>
        <button class="kuraberu-panel-close">✕</button>
      </div>
      <div class="kuraberu-panel-body">
        <div class="kuraberu-loading">
          <div class="kuraberu-spinner"></div>
          <span>eBayを検索中...</span>
        </div>
        <div class="kuraberu-keyword-section">
          <label>検索キーワード:</label>
          <input type="text" class="kuraberu-keyword-input" value="${escapeHtml(keyword)}">
          <button class="kuraberu-research-btn">再検索</button>
        </div>
      </div>
    `;

    // 位置を設定
    const rect = buttonElement.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 400)}px`;
    panel.style.left = `${Math.min(rect.left, window.innerWidth - 350)}px`;
    panel.style.zIndex = '10000';

    document.body.appendChild(panel);
    currentPanel = panel;

    // 閉じるボタン
    panel.querySelector('.kuraberu-panel-close').addEventListener('click', closePanel);

    // 再検索ボタン
    panel.querySelector('.kuraberu-research-btn').addEventListener('click', () => {
      const newKeyword = panel.querySelector('.kuraberu-keyword-input').value;
      performSearch(newKeyword, panel);
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
    const bodyEl = panel.querySelector('.kuraberu-panel-body');
    const loadingEl = panel.querySelector('.kuraberu-loading');

    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    chrome.runtime.sendMessage(
      { action: 'searchEbay', keyword, options: {} },
      (response) => {
        if (loadingEl) {
          loadingEl.style.display = 'none';
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
    const bodyEl = panel.querySelector('.kuraberu-panel-body');
    const { stats, items } = results;

    let resultsHtml = '';

    if (stats.count === 0) {
      resultsHtml = `
        <div class="kuraberu-no-results">
          <p>😢 販売履歴が見つかりませんでした</p>
          <p>キーワードを変更して再検索してください</p>
        </div>
      `;
    } else {
      resultsHtml = `
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

    // キーワード入力部分は保持
    const keywordSection = bodyEl.querySelector('.kuraberu-keyword-section');
    bodyEl.innerHTML = '';
    bodyEl.appendChild(keywordSection);

    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'kuraberu-results';
    resultsDiv.innerHTML = resultsHtml;
    bodyEl.appendChild(resultsDiv);
  }

  /**
   * エラーを表示
   */
  function displayError(message, panel) {
    const bodyEl = panel.querySelector('.kuraberu-panel-body');
    const keywordSection = bodyEl.querySelector('.kuraberu-keyword-section');

    bodyEl.innerHTML = '';
    bodyEl.appendChild(keywordSection);

    const errorDiv = document.createElement('div');
    errorDiv.className = 'kuraberu-error';
    errorDiv.innerHTML = `<p>⚠️ ${escapeHtml(message)}</p>`;
    bodyEl.appendChild(errorDiv);
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
    if (!isProductPage()) {
      console.log('[くらべる君] 商品ページではありません');
      return;
    }

    // 少し遅延して実行（ページの読み込み完了を待つ）
    setTimeout(addResearchButton, 1000);

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
})();
