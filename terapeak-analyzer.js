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
   * ページから価格データを抽出（Avg sold price列のみ）
   */
  function extractPrices() {
    const prices = [];

    // テラピークのテーブル行を探す
    const rows = document.querySelectorAll('table tbody tr');

    console.log('[くらべる君 テラピーク] テーブル行数:', rows.length);

    if (rows.length > 0) {
      rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');

        // 3列目（index 2）が「Avg sold price」列
        // 列構成: 0=Listing, 1=Actions, 2=Avg sold price, 3=Avg shipping, ...
        if (cells.length >= 3) {
          const priceCell = cells[2];
          const text = priceCell.textContent.trim();

          // $で始まる価格を抽出（"Fixed price"や"Auction"などの文字列を除去）
          const priceMatch = text.match(/\$([\d,]+\.\d{2})/);
          if (priceMatch) {
            const price = parsePriceText('$' + priceMatch[1]);
            if (price > 0 && price < 100000) {
              prices.push(price);
              console.log('[くらべる君 テラピーク] 行', index, 'Avg sold price:', '$' + priceMatch[1]);
            }
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
      analyzePage();
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
   * 初期化
   */
  function init() {
    if (!isTerapeakPage()) {
      console.log('[くらべる君 テラピーク] テラピークページではありません');
      return;
    }

    console.log('[くらべる君 テラピーク] テラピークページを検出');

    // テラピークはSPAなので、より長めに待つ
    setTimeout(() => {
      showAnalysisPanel();
    }, 3000);
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
        setTimeout(() => {
          showAnalysisPanel();
        }, 3000);
      }
    }
  }, 1000);

})();
