/**
 * しらべる君 - テラピーク分析スクリプト
 * テラピークのページから価格データを収集・分析
 */
(function() {
  'use strict';

  console.log('[しらべる君 テラピーク] 分析スクリプト読み込み');

  // 累積データ（chrome.storageで永続化）
  let collectedPrices = [];
  let currentPanel = null;
  let currentButton = null;
  let currentSearchKeyword = '';

  /**
   * テラピークページかどうかを判定
   */
  function isTerapeakPage() {
    const url = window.location.href;
    return url.includes('ebay.com/sh/research');
  }

  /**
   * ページから価格データを抽出
   * span[data-item-id]を持つ行から価格を取得（ぶんせき君方式）
   */
  function extractPrices() {
    const prices = [];
    const seenItemIds = new Set(); // 重複防止用

    // テラピークでは span[data-item-id] が各商品の識別子
    const titleSpans = document.querySelectorAll('span[data-item-id]');
    console.log('[しらべる君 テラピーク] data-item-id要素数:', titleSpans.length);

    if (titleSpans.length > 0) {
      titleSpans.forEach((titleSpan, index) => {
        // data-item-idで重複チェック
        const itemId = titleSpan.getAttribute('data-item-id');
        if (seenItemIds.has(itemId)) {
          return;
        }
        seenItemIds.add(itemId);

        // 親の行を探す
        const row = titleSpan.closest('tr') || titleSpan.closest('[class*="row"]');
        if (!row) return;

        // 行内から$価格を取得（最初に見つかった価格 = Avg sold price）
        const priceMatch = row.textContent.match(/\$([\d,]+\.\d{2})/);
        if (priceMatch) {
          const priceValue = parseFloat(priceMatch[1].replace(/,/g, ''));

          // 妥当な範囲の価格（$1以上）
          if (priceValue >= 1 && priceValue < 100000) {
            prices.push(priceValue);
            console.log('[しらべる君 テラピーク] 商品', index, '価格:', '$' + priceMatch[1]);
          }
        }
      });
    }

    // フォールバック：span[data-item-id]がない場合はテーブル行から抽出
    if (prices.length === 0) {
      console.log('[しらべる君 テラピーク] data-item-idがないためフォールバック');
      const processedRows = new Set();

      let rows = document.querySelectorAll('table tbody tr');
      if (rows.length === 0) {
        rows = document.querySelectorAll('table tr');
      }

      rows.forEach((row, index) => {
        if (row.querySelector('th')) return;

        const cells = row.querySelectorAll('td');
        if (cells.length === 0) return;

        const firstCellText = cells[0]?.textContent?.trim().substring(0, 50) || '';
        if (processedRows.has(firstCellText)) return;
        processedRows.add(firstCellText);

        const priceMatch = row.textContent.match(/\$([\d,]+\.\d{2})/);
        if (priceMatch) {
          const priceValue = parseFloat(priceMatch[1].replace(/,/g, ''));
          if (priceValue >= 1 && priceValue < 100000) {
            prices.push(priceValue);
            console.log('[しらべる君 テラピーク] 行', index, '価格:', '$' + priceMatch[1]);
          }
        }
      });
    }

    console.log('[しらべる君 テラピーク] 抽出した価格:', prices.length, '件');
    return prices;
  }

  /**
   * 価格テキストをパース（USD）
   */
  function parsePriceText(text) {
    // カンマと$を除去
    const cleaned = text.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * 統計を計算
   */
  function calculateStats(prices) {
    if (prices.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, median: 0 };
    }

    const sorted = [...prices].sort((a, b) => a - b);
    const sum = prices.reduce((a, b) => a + b, 0);
    const avg = sum / prices.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      count: prices.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: avg,
      median: median
    };
  }

  /**
   * 分析パネルを表示
   */
  function showAnalysisPanel() {
    // 既存のパネルを削除
    if (currentPanel) {
      currentPanel.remove();
    }

    const panel = document.createElement('div');
    panel.id = 'kuraberu-terapeak-panel';
    panel.innerHTML = `
      <div style="
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 10000;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
          color: white;
          padding: 14px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <span style="font-weight: 600;">📊 しらべる君 - テラピーク分析</span>
          <button id="kuraberu-tp-close" style="
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
          ">✕</button>
        </div>
        <div style="padding: 16px;">
          <div id="kuraberu-tp-stats" style="margin-bottom: 16px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">読み込み中...</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="kuraberu-tp-refresh" style="
              flex: 1;
              padding: 10px;
              background: #f0f0f0;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
            ">🔄 再読込</button>
            <button id="kuraberu-tp-add-page" style="
              flex: 1;
              padding: 10px;
              background: linear-gradient(135deg, #10a37f 0%, #0d8a6a 100%);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 13px;
              cursor: pointer;
            ">➕ 次ページ追加</button>
          </div>
          <div id="kuraberu-tp-message" style="
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
    document.getElementById('kuraberu-tp-close').addEventListener('click', () => {
      panel.remove();
      currentPanel = null;
    });

    document.getElementById('kuraberu-tp-refresh').addEventListener('click', () => {
      collectedPrices = [];
      clearAccumulatedData();
      showMessage('🔄 データをリセットしました');
      // 少し待ってから再分析（SPAのデータ更新を待つ）
      setTimeout(() => {
        analyzePage();
      }, 1000);
    });

    document.getElementById('kuraberu-tp-add-page').addEventListener('click', () => {
      analyzePage(true); // 累積モード
    });

    // 累積データを読み込んでから初回分析
    loadAccumulatedData().then((savedPrices) => {
      if (savedPrices.length > 0) {
        collectedPrices = savedPrices;
        currentSearchKeyword = getSearchKeyword();
        console.log('[しらべる君 テラピーク] 累積データ読み込み:', savedPrices.length, '件');
        analyzePage(true);
      } else {
        analyzePage();
      }
    });
  }

  /**
   * URLから検索キーワードを取得
   */
  function getSearchKeyword() {
    const url = new URL(window.location.href);
    return url.searchParams.get('keywords') || '';
  }

  /**
   * 累積データを保存
   */
  function saveAccumulatedData() {
    chrome.storage.local.set({
      'kuraberu_tp_prices': collectedPrices,
      'kuraberu_tp_keyword': currentSearchKeyword,
      'kuraberu_tp_timestamp': Date.now()
    });
  }

  /**
   * 累積データを読み込み
   */
  async function loadAccumulatedData() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['kuraberu_tp_prices', 'kuraberu_tp_keyword', 'kuraberu_tp_timestamp'], (result) => {
        const keyword = getSearchKeyword();
        const savedKeyword = result.kuraberu_tp_keyword || '';
        const timestamp = result.kuraberu_tp_timestamp || 0;
        const isRecent = (Date.now() - timestamp) < 30 * 60 * 1000; // 30分以内

        if (savedKeyword === keyword && isRecent && result.kuraberu_tp_prices) {
          resolve(result.kuraberu_tp_prices);
        } else {
          resolve([]);
        }
      });
    });
  }

  /**
   * 累積データをクリア
   */
  function clearAccumulatedData() {
    chrome.storage.local.remove(['kuraberu_tp_prices', 'kuraberu_tp_keyword', 'kuraberu_tp_timestamp']);
  }

  /**
   * ページを分析
   */
  function analyzePage(accumulate = false) {
    const newPrices = extractPrices();
    console.log('[しらべる君 テラピーク] 新規価格:', newPrices.length, '件');

    if (accumulate) {
      // 累積モード：既存データに追加
      collectedPrices = [...collectedPrices, ...newPrices];
      saveAccumulatedData();
      showMessage(`➕ ${newPrices.length}件を追加（計${collectedPrices.length}件）`);
    } else {
      // リセットモード
      collectedPrices = newPrices;
      currentSearchKeyword = getSearchKeyword();
      saveAccumulatedData();
    }

    updateStatsDisplay();
  }

  /**
   * 統計表示を更新
   */
  function updateStatsDisplay() {
    const stats = calculateStats(collectedPrices);
    const statsEl = document.getElementById('kuraberu-tp-stats');

    if (stats.count === 0) {
      statsEl.innerHTML = `
        <div style="color: #e65100; font-size: 13px;">
          ⚠️ 価格データが見つかりません<br>
          <span style="font-size: 11px;">ページの読み込みを待って「再読込」をお試しください</span>
        </div>
      `;
      return;
    }

    statsEl.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">件数</div>
          <div style="font-size: 20px; font-weight: 600; color: #333;">${stats.count}</div>
        </div>
        <div style="background: #fff8e1; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">平均</div>
          <div style="font-size: 20px; font-weight: 600; color: #f57c00;">$${stats.avg.toFixed(2)}</div>
        </div>
        <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">最安値</div>
          <div style="font-size: 18px; font-weight: 600; color: #2e7d32;">$${stats.min.toFixed(2)}</div>
        </div>
        <div style="background: #ffebee; padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #666; margin-bottom: 4px;">最高値</div>
          <div style="font-size: 18px; font-weight: 600; color: #c62828;">$${stats.max.toFixed(2)}</div>
        </div>
      </div>
      <div style="margin-top: 12px; background: #e3f2fd; padding: 12px; border-radius: 8px; text-align: center;">
        <div style="font-size: 11px; color: #666; margin-bottom: 4px;">中央値</div>
        <div style="font-size: 18px; font-weight: 600; color: #1565c0;">$${stats.median.toFixed(2)}</div>
      </div>
    `;
  }

  /**
   * メッセージを表示
   */
  function showMessage(text) {
    const msgEl = document.getElementById('kuraberu-tp-message');
    if (msgEl) {
      msgEl.textContent = text;
      setTimeout(() => {
        msgEl.textContent = '';
      }, 3000);
    }
  }

  /**
   * 要素をドラッグ可能にする
   */
  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop, initialRight;

    handle.style.cursor = 'move';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.id === 'kuraberu-tp-close') return;

      isDragging = true;
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
  }

  /**
   * ページコンテンツが読み込まれるまで待つ
   */
  function waitForContent(callback, maxAttempts = 30) {
    let attempts = 0;

    const check = () => {
      attempts++;
      // テラピークのコンテンツを検出（テーブルまたはdata-item-id）
      const table = document.querySelector('table tr') ||
                    document.querySelector('span[data-item-id]') ||
                    document.querySelector('[class*="research"]');
      console.log('[しらべる君 テラピーク] コンテンツ確認中... 試行', attempts);

      if (table) {
        console.log('[しらべる君 テラピーク] コンテンツ発見');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.log('[しらべる君 テラピーク] コンテンツが見つかりませんでしたが、ボタンは表示します');
        callback(); // ボタンは表示する
      }
    };

    check();
  }

  /**
   * 分析ボタンを追加
   */
  function addAnalysisButton() {
    // 既にボタンがあれば何もしない
    if (document.querySelector('.kuraberu-tp-btn')) {
      return;
    }

    const btn = document.createElement('button');
    btn.className = 'kuraberu-tp-btn';
    btn.innerHTML = '📊 価格分析';
    btn.title = 'テラピークの価格データを分析します（ドラッグで移動可能）';

    btn.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 9999;
      padding: 12px 20px;
      background: linear-gradient(135deg, #f5af02 0%, #e09b00 100%);
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
    currentButton = btn;

    // ボタンをドラッグ可能に
    const dragState = makeDraggableButton(btn);

    // クリック時の処理（ドラッグと区別）
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dragState.hasMoved()) return;
      showAnalysisPanel();
    });

    console.log('[しらべる君 テラピーク] ボタン追加完了');
  }

  /**
   * ボタン用ドラッグ機能
   */
  function makeDraggableButton(element) {
    let isDragging = false;
    let hasMoved = false;
    let startX, startY, initialRight, initialTop;

    element.addEventListener('mousedown', (e) => {
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const computedStyle = window.getComputedStyle(element);
      initialRight = parseInt(computedStyle.right);
      initialTop = parseInt(computedStyle.top);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      const newRight = Math.max(0, Math.min(initialRight - dx, window.innerWidth - element.offsetWidth));
      const newTop = Math.max(0, Math.min(initialTop + dy, window.innerHeight - element.offsetHeight));
      element.style.right = `${newRight}px`;
      element.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    return { hasMoved: () => hasMoved };
  }

  /**
   * 初期化
   */
  function init() {
    if (!isTerapeakPage()) {
      console.log('[しらべる君 テラピーク] テラピークページではありません');
      return;
    }

    console.log('[しらべる君 テラピーク] テラピークページを検出');

    // コンテンツが読み込まれるまで待ってからボタン表示
    waitForContent(() => {
      addAnalysisButton();
    });
  }

  // 初期化実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // 少し待ってから初期化（SPAの初期レンダリングを待つ）
    setTimeout(init, 500);
  }

  // URL変更監視（SPA対応）
  let lastUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      // 既存のパネルとボタンを削除
      if (currentPanel) {
        currentPanel.remove();
        currentPanel = null;
      }
      if (currentButton) {
        currentButton.remove();
        currentButton = null;
      }
      collectedPrices = [];

      if (isTerapeakPage()) {
        waitForContent(() => {
          addAnalysisButton();
        });
      }
    }
  }, 1000);

})();
