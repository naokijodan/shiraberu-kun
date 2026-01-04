/**
 * くらべる君 - テラピーク分析スクリプト
 * テラピークのページから価格データを収集・分析
 */
(function() {
  'use strict';

  console.log('[くらべる君 テラピーク] 分析スクリプト読み込み');

  // 累積データ
  let collectedPrices = [];
  let currentPanel = null;

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
    console.log('[くらべる君 テラピーク] data-item-id要素数:', titleSpans.length);

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
            console.log('[くらべる君 テラピーク] 商品', index, '価格:', '$' + priceMatch[1]);
          }
        }
      });
    }

    // フォールバック：span[data-item-id]がない場合はテーブル行から抽出
    if (prices.length === 0) {
      console.log('[くらべる君 テラピーク] data-item-idがないためフォールバック');
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
            console.log('[くらべる君 テラピーク] 行', index, '価格:', '$' + priceMatch[1]);
          }
        }
      });
    }

    console.log('[くらべる君 テラピーク] 抽出した価格:', prices.length, '件');
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
          <span style="font-weight: 600;">📊 くらべる君 - テラピーク分析</span>
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

    // イベントリスナー
    document.getElementById('kuraberu-tp-close').addEventListener('click', () => {
      panel.remove();
      currentPanel = null;
    });

    document.getElementById('kuraberu-tp-refresh').addEventListener('click', () => {
      collectedPrices = [];
      showMessage('🔄 データを読み込み中...');
      // 少し待ってから再分析（SPAのデータ更新を待つ）
      setTimeout(() => {
        analyzePage();
      }, 1000);
    });

    document.getElementById('kuraberu-tp-add-page').addEventListener('click', () => {
      analyzePage(true); // 累積モード
    });

    // 初回分析
    analyzePage();
  }

  /**
   * ページを分析
   */
  function analyzePage(accumulate = false) {
    const newPrices = extractPrices();

    if (accumulate) {
      // 累積モード：既存データに追加
      collectedPrices = [...collectedPrices, ...newPrices];
      showMessage(`➕ ${newPrices.length}件を追加しました`);
    } else {
      // リセットモード
      collectedPrices = newPrices;
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
   * テーブルが読み込まれるまで待つ
   */
  function waitForTable(callback, maxAttempts = 20) {
    let attempts = 0;

    const check = () => {
      attempts++;
      const table = document.querySelector('table tbody tr');
      console.log('[くらべる君 テラピーク] テーブル確認中... 試行', attempts);

      if (table) {
        console.log('[くらべる君 テラピーク] テーブル発見');
        callback();
      } else if (attempts < maxAttempts) {
        setTimeout(check, 500);
      } else {
        console.log('[くらべる君 テラピーク] テーブルが見つかりませんでした');
        callback(); // パネルは表示する（エラーメッセージ用）
      }
    };

    check();
  }

  /**
   * 初期化
   */
  function init() {
    if (!isTerapeakPage()) {
      console.log('[くらべる君 テラピーク] テラピークページではありません');
      return;
    }

    console.log('[くらべる君 テラピーク] テラピークページを検出');

    // テーブルが読み込まれるまで待ってからパネル表示
    waitForTable(() => {
      showAnalysisPanel();
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
      if (isTerapeakPage()) {
        collectedPrices = [];
        waitForTable(() => {
          showAnalysisPanel();
        });
      }
    }
  }, 1000);

})();
